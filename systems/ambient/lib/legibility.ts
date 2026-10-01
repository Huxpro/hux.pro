// =============================================================================
// Legibility — the policy that turns a wallpaper profile into CSS variables.
//
// docs/system-legibility.md is the long version. The short one:
//
//   profile (static, measured once)  →  policy (this file, a few multiplies)
//     →  a handful of CSS variables on <html>  →  every token follows
//
// The profile says how bright the wallpaper is where the text sits, how busy
// it is, and what colour it leans. The policy decides four things from that,
// the way iOS decides them for its Home Screen:
//
//   ink boost   Secondary and tertiary text are ink at an alpha (Apple's label
//               ladder). Over a busy picture the same alpha reads weaker, so
//               the ladder gets a few points of alpha back.
//   relief      A text shadow — a dark drop under light ink, a white halo
//               under dark ink — the way Aqua labelled desktop icons and the
//               Home Screen labels bright wallpapers. Strength follows how
//               busy the picture is and how little the ink stands out from it.
//   flip        Bare text (the identifier and greeting, nothing behind them but
//               the picture) flips to the inverse ink when the top band is on
//               the wrong side of the ink — a dark photograph under the light
//               theme. Small elements flip; surfaces adapt (Liquid Glass).
//   glass add   Clear glass over a busy picture gets a few points of fill: the
//               dimming layer Liquid Glass Clear requires under text.
//   lift        On a reading route, the secondary and tertiary rungs climb
//               until they reach a target contrast on the ground they will
//               actually sit on — the picture behind its veil, or the page.
//
// plus the tint: the picture's dominant colour, clamped into a range that can
// colour a surface without shouting, exposed for the Tint setting.
//
// Nothing here decodes an image. `resolveLegibility` is pure and cheap enough
// to run on every render; the provider memoises it anyway.
// =============================================================================

import { oklabToRgb01, PAGE_RGB, relativeLuminance01, rgb01ToOklab } from "./color";
import { mixRGB, scaleRGB, type RGB, type WeatherScene } from "./scene";
import { clamp01 } from "./solar";
import type { WeatherStyle } from "./wallpaper";
import { getPlainProfile, type WallpaperProfile, type WallpaperTint } from "./wallpaper-profile";

export type Theme = "light" | "dark";

/**
 * The policy's knobs. These are the *design* decisions; the Legibility Lab
 * exposes every one as a slider and shows when a live value differs.
 */
