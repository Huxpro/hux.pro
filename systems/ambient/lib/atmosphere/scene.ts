import { themeKeyFor, type RGB, type WeatherScene } from "../scene";

export type Vec3 = [number, number, number];

/**
 * Atmosphere's uniforms. Every colour is the shared scene's (lib/scene.ts):
 * the Sky's hand-tuned palette, keyed to the theme and lit by the moon, so the
 * two engines paint one sky and differ only in how they render the cloud.
 * Positions are uv with y DOWN (the shader flips where the Sky's math wants up).
 */
export interface SkyScene {
  zenith: Vec3;
  horizon: Vec3;
  /** The sun's glow — the colour that warms the sky around it and the cloud it lights. */
  glow: Vec3;
  glowStrength: number;
  cloudLight: Vec3;
  cloudShade: Vec3;
  sun: [number, number];
  /** Degrees; the sky's glow widens and warms as it falls. */
  sunElevation: number;
  daylight: number;
  cloud: number;
  rain: number;
  snow: number;
  fog: number;
  storm: number;
  /** Screen-space drift: x across, y into the scene (away from the viewer). */
  wind: [number, number];
  moonPhase: number;
  /** Where the moon's disc is, uv with y down, like `sun`. */
  moon: [number, number];
  /** 0..1 how much of the moon there is to see, before anything in front of it. */
  moonVisible: number;
  /** Relative disc size: 1 high in the sky, larger near the horizon. */
  moonSize: number;
  /** 0..1 how dark the night is for stars, before anything in front of them. */
  stars: number;
  /** 0..1 how thick the cloud is for its cover: thin cirrus → dense stratus. */
  density: number;
  /** 0..1 how dark the cloud bases read. */
  darkness: number;
  /** +1 north, −1 south. */
  hemisphere: number;
  /** The theme's exposure, multiplied in under the veil, as the Sky's shader does. */
  exposure: number;
  /** Stable per session: where in the noise the deck and the stars are. */
  seed: number;
}

/** Cyclic or discrete: these jump to the new scene rather than easing to it. */
export const SNAPPED_KEYS = ["moonPhase", "hemisphere", "seed"] as const;
export const clamp = (x: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
const vec = (c: RGB): Vec3 => [c[0], c[1], c[2]];

/**
 * The live scene as Atmosphere's uniforms. Nothing is re-derived: the palette,
 * the sun and moon, the cloud layers and the wind are all the shared scene's,
 * so the two engines never disagree about the weather or the theme. Two
 * things are taken differently, because the volume does work the Sky's decks
 * cannot:
 *
 *   - stars and moon from `behind`, the sky with nothing in front of it. The
 *     Sky dims them by the cover because its decks are pictures; here the
 *     volume and the mist hide them per pixel, so dimming them as well would
 *     count the murk twice (and leave the fog wipe nothing to find). The
 *     theme's dimming of a lifted night's moon is kept.
 *   - the wind into the view as well as across it (`windWorld`): the deck is
 *     a volume, so a northerly carries it toward or away from the viewer.
 */
export function toAtmosphereScene(scene: WeatherScene): SkyScene {
  // The stage looks toward the equator: south in the north, north in the
  // south. Wind blowing away from the viewer carries the deck into the scene.
  const into = -scene.windWorld.north * scene.hemisphere;
  // What the theme's key leaves of the moon: a lifted night's moon is a day moon.
  const keyMoon = themeKeyFor(scene.theme, scene.sun.elevation).moon;
  return {
    zenith: vec(scene.sky.zenith),
    horizon: vec(scene.sky.horizon),
    glow: vec(scene.sky.glow),
    glowStrength: scene.sky.glowStrength,
    cloudLight: vec(scene.clouds.lit),
    cloudShade: vec(scene.clouds.shade),
    sun: [scene.sun.screen.x, 1 - scene.sun.screen.y],
    sunElevation: scene.sun.elevation,
    daylight: scene.sun.daylight,
    cloud: scene.clouds.cover,
    rain: scene.precipitation.type === "rain" ? scene.precipitation.intensity : 0,
    snow: scene.precipitation.type === "snow" ? scene.precipitation.intensity : 0,
    fog: scene.fog,
    storm: scene.lightning,
    wind: [scene.wind.x, into],
    moonPhase: scene.moon.phase,
    moon: [scene.moon.screen.x, 1 - scene.moon.screen.y],
    moonVisible: scene.behind.moon * keyMoon,
    moonSize: scene.moon.size,
    stars: scene.behind.stars,
    density: scene.clouds.density,
    darkness: scene.clouds.darkness,
    hemisphere: scene.hemisphere,
    exposure: scene.exposure,
    seed: scene.seed % 97,
  };
}

const css = (v: Vec3, exposure: number) => `rgb(${v.map(c => Math.round(clamp(c * exposure) * 255)).join(" ")})`;

/** The sky under the volume, for the frame before WebGL and where it is missing or lost. */
export function sceneGradient(scene: SkyScene): string {
  return `linear-gradient(180deg, ${css(scene.zenith, scene.exposure)}, ${css(scene.horizon, scene.exposure)})`;
}

/** The same palette and theme veil used by the canvas, for widget placement. */
export function atmosphereGradient(scene: WeatherScene): string {
  const { color, amount } = scene.veil;
  const veil = `rgb(${color.map(c => Math.round(clamp(c) * 255)).join(" ")} / ${amount})`;
  return `linear-gradient(${veil}, ${veil}), ${sceneGradient(toAtmosphereScene(scene))}`;
}
