// =============================================================================
// Weather scene derivation
//
// One pure function turns (weather × sun × theme) into a `WeatherScene`: the
// complete, renderer-agnostic description of the wallpaper: sky palette, sun
// and moon placement, cloud cover/density/lighting, precipitation, wind, fog,
// lightning, stars and the theme veil.
//
// Both renderers consume it: the WebGL shader (the iOS-like animated
// wallpaper) and the CSS gradient fallback (widget mode / no WebGL / reduced
// motion). Keeping the palette here means both always agree, and the devtool
// can preview any state without a canvas.
// =============================================================================

import { oklabToRgb01, rgb01ToOklab } from "./color";
import type { SolarPosition } from "./solar";
import {
  clamp01,
  DAY_ELEVATION_DEG,
  daylightFactor,
  estimateSolarPosition,
  getLunarPosition,
  getMoonIllumination,
  getMoonPhase,
  getSolarPosition,
  localSiderealDeg,
  smoothstep,
  startOfLocalDay,
  DAY_MINUTES,
  sunTimesOrDefault,
} from "./solar";
import type {
  NormalizedWeather,
  PrecipitationType,
  WeatherCondition,
} from "./weather";
import { magneticDeclination } from "./magnetic";
import { precipitationTypeForCondition } from "./weather";
import { WIPE_MIN_FOG } from "./wipe";

export type RGB = readonly [number, number, number];

export interface ScreenPoint {
  /** 0..1, left → right. */
  x: number;
  /** 0..1, bottom → top. */
  y: number;
}

export interface WeatherScene {
  sun: SolarPosition & {
    screen: ScreenPoint;
    /** 0 = astronomical night … 1 = full day. */
    daylight: number;
    /** The one day/night decision (`DAY_ELEVATION_DEG`): icons, palettes, chips. */
    isDay: boolean;
  };
  moon: SolarPosition & {
    phase: number;
    illumination: number;
    /** 0..1 how strongly the moon shows (above horizon × dark sky × clear). */
    visible: number;
    /** Where the disc is drawn: staged, not the raw elevation (see `stageMoon`). */
    screen: ScreenPoint;
    /** Relative disc size: 1 high in the sky, larger near the horizon. */
    size: number;
  };
  /** +1 northern hemisphere (east on the left), −1 southern (mirrored). */
  hemisphere: 1 | -1;
  sky: {
    zenith: RGB;
    horizon: RGB;
    /** Colour of the sun's glow / the light that tints clouds. */
    glow: RGB;
    /** 0..1 intensity of the sun glow. */
    glowStrength: number;
  };
  clouds: {
    cover: number;
    density: number;
    /** 0..1 storminess: how dark the cloud bases read. */
    darkness: number;
    lit: RGB;
    shade: RGB;
    /** Relative drift speed. */
    speed: number;
  };
  precipitation: {
    type: PrecipitationType;
    intensity: number;
  };
  /** Screen-space wind: x < 0 blows left. |wind| ∈ 0..1. */
  wind: { x: number; y: number };
  /**
   * The same wind in the world: where it blows TO, as east and north
   * components of the same 0..1 strength. The stage only ever sees the part of
   * it across its southward view (`wind.x`); the sky window turns, so it needs
   * the whole of it to find the part across wherever you are facing.
   */
  windWorld: { east: number; north: number };
  /**
   * Where the observer stands under the stars: the latitude sets the pole's
   * height, and the local sidereal time how far the sphere has turned. Only
   * the sky window reads it. The stage's stars are a picture; the window's
   * turn with the sky. A guess of 40° (mirrored south) and Greenwich without
   * coordinates, which turns the right way at the right rate all the same.
   *
   * `declination` is where the phone's compass points, against true north,
   * here and now (lib/magnetic.ts). The sky window turns every magnetic
   * heading it is handed by this much. 0 without coordinates: no guess of a
   * place is better than none for a field that differs by 30° across a
   * continent.
   */
  celestial: { latitude: number; siderealDeg: number; declination: number };
  fog: number;
  lightning: number;
  stars: number;
  /**
   * What the murk is hiding: the same night sky with neither the fog nor the
   * deck that a fog day brings in front of it.
   *
   * A foggy night has no stars and barely a moon: `cover` alone saturates the
   * star term and the fog halves what is left of the moon. So by the time the
   * shader runs there is nothing there to uncover. That defeats the wipe: the
   * sky above the fog really does have a moon and stars in it, and clearing
   * the mist is supposed to show you them. So the scene hands over the
   * unhidden version too, and the shader reaches for it inside the swath.
   * See "The fog wipe" in docs/ambient-easter-eggs.md.
   */
  behind: { stars: number; moon: number };
  /**
   * How much of the sky the murk leaves you: 1 under an open sky, 0 under an
   * overcast or a fog. `stars` is `behind.stars * clarity`. The first factor
   * is how dark the night is, the second is whether there is anything in the
   * way. Keeping them apart lets a question about one be asked without
   * dragging in the other. The meteor's window is the example: whether
   * it is dark enough is the sun's business and whether you could see through
   * is the weather's, and multiplying them together (which is all `stars` is)
   * answers neither.
   */
  clarity: number;
  /** Theme veil: blend the rendered scene toward the page background. */
  veil: { color: RGB; amount: number };
  exposure: number;
  /**
   * For the painters that never applied `exposure` (the Gradient and the
   * legibility profile, tuned without it): the exposure to paint with (1 away
   * from twilight, the scene's through it) and how much of their own lift on
   * the veil to keep (1 away from twilight, none through it). So they meet the
   * Sky's twilight look without knowing there is one. See "The twilight look".
   */
  flat: { exposure: number; lift: number };
  /** Stable per-session seed so cloud layouts don't jump between renders. */
  seed: number;
  /** Which discrete condition produced this scene (for icons / labels). */
  condition: WeatherCondition;
  theme: "light" | "dark";
}