export interface LegibilityPolicy {
  /** `edges` at which a wallpaper counts as fully busy. Zebra is 0.12. */
  edgesFull: number;
  /** Alpha points added to the ink ladder at full busyness. */
  inkBoostMax: number;
  /**
   * Alpha points a *bare* zone gains on top of that at full busyness. Text
   * with nothing but the picture behind it — the header, the labels under
   * the app icons — has no fill helping it, so its secondary rung climbs
   * toward solid the busier the picture gets (iOS paints Home Screen labels
   * at full white); text on glass keeps the ordinary boost.
   */
  bareBoostMax: number;
  /** Relief strength a fully busy picture earns on its own. */
  reliefBusy: number;
  /** Ink-to-backdrop lightness gap below which relief starts to be needed. */
  reliefGapStart: number;
  /** Gap at which the need is fully satisfied (no relief from contrast). */
  reliefGapFull: number;
  /** Relief multiplier on reading pages, where the veil already helps. */
  reliefReading: number;
  /** Below this, relief rounds to none (and the text-shadow to `none`). */
  reliefFloor: number;
  /** Fill points added to glass at full busyness (Clear's dimming layer). */
  glassAddMax: number;
  /**
   * Fill points added when the picture is on the wrong side of the card — a
   * dark photograph under the light theme's white card lands on mid grey,
   * where dark ink has nothing to stand on. The other half of the dimming
   * layer: busyness is one reason a Clear surface needs fill, tone is the other.
   */
  glassAddToneMax: number;
  /** Picture lightness at which the tone conflict is nil, per theme. */
  toneSafe: Record<Theme, number>;
  /** Picture lightness at which the tone conflict is total, per theme. */
  toneWorst: Record<Theme, number>;
  /** How much better the inverse ink must contrast before bare text flips. */
  flipMargin: number;
  /**
   * Head start for the light ink in that comparison. Light text carries a
   * dark drop, dark text a white halo, and a drop reads on far more grounds
   * than a halo (Aqua and the Lock Screen both reach for white-with-shadow
   * over a photograph). The halo only fails on texture, though — on a calm
   * mid-tone picture (the dew drop) dark ink with a halo reads fine and the
   * theme's ink should stay — so the head start grows with busyness:
   * `dropBias × √busy`. At full busyness the light theme flips at a band
   * below ~0.59 and the dark theme flips back to dark ink only above ~0.74;
   * on a calm picture both behave as the plain margin.
   */
  dropBias: number;
  /**
   * The reading treatment. A photograph behind a prose column is a competing
   * figure, so reading routes recede it behind a veil of the page colour and
   * a defocus. Both start from a per-theme base and grow with busyness and
   * tone conflict — a raked-sand picture, or a dark one under the light
   * theme, needs more of each than a calm gradient.
   */
  veilBase: Record<Theme, number>;
  /** Veil alpha added at full busyness. */
  veilBusy: number;
  /** Veil alpha added at full tone conflict. */
  veilConflict: number;
  /** The veil never exceeds this — some picture must remain. */
  veilMax: number;
  /** Defocus radius in px on a calm picture. */
  blurBase: number;
  /** Defocus radius added at full busyness. */
  blurBusy: number;
  /**
   * The contrast the secondary rung must reach on a reading route (WCAG 2;
   * 4.5 is AA for body-sized text). Its alpha is lifted until it does,
   * measured against the backdrop it sits on there: the picture's mean and
   * its worst band, behind the veil. Never lowered — a rung that already
   * clears it keeps its alpha.
   */
  readingSecondaryContrast: number;
  /** The same for the tertiary rung: 3 is AA for large text and UI marks. */
  readingTertiaryContrast: number;
  /**
   * The most alpha the lift may take each rung to. A rung lifted all the way
   * to the ink is no longer a rung: the hierarchy is the reason there is a
   * ladder at all, so where reaching the target would cost it, the lift stops
   * here and what is left is the ground's to fix — the veil's, not the ink's.
   */
  readingSecondaryMax: number;
  readingTertiaryMax: number;
  /**
   * The re-key of a defocused picture on a reading route, per theme — the
   * Sky's answer (`THEME_KEY` in scene.ts, #277) for a photograph. A veil
   * mixes toward the page colour, so it can only grey a picture out; the key
   * keeps the hue and moves the lightness into the theme's range,
   * `L' = floor + span · L`, with `chroma` of the colour kept. The picture's
   * bright patches under the dark theme and dark ones under the light theme
   * are what stood between the column and its contrast, and the key takes
   * them out without taking the colour.
   */
  readingKey: Record<Theme, { floor: number; span: number; chroma: number }>;
  /** What is left of the veil over a keyed picture: the key did most of it. */
  readingKeyVeil: number;
  /** OKLCH lightness range a tint is clamped into, per theme. */
  tintLightness: Record<Theme, [number, number]>;
  /** OKLCH chroma range a tint is clamped into. */
  tintChroma: [number, number];
  /** Pictures with less mean chroma than this are treated as grey. */
  tintMinChroma: number;
}

export const DEFAULT_LEGIBILITY_POLICY: LegibilityPolicy = {
  edgesFull: 0.06,
  inkBoostMax: 14,
  bareBoostMax: 20,
  reliefBusy: 0.85,
  reliefGapStart: 0.25,
  reliefGapFull: 0.55,
  reliefReading: 0,
  reliefFloor: 0.1,
  glassAddMax: 14,
  glassAddToneMax: 22,
  toneSafe: { light: 0.62, dark: 0.45 },
  toneWorst: { light: 0.22, dark: 0.85 },
  flipMargin: 0.15,
  dropBias: 0.25,
  veilBase: { light: 0.32, dark: 0.4 },
  veilBusy: 0.15,
  veilConflict: 0.15,
  veilMax: 0.7,
  blurBase: 28,
  blurBusy: 16,
  readingSecondaryContrast: 4.5,
  readingTertiaryContrast: 3,
  readingSecondaryMax: 0.8,
  readingTertiaryMax: 0.6,
  // Light: 0.55–0.97, dark: 0.05–0.47 — the picture's whole range pressed
  // into the theme's side of the page, with 85% of its colour.
  readingKey: {
    light: { floor: 0.55, span: 0.42, chroma: 0.85 },
    dark: { floor: 0.05, span: 0.42, chroma: 0.85 },
  },
  readingKeyVeil: 0.5,
  tintLightness: { light: [0.5, 0.66], dark: [0.6, 0.76] },
  tintChroma: [0.05, 0.16],
  tintMinChroma: 0.03,
};

