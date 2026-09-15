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
//
// plus the tint: the picture's dominant colour, clamped into a range that can
// colour a surface without shouting, exposed for the Tint setting.
//
// Nothing here decodes an image. `resolveLegibility` is pure and cheap enough
// to run on every render; the provider memoises it anyway.
// =============================================================================

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
  /** Extra reading veil when bare text has flipped. */
  veilAddFlip: number;
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
  veilAddFlip: 0.15,
  tintLightness: { light: [0.5, 0.66], dark: [0.6, 0.76] },
  tintChroma: [0.05, 0.16],
  tintMinChroma: 0.03,
};

/** The OKLab lightness of the ink in each theme (`--ink` in globals.css). */
export const INK_LIGHTNESS: Record<Theme, number> = { light: 0.145, dark: 0.93 };

export interface LegibilityVars {
  /** How busy the picture is, 0..1 — the number most others derive from. */
  busy: number;
  /** How far the picture sits on the wrong side of the card colour, 0..1. */
  conflict: number;
  /** Alpha points added to the ink ladder. */
  inkBoost: number;
  /** Text relief strength, 0..1. Zero means no text-shadow at all. */
  relief: number;
  /** Bare text on the wallpaper flips to the inverse ink. */
  flip: boolean;
  /** Fill points added to every glass token. */
  glassAdd: number;
  /** Alpha added to the reading veil. */
  veilAdd: number;
  /** The wallpaper's tint, clamped for use on a surface. */
  tint: WallpaperTint;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clamp = (n: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, n));
const round = (n: number, places = 2) => Number(n.toFixed(places));

/** No wallpaper worth adapting to: every output at rest. */
export function plainLegibility(theme: Theme): LegibilityVars {
  return resolveLegibility({ profile: getPlainProfile(theme), theme, reading: false });
}

/**
 * The policy, applied.
 *
 * `reading` is whether this route recedes the wallpaper behind a veil (see
 * `lib/reading-surface.ts`); the veil does most of the work there, so relief
 * is scaled back and bare text never flips — there is no bare text on a
 * reading page, only prose over the veil.
 */
export function resolveLegibility(params: {
  profile: WallpaperProfile;
  theme: Theme;
  reading: boolean;
  policy?: LegibilityPolicy;
}): LegibilityVars {
  const { profile, theme, reading } = params;
  const policy = params.policy ?? DEFAULT_LEGIBILITY_POLICY;

  const busy = clamp01(profile.edges / policy.edgesFull);

  // Tone conflict: how far the whole picture sits from where the theme's card
  // wants it. Measured on the frame, not the top band — this is about what
  // surfaces land on, and surfaces are everywhere.
  const safe = policy.toneSafe[theme];
  const worst = policy.toneWorst[theme];
  const conflict = clamp01((profile.lum - safe) / (worst - safe));

  // Bare text sits in the top band. Compare how far each ink is from it and
  // flip only when the inverse is clearly better — a margin, so a mid-tone
  // picture does not flip on a rounding error.
  const top = profile.zones.top;
  const inkL = INK_LIGHTNESS[theme];
  const inverseL = INK_LIGHTNESS[theme === "dark" ? "light" : "dark"];
  const gap = Math.abs(inkL - top);
  const inverseGap = Math.abs(inverseL - top);
  const flip = !reading && inverseGap - gap > policy.flipMargin;
  const effectiveGap = flip ? inverseGap : gap;

  // Relief: from busyness, and from the ink not standing out enough.
  const need =
    1 - clamp01((effectiveGap - policy.reliefGapStart) / (policy.reliefGapFull - policy.reliefGapStart));
  let relief = Math.max(need, busy * policy.reliefBusy);
  if (reading) relief *= policy.reliefReading;
  relief = relief < policy.reliefFloor ? 0 : round(relief);

  const tint = clampTint(profile, theme, policy);

  return {
    busy: round(busy),
    conflict: round(conflict),
    inkBoost: Math.round(Math.max(busy, conflict * 0.7) * policy.inkBoostMax),
    relief,
    flip,
    glassAdd: Math.round(busy * policy.glassAddMax + conflict * policy.glassAddToneMax),
    veilAdd: flip ? policy.veilAddFlip : 0,
    tint,
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
// The variables, as the stylesheet reads them.
// -----------------------------------------------------------------------------

/** CSS custom properties for a resolved policy — inline on <html>, or on any
 *  `.ink-scope` element that wants its own (the lab's gallery tiles). */
export function legibilityCssVars(vars: LegibilityVars): Record<string, string> {
  return {
    "--wp-ink-boost": `${vars.inkBoost}%`,
    "--wp-relief": String(vars.relief),
    "--wp-glass-add": `${vars.glassAdd}%`,
    "--wp-tint-l": String(vars.tint.l),
    "--wp-tint-c": String(vars.tint.c),
    "--wp-tint-h": String(vars.tint.h),
  };
}

export const LEGIBILITY_VAR_NAMES = Object.keys(
  legibilityCssVars(plainLegibility("light")),
);

/**
 * Write the resolved policy onto <html>. One property write per variable and
 * three attributes; nothing re-renders, the stylesheet does the rest.
 */
export function applyLegibility(
  root: HTMLElement,
  vars: LegibilityVars,
  context: { kind: "weather" | "image" | "none"; reading: boolean },
) {
  for (const [name, value] of Object.entries(legibilityCssVars(vars))) {
    root.style.setProperty(name, value);
  }
  root.dataset.wallpaperKind = context.kind;
  root.dataset.wallpaperSurface = context.reading ? "reading" : "desktop";
  if (vars.flip) root.dataset.wallpaperFlip = "";
  else delete root.dataset.wallpaperFlip;
  // The stylesheet keys the text-shadow on this attribute rather than on the
  // strength, so a strength of zero yields `none`, not a transparent shadow.
  if (vars.relief > 0) root.dataset.wallpaperRelief = "";
  else delete root.dataset.wallpaperRelief;
}

// -----------------------------------------------------------------------------
// Contrast estimate — for the lab's readout, not for the page.
// -----------------------------------------------------------------------------

type Rgb = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

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
export const BACKGROUND_RGB: Record<Theme, Rgb> = { light: [255, 255, 255], dark: [26, 26, 26] };