// -----------------------------------------------------------------------------
// Colour helpers
// -----------------------------------------------------------------------------

function hex(h: string): RGB {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function scaleRGB(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  const k = clamp01(t);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

export function rgbToCss(c: RGB, alpha?: number): string {
  const r = Math.round(clamp01(c[0]) * 255);
  const g = Math.round(clamp01(c[1]) * 255);
  const b = Math.round(clamp01(c[2]) * 255);
  return alpha === undefined
    ? `rgb(${r} ${g} ${b})`
    : `rgb(${r} ${g} ${b} / ${clamp01(alpha).toFixed(3)})`;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// -----------------------------------------------------------------------------
// Sky keyframes by sun elevation (clear sky)
// -----------------------------------------------------------------------------

interface SkyKey {
  el: number;
  zenith: RGB;
  horizon: RGB;
  glow: RGB;
  strength: number;
}

const SKY_KEYS: SkyKey[] = [
  { el: -18, zenith: hex("#05091a"), horizon: hex("#0b1330"), glow: hex("#1b2447"), strength: 0.0 },
  { el: -12, zenith: hex("#070e29"), horizon: hex("#151f48"), glow: hex("#3d3d72"), strength: 0.25 },
  { el: -6, zenith: hex("#0f1a48"), horizon: hex("#4d3f73"), glow: hex("#c8765c"), strength: 0.6 },
  { el: -2, zenith: hex("#1f3d7a"), horizon: hex("#b86d57"), glow: hex("#f28c4e"), strength: 0.95 },
  { el: 0, zenith: hex("#2d5ca4"), horizon: hex("#dd905a"), glow: hex("#ffb267"), strength: 1.0 },
  { el: 4, zenith: hex("#3b76c3"), horizon: hex("#ecb886"), glow: hex("#ffd9a3"), strength: 0.92 },
  { el: 10, zenith: hex("#4a90da"), horizon: hex("#bdd8f0"), glow: hex("#fff3d6"), strength: 0.72 },
  { el: 25, zenith: hex("#3d87dc"), horizon: hex("#c9e0f4"), glow: hex("#ffffff"), strength: 0.58 },
  { el: 60, zenith: hex("#2f74d2"), horizon: hex("#d0e4f8"), glow: hex("#ffffff"), strength: 0.5 },
];

function sampleSky(elevation: number): Omit<SkyKey, "el"> {
  const el = Math.max(SKY_KEYS[0].el, Math.min(SKY_KEYS[SKY_KEYS.length - 1].el, elevation));
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const a = SKY_KEYS[i];
    const b = SKY_KEYS[i + 1];
    if (el >= a.el && el <= b.el) {
      const t = smoothstep(a.el, b.el, el);
      return {
        zenith: mixRGB(a.zenith, b.zenith, t),
        horizon: mixRGB(a.horizon, b.horizon, t),
        glow: mixRGB(a.glow, b.glow, t),
        strength: lerp(a.strength, b.strength, t),
      };
    }
  }
  const last = SKY_KEYS[SKY_KEYS.length - 1];
  return { zenith: last.zenith, horizon: last.horizon, glow: last.glow, strength: last.strength };
}

// -----------------------------------------------------------------------------
// Per-condition defaults + tints
// -----------------------------------------------------------------------------

interface ConditionProfile {
  /** Cloud cover used when the API gives none, and the floor when it does. */
  cover: number;
  coverMin: number;
  density: number;
  darkness: number;
  precip: number;
  fog: number;
  /** Sky tint (day / night) and how strongly it overrides the clear sky. */
  tintDay: { zenith: RGB; horizon: RGB };
  tintNight: { zenith: RGB; horizon: RGB };
  tintAmount: number;
}

const PROFILES: Record<WeatherCondition, ConditionProfile> = {
  clear: {
    cover: 0.04, coverMin: 0, density: 0.35, darkness: 0.05, precip: 0, fog: 0,
    tintDay: { zenith: hex("#2f74d2"), horizon: hex("#d0e4f8") },
    tintNight: { zenith: hex("#05091a"), horizon: hex("#0b1330") },
    tintAmount: 0,
  },
  // "cloudy" spans WMO 1–3 (mainly clear → overcast); the measured cover
  // decides how heavy it reads, so the floor stays low.
  cloudy: {
    cover: 0.7, coverMin: 0.2, density: 0.75, darkness: 0.3, precip: 0, fog: 0.05,
    tintDay: { zenith: hex("#7e8b9b"), horizon: hex("#b4bfca") },
    tintNight: { zenith: hex("#171b24"), horizon: hex("#252b36") },
    tintAmount: 0.8,
  },
  fog: {
    cover: 0.75, coverMin: 0.5, density: 0.6, darkness: 0.1, precip: 0, fog: 0.9,
    tintDay: { zenith: hex("#c4cad2"), horizon: hex("#e3e6ea") },
    tintNight: { zenith: hex("#23272e"), horizon: hex("#31363e") },
    tintAmount: 0.9,
  },
  rain: {
    cover: 0.92, coverMin: 0.7, density: 0.9, darkness: 0.6, precip: 0.6, fog: 0.22,
    tintDay: { zenith: hex("#56626f"), horizon: hex("#8e9aa7") },
    tintNight: { zenith: hex("#10141b"), horizon: hex("#1c222b") },
    tintAmount: 0.9,
  },
  snow: {
    cover: 0.88, coverMin: 0.6, density: 0.75, darkness: 0.25, precip: 0.5, fog: 0.3,
    tintDay: { zenith: hex("#a3adba"), horizon: hex("#d9dfe6") },
    tintNight: { zenith: hex("#242a38"), horizon: hex("#353c4c") },
    tintAmount: 0.85,
  },
  thunder: {
    cover: 0.96, coverMin: 0.8, density: 1, darkness: 0.9, precip: 0.8, fog: 0.2,
    tintDay: { zenith: hex("#2c3440"), horizon: hex("#4d5665") },
    tintNight: { zenith: hex("#0a0d13"), horizon: hex("#151a22") },
    tintAmount: 0.92,
  },
};

// -----------------------------------------------------------------------------
// Theme veil defaults
// -----------------------------------------------------------------------------

const VEIL_DEFAULTS = {
  light: { color: hex("#ffffff"), amount: 0.3, exposure: 1.06 },
  dark: { color: hex("#1a1a1a"), amount: 0.26, exposure: 0.86 },
} as const;

// -----------------------------------------------------------------------------
// Theme key: the sky the sun painted, in the theme's lightness
//
// The sun decides what is in the sky: its colour, the sun or the moon, the
// stars. The theme decides how light it is. Those agree by day under the light
// theme and by night under the dark one, and the veil above is all either
// needs. They disagree by day under the dark theme and by night under the
// light one, and a veil cannot settle that: it mixes toward the page colour,
// so a noon sky under a dark veil is a grey-blue midtone the dark chrome sits
// on like a sticker, and a night under a white one is slate. Neither reads as
// its theme; each reads as the other theme, muddied.
//
// So the sky is re-keyed instead, like the Apple light/dark wallpaper pairs,
// where both halves are the same place and only the key differs. Each
// colour's OKLab lightness is moved into the theme's range and its hue kept,
// so the day stays the day and the night stays the night:
//
//   dark theme, day    the noon sky pressed down into the dark theme's range:
//                      deep blue, clouds still lighter than the sky, the sun's
//                      disc (the shader's, never keyed) and its half-keyed
//                      glow still the brightest thing in it. Blue hour, held
//                      all afternoon.
//   light theme, night the night lifted into the light theme's range: pale
//                      moonlit lavender, the brighter stars still showing, and
//                      the moon dimmed to a day moon (at full strength it
//                      would saturate to a white ball and read as the sun).
//
// The amount is zero through the twilight band on both sides (sunrise and
// sunset are the in-between the sky already reads well under either theme),
// and it is zero on both sides of the sun's own crossing, which is where the
// theme changes hands when it follows the sun (lib/solar-theme.ts). So the
// handover never has a re-key to fight: it only ever begins or ends where the
// sky is already the theme's.
// -----------------------------------------------------------------------------

interface ThemeKeyCurve {
  /** Where lightness lands: L' = floor + span · L^gamma (OKLab). */
  floor: number;
  span: number;
  gamma: number;
  /** Chroma gain at full key, so a pressed or lifted sky keeps its colour. */
  chroma: number;
  /** How much of the key the sun's glow takes, so the sun stays the sun. */
  glow: number;
  /** What is left of the veil at full key; the key has done most of its work. */
  veil: number;
  /** What is left of the moon at full key: a lifted night's moon is a day moon. */
  moon: number;
  /** Sun elevations (degrees) between which the key goes from 0 to full. */
  from: number;
  to: number;
}

const THEME_KEY: Record<"light" | "dark", ThemeKeyCurve> = {
  // The day under the dark theme. Full from mid-morning; nothing at the horizon.
  dark: {
    floor: 0.1, span: 0.42, gamma: 1.5, chroma: 0.8,
    glow: 0.45, veil: 0.5, moon: 1,
    from: 0, to: 14,
  },
  // The night under the light theme. Full once civil twilight is over.
  light: {
    floor: 0.7, span: 0.26, gamma: 1, chroma: 0.85,
    glow: 1, veil: 0.6, moon: 0.3,
    from: -2, to: -10,
  },
};

/** How far the sky is re-keyed toward `theme`, 0..1, at this sun elevation. */
function themeKeyAmount(theme: "light" | "dark", elevation: number): number {
  const curve = THEME_KEY[theme];
  return smoothstep(curve.from, curve.to, elevation);
}

// -----------------------------------------------------------------------------
// The twilight look: where the two themes meet
//
// The key keeps each theme's sky in its range away from the horizon; what is
// left of the theme at the horizon is the veil and the exposure: the light
// theme's brightened and washed toward white, the dark theme's dimmed and
// washed toward the page. That is right at noon and at midnight, and it is the
// whole of the cut at sunset: the key is zero on both sides of the crossing,
// so when the theme follows the sun, the light theme's bright, milky sunset
// became the dark theme's dim one in three seconds, the sun's glow first.
//
// So twilight belongs to neither theme. Toward the sun's crossing both looks
// are drawn to one (no veil, the sky a little under its own exposure), and
// at the crossing they are the same look, so a theme that changes hands there
// (lib/solar-theme.ts) has nothing to change in the sky. The light theme's
// sun dims through the last of the afternoon toward it, the dark theme's
// brightens through the dawn, and each is its own again at the ends:
//
//            light's own   ←──── meet ────→   dark's own
//   light  ──────┬────────────┬────┬───┬───────────────────────
//              +12°          0°  −1.5 −4
//   dark   ──────────────┬────┬────┬──────────────┬────────────
//                       +4    0°  −1.5           −8°
//
// Long on the side each theme follows the sun toward, short on the side past
// the crossing, where only a hand-picked theme goes: there the key is about to
// take over (a dark afternoon, a light evening), and a meet that lingered
// would put the chrome on the wrong side of its sky before the key arrives.
// The plateau covers where the handover really lands: at sunrise and sunset
// as the forecast has them, which is −0.83° on the ephemeris and 0° on the
// estimated arc.
//
// Where the look meets is a legibility decision: the frame's lightness at
// which the light chrome's tone conflict and the dark chrome's are about equal
// (`toneSafe` in lib/legibility.ts: the light card wants the picture above
// 0.62, the dark one below 0.45), so both lean on the policy's fill equally in
// the minutes the sky is changing hands. For a clear sunset that is ~0.53.
// -----------------------------------------------------------------------------

const TWILIGHT_LOOK = {
  /** The shared exposure at the crossing; the veil there is none. */
  exposure: 0.8,
  /** Sun elevations (degrees) between which the look is the shared one. */
  plateau: [-1.5, 0],
  /** Where each theme's own look is whole again, above and below the plateau. */
  light: { above: 12, below: -4 },
  dark: { above: 4, below: -8 },
} as const;

/**
 * How far the theme's own look gives way to the twilight look, 0..1, at this
 * sun elevation: 1 through the crossing, 0 once the theme's own look is back.
 */
function twilightLookAmount(theme: "light" | "dark", elevation: number): number {
  const [low, high] = TWILIGHT_LOOK.plateau;
  const ends = TWILIGHT_LOOK[theme];
  return elevation >= high
    ? 1 - smoothstep(high, ends.above, elevation)
    : 1 - smoothstep(low, ends.below, elevation);
}

/**
 * The theme's veil amount and exposure, drawn `t` of the way to the twilight
 * look, mixed as what they paint (`gain·col + offset`); the veil keeps its
 * colour while its amount goes to none.
 */
function toTwilightLook(
  look: { amount: number; exposure: number },
  t: number
): { amount: number; exposure: number } {
  if (t <= 0) return look;
  const gain = lerp(look.exposure * (1 - look.amount), TWILIGHT_LOOK.exposure, t);
  const amount = look.amount * (1 - t);
  return { amount, exposure: gain / (1 - amount) };
}

/** One colour of the sky, moved `amount` of the way into the theme's key. */
function rekey(c: RGB, theme: "light" | "dark", amount: number): RGB {
  if (amount <= 0) return c;
  const curve = THEME_KEY[theme];
  const lab = rgb01ToOklab(c);
  const L = curve.floor + curve.span * Math.max(0, lab.L) ** curve.gamma;
  const gain = lerp(1, curve.chroma, amount);
  return oklabToRgb01({
    L: lerp(lab.L, L, amount),
    a: lab.a * gain,
    b: lab.b * gain,
  });
}

// -----------------------------------------------------------------------------
// Derivation
// -----------------------------------------------------------------------------

/**
 * The weather as the scene reads it. Only `condition` is required: every
 * measurement present replaces the condition's profile default for what it
 * describes, and every one missing falls back to it. So a condition alone
 * (the devtool, the legibility gallery, the profiler) paints exactly the
 * hand-tuned profile, and a real forecast paints the sky it measured.
 */
export interface SceneWeatherInput {
  condition: WeatherCondition;
  /** WMO code, for the thunderstorm's severity (96/99: with hail). */
  weatherCode?: number;
  cloudCover?: number;
  /** 0..1 cover by layer. All three, or the profile's density and darkness. */
  cloudCoverLow?: number;
  cloudCoverMid?: number;
  cloudCoverHigh?: number;
  /** What is actually falling (weather.ts derivePrecipitationType). */
  precipitationType?: PrecipitationType;
  precipitationIntensity?: number;
  windSpeedKmh?: number;
  windGustsKmh?: number;
  windDirectionDeg?: number;
  humidity?: number;
  visibilityM?: number;
  temperatureC?: number;
  dewPointC?: number;
  capeJkg?: number;
  sunriseMs?: number;
  sunsetMs?: number;
}

export interface SceneOverrides {
  cloudCover?: number;
  precipitationIntensity?: number;
  windSpeedKmh?: number;
  /**
   * Where the wind blows FROM, in met degrees. Speed alone says nothing about
   * what the sky does: the screen looks south, so a wind along that axis has no
   * horizontal component at all and no amount of it leans the rain. A devtool
   * that can set a speed and not a direction can therefore look broken.
   */
  windDirectionDeg?: number;
  /** Override the veil amount (0..1). */
  veilAmount?: number;
}

export interface DeriveSceneParams {
  nowMs: number;
  lat?: number;
  lon?: number;
  weather: SceneWeatherInput | null;
  theme: "light" | "dark";
  overrides?: SceneOverrides;
  seed?: number;
}

/** The observer's coordinates, when the params carry usable ones. */
function coordsOf(params: DeriveSceneParams): { lat: number; lon: number } | null {
  const { lat, lon } = params;
  return typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon)
    ? { lat, lon }
    : null;
}

/** The observer under the stars, and their compass's north. See `celestial`. */
function celestialOf(params: DeriveSceneParams, hemisphere: 1 | -1): WeatherScene["celestial"] {
  const coords = coordsOf(params);
  return {
    latitude: coords?.lat ?? 40 * hemisphere,
    siderealDeg: localSiderealDeg(params.nowMs, coords?.lon ?? 0),
    declination: coords ? magneticDeclination(coords.lat, coords.lon, params.nowMs) : 0,
  };
}

/**
 * Where the horizon sits on the stage, in screen heights from the bottom, and
 * so where the sky window's horizon maps to in the shader's sky gradient
 * (`WINDOW_HORIZON_Y` in wallpaper/shader.ts is this, interpolated).
 */
export const HORIZON_Y = 0.1;

// -----------------------------------------------------------------------------
// Staging the moon
//
// Where the moon IS comes from the ephemeris and is never bent: it rises and
// sets when it really does, its phase is the calendar's, and a first-quarter
// moon really is up all afternoon. Where the moon is DRAWN is a composition
// decision, made on purpose:
//
//   · The vertical mapping is a stage, not a protractor. A moon a few degrees
//     up is already drawn in the strip above the page content (the hero and
//     the greeting, on a phone the top third), and it climbs from there to
//     just under the top edge. Mapping elevation linearly put most of the
//     night's moon behind the widget grid, where nothing sees it.
//   · Horizontally it still crosses east → west with its azimuth (mirrored in
//     the south), but the disc is kept off the extreme edges so a rising or
//     setting moon is never half a moon.
//   · The daytime moon is intentional and quiet: it shows only when it is well
//     up AND far enough from the sun to be seen in daylight (a crescent near
//     the sun is invisible by day, in the sky and here), and then as a pale
//     disc rather than the bright night one.
//   · It is drawn a little larger near the horizon (the moon illusion), which
//     is how the eye remembers a rising moon.
// -----------------------------------------------------------------------------

const MOON_STAGE = {
  /** Screen y where the disc first appears, as it clears the horizon. */
  rise: 0.5,
  /** Screen y once it is properly up (a few degrees). */
  low: 0.62,
  /** Screen y at its highest. */
  high: 0.9,
  /** Elevation, °, at which the disc reaches `high`. */
  topAt: 60,
  /** The disc stays inside these screen x bounds. */
  xMin: 0.12,
  xMax: 0.88,
} as const;

export function stageMoon(
  lunar: SolarPosition,
  hemisphere: 1 | -1
): { screen: ScreenPoint; size: number } {
  const rising = smoothstep(-3, 6, lunar.elevation);
  const climb = smoothstep(6, MOON_STAGE.topAt, lunar.elevation);
  const y =
    lerp(MOON_STAGE.rise, MOON_STAGE.low, rising) +
    (MOON_STAGE.high - MOON_STAGE.low) * climb;
  const x = Math.min(
    MOON_STAGE.xMax,
    Math.max(MOON_STAGE.xMin, azimuthToScreenX(lunar.azimuth, hemisphere))
  );
  // The moon illusion: up to 30% larger near the horizon.
  const size = 1 + 0.3 * (1 - smoothstep(0, 35, lunar.elevation));
  return { screen: { x, y }, size };
}

/**
 * Where the stage draws the sun: across by its azimuth, up by the sine of its
 * elevation from the horizon line. Exported for the renderer, which re-stages a
 * sun that is gliding along the sky after a jump of the clock or the place.
 */
export function stageSun(solar: SolarPosition, hemisphere: 1 | -1): ScreenPoint {
  return {
    x: azimuthToScreenX(solar.azimuth, hemisphere),
    y: HORIZON_Y + Math.sin(solar.elevation * (Math.PI / 180)) * 0.9,
  };
}

/** Map a compass azimuth to a screen x. Northern hemisphere looks south, so
 *  east is on the left; the southern hemisphere looks north and mirrors. */
function azimuthToScreenX(azimuthDeg: number, hemisphere: 1 | -1): number {
  const x = 0.5 + 0.5 * Math.sin((azimuthDeg - 180) * (Math.PI / 180)) * hemisphere;
  return 0.06 + x * 0.88;
}

function resolveSolar(params: DeriveSceneParams): SolarPosition {
  const coords = coordsOf(params);
  return coords
    ? getSolarPosition(params.nowMs, coords.lat, coords.lon)
    : estimateSolarPosition({
        nowMs: params.nowMs,
        sunriseMs: params.weather?.sunriseMs,
        sunsetMs: params.weather?.sunsetMs,
      });
}

/**
 * Moon geometry. With coordinates this is the real topocentric ephemeris (so
 * the moon rises, crosses and sets when it should, and a time-travel sweep
 * moves it along a genuine arc). Without coordinates it follows a plausible
 * arc across the night, driven by sunrise/sunset (or the local clock).
 */
function resolveLunar(params: DeriveSceneParams): SolarPosition & { phase: number } {
  const coords = coordsOf(params);
  if (coords) return getLunarPosition(params.nowMs, coords.lat, coords.lon);

  // No ephemeris without a place, but the phase needs none, and the phase IS
  // where the moon is relative to the sun: it runs behind the sun by its
  // phase's share of a day. New, it crosses the sky with the sun (and is lost
  // in it); first quarter, it is highest at dusk; full, it rises as the sun
  // sets and is highest at midnight; last quarter, it rises at midnight. So
  // its arc is the sun's own estimated arc, that far behind. Anything else
  // (a fixed night arc, as this once was) draws a crescent high at midnight
  // and leaves the moon ignoring the calendar, and the devtool's date too.
  const { nowMs } = params;
  const phase = getMoonPhase(nowMs);
  const { sunrise, sunset } = sunTimesOrDefault(
    nowMs,
    params.weather?.sunriseMs,
    params.weather?.sunsetMs
  );
  const natural = estimateSolarPosition({
    nowMs: nowMs - phase * 86_400_000,
    sunriseMs: sunrise,
    sunsetMs: sunset,
  });
  return { ...natural, phase };
}

/**
 * Instability, 0..1: 0 in stable air, 1 by ~2500 J/kg of CAPE (the towering,
 * dark-based cumulonimbus of a real storm). A thunder code is convection
 * whatever the CAPE reads this quarter-hour, so it never counts for less than
 * half.
 */
function convectionOf(weather: SceneWeatherInput | null | undefined): number {
  const cape = weather?.capeJkg;
  const measured = typeof cape === "number" ? smoothstep(300, 2500, cape) : 0;
  return weather?.condition === "thunder" ? Math.max(0.5, measured) : measured;
}

/**
 * How hard a thunderstorm flashes, 0.55..1. The shader scales the flash's
 * brightness by it. A code with hail (96/99) is the severe end; otherwise the
 * air's instability decides. A thunder scene is never 0: the strike egg
 * (lib/poke.ts) arms on any lightning at all.
 */
function lightningFor(weather: SceneWeatherInput | null | undefined): number {
  const code = weather?.weatherCode;
  if (code === 96 || code === 99) return 1;
  if (typeof weather?.capeJkg !== "number") return 1;
  return 0.55 + 0.45 * convectionOf(weather);
}

export function deriveWeatherScene(params: DeriveSceneParams): WeatherScene {
  const { theme } = params;
  const weather = params.weather;
  // No weather yet → a mostly clear sky with a few clouds, lit by the clock.
  const condition: WeatherCondition = weather?.condition ?? "clear";
  const profile = PROFILES[condition];
  const ov = params.overrides ?? {};

  const hemisphere: 1 | -1 =
    typeof params.lat === "number" && params.lat < 0 ? -1 : 1;

  // --- Sun --------------------------------------------------------------
  const solar = resolveSolar(params);
  const elevation = solar.elevation;
  const daylight = daylightFactor(elevation);
  const sunScreen = stageSun(solar, hemisphere);

  // --- Precipitation ----------------------------------------------------
  // What is falling comes from the measurements when there are any; the
  // condition otherwise.
  const precipType =
    weather?.precipitationType ?? precipitationTypeForCondition(condition);
  const precipIntensity =
    precipType === "none"
      ? 0
      : clamp01(
          ov.precipitationIntensity ??
            weather?.precipitationIntensity ??
            profile.precip
        );

  // --- Clouds -----------------------------------------------------------
  // Cover is the measured cover. The only floor is physical: whatever is
  // falling came out of a cloud, so the heavier it falls the more sky that
  // cloud takes (a shower under a broken sky is real; a downpour from 20% is
  // not). Fog keeps its profile floor: it is murk, not sky, but the murk is
  // what tints the palette below.
  const measuredCover = ov.cloudCover ?? weather?.cloudCover;
  const coverFloor =
    condition === "fog"
      ? profile.coverMin
      : precipType === "none"
        ? 0
        : 0.4 + 0.45 * precipIntensity;
  const cover = clamp01(
    measuredCover === undefined
      ? weather
        ? profile.cover
        : 0.3
      : Math.max(coverFloor, measuredCover)
  );

  const convective = convectionOf(weather);

  // Which layers the cover is in decides what it looks like. Low stratus is
  // thick and grey-based, mid-level cloud in between, high cirrus a thin
  // bright veil. So "70% cloud" of cirrus and "70% cloud" of stratus are no
  // longer the same sky. (The shader scales coverage by density, which is
  // exactly the thin-cirrus effect.)
  const low = weather?.cloudCoverLow;
  const mid = weather?.cloudCoverMid;
  const high = weather?.cloudCoverHigh;
  const layered =
    typeof low === "number" && typeof mid === "number" && typeof high === "number";
  const layerSum = layered ? low + mid + high : 0;
  // A fog's "low cloud" is the fog itself, which the fog layer draws.
  const density = layered && layerSum > 0.05 && condition !== "fog"
    ? clamp01(
        (low * 0.95 + mid * 0.7 + high * 0.3) / layerSum +
          precipIntensity * 0.2 +
          convective * 0.2
      )
    : profile.density;

  // --- Sky palette ------------------------------------------------------
  const clearSky = sampleSky(elevation);
  const tint = {
    zenith: mixRGB(profile.tintNight.zenith, profile.tintDay.zenith, daylight),
    horizon: mixRGB(profile.tintNight.horizon, profile.tintDay.horizon, daylight),
  };
  // Heavier cover → the condition tint takes over the clear-sky palette. Even
  // an overcast dawn keeps a hint of warmth near the horizon.
  const tintAmount = profile.tintAmount * smoothstep(0.25, 0.9, cover);
  const zenith = mixRGB(clearSky.zenith, tint.zenith, tintAmount);
  const horizon = mixRGB(clearSky.horizon, tint.horizon, tintAmount * 0.85);
  const glow = clearSky.glow;
  const glowStrength =
    clearSky.strength * (1 - 0.75 * smoothstep(0.3, 0.95, cover) * density);

  // --- Cloud lighting ---------------------------------------------------
  // With layers measured, how dark the undersides are is how much low and mid
  // cloud there is, how hard it is falling, and how unstable the air is,
  // calibrated so the typical day of each condition lands on its old profile
  // value. Snow cloud is bright-based, and fog lifts everything.
  const darkness = layered
    ? clamp01(
        (0.05 + 0.35 * low + 0.15 * mid + 0.4 * precipIntensity + 0.25 * convective) *
          (precipType === "snow" ? 0.5 : 1) *
          (condition === "fog" ? 0.35 : 1)
      )
    : clamp01(
        profile.darkness + precipIntensity * 0.25 + (cover - profile.cover) * 0.2
      );
  const litDay = mixRGB(hex("#ffffff"), glow, 0.55 + 0.45 * (1 - daylight));
  const litNight = hex("#2a3040");
  const lit = mixRGB(litNight, litDay, smoothstep(-8, 4, elevation));
  const shadeDay = mixRGB(hex("#98a4b3"), hex("#39404a"), darkness);
  const shadeNight = mixRGB(hex("#11141b"), hex("#07090d"), darkness);
  const shade = mixRGB(shadeNight, shadeDay, smoothstep(-8, 6, elevation));

  // --- Wind -------------------------------------------------------------
  // Gusty air reads windier than its mean: a third of the way to the gusts.
  const meanWind = weather?.windSpeedKmh ?? 8;
  const gusts = weather?.windGustsKmh;
  const windKmh =
    ov.windSpeedKmh ??
    (typeof gusts === "number" ? meanWind + Math.max(0, gusts - meanWind) / 3 : meanWind);
  const windSpeed = clamp01(windKmh / 50);
  const windFrom = ov.windDirectionDeg ?? weather?.windDirectionDeg ?? 270;
  const windTo = (windFrom + 180) % 360;
  const windX = -Math.sin(windTo * (Math.PI / 180)) * hemisphere * windSpeed;
  const wind = { x: windX, y: 0 };
  const windWorld = {
    east: Math.sin(windTo * (Math.PI / 180)) * windSpeed,
    north: Math.cos(windTo * (Math.PI / 180)) * windSpeed,
  };

  // --- Atmosphere -------------------------------------------------------
  // Fog is visibility: nothing at 10 km, thick by 200 m (log scale; the eye
  // reads visibility in orders of magnitude). A fog code keeps it at least
  // half-thick, since model visibility is the least reliable number here. A
  // dew point within a degree or two of the air temperature adds a haze.
  // Without a visibility, the profile and the old humidity/precip terms.
  const humidity = weather?.humidity ?? 0.5;
  const vis = weather?.visibilityM;
  const haze =
    typeof weather?.temperatureC === "number" && typeof weather?.dewPointC === "number"
      ? smoothstep(2.5, 0.5, weather.temperatureC - weather.dewPointC) * 0.15
      : condition === "cloudy"
        ? smoothstep(0.85, 1, humidity) * 0.15
        : 0;
  const fogMeasured =
    typeof vis === "number"
      ? clamp01(Math.log10(10_000 / Math.max(vis, 1)) / Math.log10(10_000 / 200)) + haze
      : undefined;
  const fogRaw = clamp01(
    fogMeasured === undefined
      ? profile.fog +
          (condition === "cloudy" ? smoothstep(0.85, 1, humidity) * 0.15 : 0) +
          (precipType !== "none" ? precipIntensity * 0.12 : 0)
      : condition === "fog"
        ? Math.max(0.5, fogMeasured)
        : fogMeasured
  );
  // Falling rain or snow keeps the mist under the wipe's threshold: the fog
  // wipe and the gust are never armed together (lib/wipe.ts).
  const fog = precipType === "none" ? fogRaw : Math.min(fogRaw, WIPE_MIN_FOG - 0.05);
  const night = smoothstep(-4, -14, elevation);

  // --- Moon -------------------------------------------------------------
  const lunar = resolveLunar(params);
  const moonPhase = lunar.phase;
  const moonIllum = getMoonIllumination(moonPhase);
  const moonUp = smoothstep(-3, 5, lunar.elevation);
  const skyDark = smoothstep(6, -8, elevation);
  // The daytime moon, on purpose (see "Staging the moon"): well up, and far
  // enough from the sun (elongation from the phase: 0° at new, 180° at full),
  // and then pale. At night the sky's darkness is the only gate.
  const elongation = 180 - Math.abs(moonPhase * 360 - 180);
  const dayMoon =
    0.18 * smoothstep(12, 30, lunar.elevation) * smoothstep(40, 90, elongation);
  // The moon the sky would show with nothing in front of it, and then the same
  // moon behind the murk. Split rather than written twice so the daytime-moon
  // rule above has one home: the wipe uncovers the moon under the rule the sky
  // is showing, not a copy of it. (`starDust` below is the same split.)
  const moonBare = moonUp * lerp(dayMoon, 1, skyDark);
  const moonVisible =
    moonBare * (1 - smoothstep(0.45, 0.9, cover)) * (1 - fog * 0.8);
  const { screen: moonScreen, size: moonSize } = stageMoon(lunar, hemisphere);
  // Moonlight: a bright, high moon lifts the night sky and cloud tops and
  // washes out the fainter stars.
  const moonLight = moonIllum * smoothstep(0, 25, lunar.elevation) * night;

  const starDust = night * (1 - 0.55 * moonLight);
  // What the deck and the fog leave of whatever is up there. Named because two
  // different questions want it on its own: how bright to draw the star field
  // (that is `stars`, below) and whether anything up there could be seen at all
  // (that is the meteor's window; see lib/poke.ts).
  const clarity = (1 - smoothstep(0.15, 0.65, cover)) * (1 - fog);
  // Naming it moves a multiplication inside a bracket, and `a * (b * c)` is not
  // `(a * b) * c`: `stars` shifts by one double ULP on about 3% of scenes. It
  // reaches the shader as a float32, whose spacing near 1 is five hundred
  // million times coarser, so nothing rendered moves. Checked over 366336
  // scenes, zero of them landing on a different float32.
  const stars = starDust * clarity;
  // The same two with the murk taken away (see `behind` on WeatherScene). Only
  // the fog wipe ever asks for them, and only inside the swath it has cleared.
  const behind = { stars: starDust, moon: moonBare };

  const veilDefaults = VEIL_DEFAULTS[theme];

  const moonlitZenith = mixRGB(zenith, hex("#1c2748"), moonLight * 0.45);
  const moonlitHorizon = mixRGB(horizon, hex("#2a3556"), moonLight * 0.35);
  const moonlitLit = mixRGB(lit, hex("#4a5578"), moonLight * (1 - smoothstep(-8, 4, elevation)) * 0.7);

  // The theme's key, last, over every colour the sky is painted from, so the
  // shader, the Gradient and the legibility profile all read the re-keyed sky
  // and never have to know there was another.
  const key = THEME_KEY[theme];
  const keyAmount = themeKeyAmount(theme, elevation);
  const keyed = (c: RGB) => rekey(c, theme, keyAmount);
  // Then the veil the key left, and the exposure, drawn to the twilight look.
  const twilight = twilightLookAmount(theme, elevation);
  const look = toTwilightLook(
    {
      amount: veilDefaults.amount * lerp(1, key.veil, keyAmount),
      exposure: veilDefaults.exposure,
    },
    twilight
  );

  return {
    sun: { ...solar, screen: sunScreen, daylight, isDay: elevation > DAY_ELEVATION_DEG },
    moon: {
      elevation: lunar.elevation,
      azimuth: lunar.azimuth,
      phase: moonPhase,
      illumination: moonIllum,
      visible: moonVisible * lerp(1, key.moon, keyAmount),
      screen: moonScreen,
      size: moonSize,
    },
    hemisphere,
    sky: {
      zenith: keyed(moonlitZenith),
      horizon: keyed(moonlitHorizon),
      glow: rekey(glow, theme, keyAmount * key.glow),
      glowStrength,
    },
    clouds: {
      cover,
      density,
      darkness,
      lit: keyed(moonlitLit),
      shade: keyed(shade),
      speed: 0.35 + windSpeed * 1.4,
    },
    precipitation: { type: precipType, intensity: precipIntensity },
    wind,
    windWorld,
    celestial: celestialOf(params, hemisphere),
    fog,
    lightning: condition === "thunder" ? lightningFor(weather) : 0,
    stars,
    clarity,
    behind,
    veil: {
      color: veilDefaults.color,
      amount: ov.veilAmount ?? look.amount,
    },
    exposure: look.exposure,
    flat: { exposure: lerp(1, look.exposure, twilight), lift: 1 - twilight },
    seed: params.seed ?? 0,
    condition,
    theme,
  };
}

/**
 * Shape a NormalizedWeather (or a devtool override) into scene input.
 *
 * Day/night is never part of this: the effective clock (and the real sun)
 * decides, so a forced condition can't put a moon in a daytime sky. `sunTimes`
 * lets the caller pass the effective day's sunrise/sunset (time travel shifts
 * them) instead of the forecast's.
 */
export function toSceneWeather(
  weather: NormalizedWeather | null | undefined,
  override?: { condition: WeatherCondition } | null,
  sunTimes?: { sunriseMs?: number; sunsetMs?: number }
): SceneWeatherInput | null {
  if (!weather && !override) return null;
  const condition = override?.condition ?? (weather as NormalizedWeather).condition;
  const overrideChangesCondition = !!override && override.condition !== weather?.condition;
  // Real measurements only make sense for the real condition; a forced
  // condition falls back to its profile defaults. Wind is kept: it is the one
  // measurement that reads the same under any sky.
  const real = overrideChangesCondition ? undefined : weather ?? undefined;
  return {
    condition,
    weatherCode: real?.weatherCode,
    cloudCover: real?.cloudCover,
    cloudCoverLow: real?.cloudCoverLow,
    cloudCoverMid: real?.cloudCoverMid,
    cloudCoverHigh: real?.cloudCoverHigh,
    precipitationType: real?.precipitationType,
    precipitationIntensity: real?.precipitationIntensity,
    windSpeedKmh: weather?.windSpeedKmh,
    windGustsKmh: weather?.windGustsKmh,
    windDirectionDeg: weather?.windDirectionDeg,
    humidity: real?.humidity,
    visibilityM: real?.visibilityM,
    temperatureC: real?.temperatureC,
    dewPointC: real?.dewPointC,
    capeJkg: real?.capeJkg,
    sunriseMs: sunTimes ? sunTimes.sunriseMs : weather?.sunriseMs,
    sunsetMs: sunTimes ? sunTimes.sunsetMs : weather?.sunsetMs,
  };
}

/**
 * One day's worth of scene inputs: everything `deriveWeatherScene` needs except
 * the instant. Anything walking a day (the devtool's sky strip, the meteor's
 * window) takes this, so a new scene input is threaded through once.
 */
export interface DaySampleParams {
  /** Any instant of the day to sample; the day is taken from local midnight. */
  dayMs: number;
  lat?: number;
  lon?: number;
  weather: SceneWeatherInput | null;
  theme: "light" | "dark";
  overrides?: SceneOverrides;
  seed?: number;
}

/**
 * The scene at a given minute of one local day.
 *
 * The one way to walk a day, so the things drawn from it cannot disagree about
 * which day it is. Pure and cheap: the ephemeris is a few hundred multiplies.
 */
export function daySceneAt(
  params: DaySampleParams
): (minute: number) => WeatherScene {
  const startMs = startOfLocalDay(params.dayMs);
  return (minute) =>
    deriveWeatherScene({ ...params, nowMs: startMs + minute * 60_000 });
}

/** Scenes per day in `sampleDaySky`: one every twenty minutes. */
const DAY_SKY_SAMPLES = 72;

/**
 * The sky across one day, for a timeline.
 *
 * Scenes from local midnight to midnight, each reduced to one colour (the
 * zenith/horizon mix, unveiled, so it stays vivid at 4px tall), so a devtool
 * can redraw it whenever the condition, the day or the location changes.
 */
export function sampleDaySky(params: DaySampleParams): RGB[] {
  const sceneAt = daySceneAt(params);
  const out: RGB[] = [];
  for (let i = 0; i < DAY_SKY_SAMPLES; i++) {
    const scene = sceneAt(((i + 0.5) / DAY_SKY_SAMPLES) * DAY_MINUTES);
    out.push(mixRGB(scene.sky.zenith, scene.sky.horizon, 0.45));
  }
  return out;
}