/** The OKLab lightness of the ink in each theme (`--ink` in globals.css). */
export const INK_LIGHTNESS: Record<Theme, number> = { light: 0.145, dark: 0.93 };

/**
 * The label rungs' alphas in each theme (`--ink-alpha-*` in globals.css), so
 * the lift knows what it is lifting from. Keep in step with the stylesheet.
 */
export const INK_ALPHA: Record<Theme, { secondary: number; tertiary: number }> = {
  light: { secondary: 0.54, tertiary: 0.32 },
  dark: { secondary: 0.6, tertiary: 0.36 },
};

export interface LegibilityVars {
  /** How busy the picture is, 0..1 — the number most others derive from. */
  busy: number;
  /** How far the picture sits on the wrong side of the card colour, 0..1. */
  conflict: number;
  /** Alpha points added to the ink ladder. */
  inkBoost: number;
  /** Alpha points a bare zone adds on top of `inkBoost`. */
  bareBoost: number;
  /** Text relief strength, 0..1. Zero means no text-shadow at all. */
  relief: number;
  /** Bare text in the top band (the home header) flips to the inverse ink. */
  flip: boolean;
  /** Bare text in the middle band (the app folder's labels) flips. */
  flipMid: boolean;
  /** Fill points added to every glass token. */
  glassAdd: number;
  /** Alpha of the page-coloured veil over the picture on a reading route. */
  veil: number;
  /** Defocus radius, px, of the picture on a reading route. */
  blur: number;
  /**
   * The re-key as the stylesheet applies it: `contrast(c) brightness(b)
   * saturate(s)` on the defocused picture. Identity (1, 1, 1) unless the
   * picture is keyed.
   */
  key: { b: number; c: number; s: number };
  /**
   * Alpha points the secondary and tertiary rungs gain on a reading route,
   * on top of `inkBoost`, to reach the policy's target contrast. Zero on the
   * desktop.
   */
  lift: { secondary: number; tertiary: number };
  /** The wallpaper's tint, clamped for use on a surface. */
  tint: WallpaperTint;
}

const clamp = (n: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, n));
const round = (n: number, places = 2) => Number(n.toFixed(places));

/**
 * No wallpaper worth adapting to: every output at rest — bar the lift on a
 * reading route, which the plain page needs as well (tertiary is 2.2:1 on
 * white).
 */
export function plainLegibility(theme: Theme, reading = false): LegibilityVars {
  return resolveLegibility({ profile: getPlainProfile(theme), theme, reading });
}

/**
 * The policy, applied.
 *
 * `reading` is whether this route recedes the wallpaper behind a veil (see
 * `lib/reading-surface.ts`); the veil does most of the work there, so relief
 * is scaled back and bare text never flips — there is no bare text on a
 * reading page, only prose over the veil. `veiled` is whether that veil is
 * drawn (the Reading dim switch); the lift measures the ground with or
 * without it.
 */
export function resolveLegibility(params: {
  profile: WallpaperProfile;
  theme: Theme;
  reading: boolean;
  veiled?: boolean;
  /** The picture is re-keyed: a defocused picture on a reading route. */
  keyed?: boolean;
  policy?: LegibilityPolicy;
}): LegibilityVars {
  const { profile, theme, reading, veiled = true } = params;
  const keyed = reading && (params.keyed ?? false);
  const policy = params.policy ?? DEFAULT_LEGIBILITY_POLICY;

  const busy = clamp01(profile.edges / policy.edgesFull);

  // Tone conflict: how far the whole picture sits from where the theme's card
  // wants it. Measured on the frame, not the top band — this is about what
  // surfaces land on, and surfaces are everywhere.
  const safe = policy.toneSafe[theme];
  const worst = policy.toneWorst[theme];
  const conflict = clamp01((profile.lum - safe) / (worst - safe));

  // Bare text sits in two bands: the header in the top one, the app folder's
  // labels in the middle one. For each, compare how far each ink is from the
  // band — the light ink with its head start, since its drop is the stronger
  // relief — and flip only when the inverse is clearly better: a margin, so
  // a picture does not flip on a rounding error.
  const inkL = INK_LIGHTNESS[theme];
  const inverseL = INK_LIGHTNESS[theme === "dark" ? "light" : "dark"];
  const bias = policy.dropBias * Math.sqrt(busy);
  const score = (ink: number, band: number) => Math.abs(ink - band) + (ink > 0.5 ? bias : 0);
  const flips = (band: number) =>
    !reading && score(inverseL, band) - score(inkL, band) > policy.flipMargin;
  const top = profile.zones.top;
  const flip = flips(top);
  const flipMid = flips(profile.zones.mid);
  const effectiveGap = Math.abs((flip ? inverseL : inkL) - top);

  // Relief: from busyness, and from the ink not standing out enough.
  const need =
    1 - clamp01((effectiveGap - policy.reliefGapStart) / (policy.reliefGapFull - policy.reliefGapStart));
  let relief = Math.max(need, busy * policy.reliefBusy);
  if (reading) relief *= policy.reliefReading;
  relief = relief < policy.reliefFloor ? 0 : round(relief);

  const tint = clampTint(profile, theme, policy);
  const inkBoost = Math.round(Math.max(busy, conflict * 0.7) * policy.inkBoostMax);
  const key = keyed ? keyFilter(policy.readingKey[theme]) : IDENTITY_KEY;
  const veil = round(
    Math.min(policy.veilMax, policy.veilBase[theme] + busy * policy.veilBusy + conflict * policy.veilConflict) *
      (keyed ? policy.readingKeyVeil : 1),
  );

  return {
    busy: round(busy),
    conflict: round(conflict),
    inkBoost,
    bareBoost: reading ? 0 : Math.round(busy * policy.bareBoostMax),
    relief,
    flip,
    flipMid,
    glassAdd: Math.round(busy * policy.glassAddMax + conflict * policy.glassAddToneMax),
    veil,
    blur: Math.round(policy.blurBase + busy * policy.blurBusy),
    tint,
    key,
    lift: reading
      ? readingLift({ profile, theme, inkBoost, veil: veiled ? veil : 0, key, policy })
      : { secondary: 0, tertiary: 0 },
  };
}

// -----------------------------------------------------------------------------
// The reading lift
//
// The label ladder is Apple's, and Apple tunes it for an opaque ground: on
// white the secondary rung is 4.3:1 and the tertiary 2.2:1. Behind a reading
// column the ground is the picture through a veil, which takes a few more
// points off — so on a reading route each rung is lifted until it reaches
// the policy's target on that ground. The ground is known: the profile has
// the picture's mean colour and its bands' lightness, and the veil is ours.
// So this is arithmetic, not sampling: the alpha at which the ink, composited
// over the veiled picture, clears the target — against the mean and against
// the worst band (the darkest under dark ink, the brightest under light), the
// larger of the two. The blur is what makes a mean honest here: at 28px and
// up, what is behind a line of text is a region's average, not its detail.
// -----------------------------------------------------------------------------

type Rgb01 = readonly [number, number, number];

const IDENTITY_KEY = { b: 1, c: 1, s: 1 } as const;

/**
 * `L' = floor + span · L` as the stylesheet can say it. CSS filter functions
 * act on sRGB values: `contrast(c)` is `c·(x − ½) + ½` and `brightness(b)`
 * multiplies, so together `b·c·x + b·(1 − c)/2` — an affine map with slope
 * `b·c = span` and offset `b·(1 − c)/2 = floor`. Both scale a colour's
 * channel differences by `span` too, so `saturate(chroma / span)` gives back
 * all but `chroma` of it. sRGB value stands in for OKLab lightness; on a
 * picture blurred past 28px the difference is not one anyone can see.
 */
function keyFilter({ floor, span, chroma }: { floor: number; span: number; chroma: number }) {
  const b = 2 * floor + span;
  return { b: round(b, 3), c: round(span / b, 3), s: round(chroma / span, 3) };
}

/** What the re-key does to one colour, for the lift's estimate of the ground. */
function applyKey(rgb: Rgb01, { b, c, s }: { b: number; c: number; s: number }): Rgb01 {
  const [r, g, bl] = rgb.map((x) => clamp01(b * (c * (x - 0.5) + 0.5)));
  // saturate(s), the Filter Effects matrix.
  return [
    clamp01((0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * bl),
    clamp01((0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * bl),
    clamp01((0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * bl),
  ];
}

const mix01 = (over: Rgb01, alpha: number, under: Rgb01): Rgb01 =>
  [0, 1, 2].map((i) => over[i] * alpha + under[i] * (1 - alpha)) as unknown as Rgb01;

const contrast01 = (a: Rgb01, b: Rgb01) => {
  const la = relativeLuminance01(a);
  const lb = relativeLuminance01(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const grey01 = (L: number) => oklabToRgb01({ L, a: 0, b: 0 }) as Rgb01;

/** The least alpha of `ink` over `ground` that reaches `target`; 1 if none does. */
function alphaFor(target: number, ink: Rgb01, ground: Rgb01): number {
  if (contrast01(ink, ground) < target) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (contrast01(mix01(ink, mid, ground), ground) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

function readingLift(params: {
  profile: WallpaperProfile;
  theme: Theme;
  inkBoost: number;
  veil: number;
  key: { b: number; c: number; s: number };
  policy: LegibilityPolicy;
}): { secondary: number; tertiary: number } {
  const { profile, theme, inkBoost, veil, key, policy } = params;
  const ink = grey01(INK_LIGHTNESS[theme]);
  const page = PAGE_RGB01[theme];
  const zones = [profile.zones.top, profile.zones.mid, profile.zones.bottom];
  const worstBand = theme === "light" ? Math.min(...zones) : Math.max(...zones);
  const [r, g, b] = profile.mean;
  const grounds = [[r / 255, g / 255, b / 255] as const, grey01(worstBand)].map((picture) =>
    mix01(page, veil, applyKey(picture, key)),
  );

  const lift = (base: number, target: number, max: number) => {
    const have = Math.round(base * 100) + inkBoost;
    const need = Math.max(...grounds.map((ground) => alphaFor(target, ink, ground)));
    return Math.max(0, Math.min(Math.round(max * 100), Math.ceil(need * 100)) - have);
  };

  return {
    secondary: lift(INK_ALPHA[theme].secondary, policy.readingSecondaryContrast, policy.readingSecondaryMax),
    tertiary: lift(INK_ALPHA[theme].tertiary, policy.readingTertiaryContrast, policy.readingTertiaryMax),
  };
}

/**
 * The picture's dominant colour, made safe for a surface.
 *
 * A wallpaper's own tint is whatever it is — near-black on Earth, pastel on a
 * snowfield. A surface tinted with it wants a mid lightness and a chroma that
 * reads as colour without becoming a highlighter, so both are clamped (ryOS
 * does the same in HSL). A grey picture yields a grey tint, which at any
 * amount changes nothing — the neutral baseline, by construction.
 */
function clampTint(profile: WallpaperProfile, theme: Theme, policy: LegibilityPolicy): WallpaperTint {
  const source = profile.tint;
  if (!source || profile.chroma < policy.tintMinChroma) {
    return { l: clamp(0.6, policy.tintLightness[theme]), c: 0, h: source?.h ?? 0 };
  }
  return {
    l: round(clamp(source.l, policy.tintLightness[theme]), 3),
    c: round(clamp(source.c, policy.tintChroma), 3),
    h: source.h,
  };
}

// -----------------------------------------------------------------------------
// A profile from the live sky
//
// The Sky and the Gradient are not files: the scene is derived every minute
// from the sun, the moon and the weather (lib/scene.ts), and the shader paints
// it. There is nothing to measure at build time — but there is nothing to
// measure at runtime either, because the scene already *is* the description
// of the picture: its sky colours, its cloud cover, its rain. This reads a
// profile straight off those numbers, in the same shape the profiler writes
// for a photograph, so the policy needs no second path. A few dozen
// multiplies, once per scene change; no canvas is ever sampled.
//
// Classic keeps its static table: its palettes are fixed strings, measured by
// the profiler like everything else.
// -----------------------------------------------------------------------------

const PAGE_RGB01: Record<Theme, RGB> = {
  light: PAGE_RGB.light.map((c) => c / 255) as unknown as RGB,
  dark: PAGE_RGB.dark.map((c) => c / 255) as unknown as RGB,
};

/**
 * What the profiler would have measured, had the sky been a file.
 *
 *   zones     the veiled zenith (top), the zenith/horizon mix (middle) and the
 *             veiled horizon (bottom), each with the sun's glow where the sun
 *             is — then composited over the page at the layer's opacity, since
 *             the Gradient and Classic paint as a wash.
 *   edges     what the shader adds that a gradient has not: cloud texture,
 *             rain or snow streaks, fog grain, stars. The Gradient is smooth,
 *             so its detail is nil; the Sky under a storm reaches about half
 *             of Zebra.
 *   tint      the sky's own colour, from the middle band.
 */
export function profileFromScene(params: {
  scene: WeatherScene;
  style: WeatherStyle;
  /** The layer's opacity over the page (1 for the Sky, the wash below it). */
  opacity: number;
  theme: Theme;
}): WallpaperProfile {
  const { scene, style, opacity, theme } = params;
  const veil = (c: RGB) =>
    mixRGB(scaleRGB(c, scene.flat.exposure), scene.veil.color, scene.veil.amount);
  const page = PAGE_RGB01[theme];
  const over = (c: RGB) => mixRGB(page, c, opacity);

  const glow = scene.sky.glowStrength * 0.6;
  const sunHigh = scene.sun.screen.y > 0.55 ? glow : glow * 0.35;
  const top = over(veil(mixRGB(scene.sky.zenith, scene.sky.glow, sunHigh)));
  const mid = over(veil(mixRGB(mixRGB(scene.sky.zenith, scene.sky.horizon, 0.55), scene.sky.glow, glow * 0.5)));
  const bottom = over(veil(mixRGB(scene.sky.horizon, scene.sky.glow, scene.sun.screen.y < 0.4 ? glow : glow * 0.3)));

  const [lt, lm, lb] = [top, mid, bottom].map((c) => rgb01ToOklab(c));
  const lum = (lt.L + lm.L + lb.L) / 3;
  const contrast = Math.sqrt(((lt.L - lum) ** 2 + (lm.L - lum) ** 2 + (lb.L - lum) ** 2) / 3);

  const shader = style === "sky";
  const clouds = scene.clouds.cover * scene.clouds.density;
  const edges = shader
    ? 0.012 * clouds +
      0.03 * scene.precipitation.intensity +
      0.008 * (scene.fog > 0.2 ? scene.fog : 0) +
      0.004 * scene.stars +
      0.02 * scene.lightning
    : 0;

  const chroma = Math.hypot(lm.a, lm.b);
  const tint: WallpaperTint | null =
    chroma > 0.01
      ? {
          l: round(lm.L, 3),
          c: round(chroma, 3),
          h: round(((Math.atan2(lm.b, lm.a) * 180) / Math.PI + 360) % 360, 1),
        }
      : null;

  return {
    lum: round(lum, 3),
    zones: { top: round(lt.L, 3), mid: round(lm.L, 3), bottom: round(lb.L, 3) },
    mean: mid.map((c) => Math.round(c * 255)) as [number, number, number],
    contrast: round(contrast, 3),
    edges: round(edges, 4),
    chroma: round(chroma, 3),
    tint,
  };
}

// -----------------------------------------------------------------------------
// The variables, as the stylesheet reads them.
// -----------------------------------------------------------------------------

/** CSS custom properties for a resolved policy — inline on <html>, or on any
 *  `.ink-scope` element that wants its own (the lab's gallery tiles). */
export function legibilityCssVars(vars: LegibilityVars): Record<string, string> {
  return {
    "--wp-ink-boost": `${vars.inkBoost}%`,
    "--wp-bare-boost": `${vars.bareBoost}%`,
    "--wp-relief": String(vars.relief),
    "--wp-glass-add": `${vars.glassAdd}%`,
    "--wp-tint-l": String(vars.tint.l),
    "--wp-tint-c": String(vars.tint.c),
    "--wp-tint-h": String(vars.tint.h),
    "--wp-veil": String(vars.veil),
    "--wp-blur": `${vars.blur}px`,
    "--wp-key-b": String(vars.key.b),
    "--wp-key-c": String(vars.key.c),
    "--wp-key-s": String(vars.key.s),
    "--wp-lift-secondary": `${vars.lift.secondary}%`,
    "--wp-lift-tertiary": `${vars.lift.tertiary}%`,
  };
}

/** Whether two resolutions would write the same thing. */
export function sameVars(a: LegibilityVars, b: LegibilityVars): boolean {
  return (
    a.inkBoost === b.inkBoost &&
    a.bareBoost === b.bareBoost &&
    a.relief === b.relief &&
    a.glassAdd === b.glassAdd &&
    a.veil === b.veil &&
    a.blur === b.blur &&
    a.key.b === b.key.b &&
    a.key.c === b.key.c &&
    a.key.s === b.key.s &&
    a.lift.secondary === b.lift.secondary &&
    a.lift.tertiary === b.lift.tertiary &&
    a.flip === b.flip &&
    a.flipMid === b.flipMid &&
    a.tint.l === b.tint.l &&
    a.tint.c === b.tint.c &&
    a.tint.h === b.tint.h
  );
}

const lastApplied = new WeakMap<HTMLElement, { vars: LegibilityVars; kind: string; reading: boolean }>();

/**
 * Write the resolved policy onto <html>. One property write per variable and
 * three attributes; nothing re-renders, the stylesheet does the rest. A write
 * of what is already there is skipped: a custom property set on the root
 * invalidates every inherited ladder below it, and under the Sky the scene
 * (and so the resolution's identity) refreshes every minute.
 */
export function applyLegibility(
  root: HTMLElement,
  vars: LegibilityVars,
  context: { kind: "weather" | "image" | "none"; reading: boolean },
) {
  const last = lastApplied.get(root);
  if (last && last.kind === context.kind && last.reading === context.reading && sameVars(last.vars, vars)) return;
  lastApplied.set(root, { vars, kind: context.kind, reading: context.reading });
  for (const [name, value] of Object.entries(legibilityCssVars(vars))) {
    root.style.setProperty(name, value);
  }
  root.dataset.wallpaperKind = context.kind;
  root.dataset.wallpaperSurface = context.reading ? "reading" : "desktop";
  if (vars.flip) root.dataset.wallpaperFlip = "";
  else delete root.dataset.wallpaperFlip;
  if (vars.flipMid) root.dataset.wallpaperFlipMid = "";
  else delete root.dataset.wallpaperFlipMid;
  // The stylesheet keys the text-shadow on this attribute rather than on the
  // strength, so a strength of zero yields `none`, not a transparent shadow.
  if (vars.relief > 0) root.dataset.wallpaperRelief = "";
  else delete root.dataset.wallpaperRelief;
}

// -----------------------------------------------------------------------------
// Contrast estimate — for the lab's readout, not for the page.
// -----------------------------------------------------------------------------

type Rgb = [number, number, number];

const relativeLuminance = ([r, g, b]: Rgb) => relativeLuminance01([r / 255, g / 255, b / 255]);

/** `over` at `alpha` composited on `under`, in sRGB bytes. */
export function composite(over: Rgb, alpha: number, under: Rgb): Rgb {
  return [0, 1, 2].map((i) => Math.round(over[i] * alpha + under[i] * (1 - alpha))) as Rgb;
}

/** WCAG 2 contrast ratio between two opaque colours. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return round((hi + 0.05) / (lo + 0.05), 2);
}

/** The sRGB bytes of the theme's ink and page, matching globals.css. */
export const INK_RGB: Record<Theme, Rgb> = { light: [23, 23, 23], dark: [230, 230, 230] };
export const CARD_RGB: Record<Theme, Rgb> = { light: [255, 255, 255], dark: [22, 22, 22] };
export const BACKGROUND_RGB: Record<Theme, Rgb> = {
  light: [...PAGE_RGB.light],
  dark: [...PAGE_RGB.dark],
};
