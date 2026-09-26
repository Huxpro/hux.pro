"use client";

import { useSyncExternalStore } from "react";
import { GLOW_STOPS } from "./palette";
import { glowTuning, subscribeGlowTuning } from "./tuning";

// =============================================================================
// The glow's colours, from the wallpaper — in harmony with it.
//
// The light was one fixed palette, Siri's. Over a wallpaper it can instead be
// drawn from the picture: its dominant colour (the ambient system's profile,
// `tint` — a photograph's measured once, the Sky's read off the live scene)
// sets a base hue, and a colour-wheel rule picks the light's hues from it, so
// the glow belongs to the picture instead of sitting on it.
//
//   analogous       base −32°, base, base +32°: neighbours on the wheel, the
//                   calmest harmony — the light is the picture's own colour,
//                   lit
//   complementary   base, base +24°, base +180°: the picture's colour and its
//                   opposite, the strongest contrast
//   split           base, base +150°, base +210°: the opposite's two
//                   neighbours — contrast without the clash
//   triadic         base, +120°, +240°: evenly round the wheel, the liveliest
//   auto            by the picture: a colourful one (chroma ≥ 0.08) gets
//                   analogous — a vivid picture wants its light to agree; a
//                   muted one gets split — a little colour it does not have; a
//                   grey one (no tint) keeps Siri's palette
//   siri            the fixed palette, whatever the wallpaper
//
// Hues are OKLCH, so "32° apart" is 32° as the eye sees it. Every hue is
// drawn at one lightness and chroma (per theme: lighter in the dark), the
// chroma lowered until the colour fits in sRGB — the three hues read as
// equals, and none clips. Three hues become the shader's five stops as a
// loop (a b c b' a', the returns a touch lighter and darker), so the ring
// passes through each twice as it goes round.
//
// When the wallpaper or the rule changes, the light eases to the new colours
// over a second and a half; nothing is re-rendered, the renderer reads the
// palette every frame (`glowPalette`).
// =============================================================================

export type GlowHarmony = "auto" | "analogous" | "complementary" | "split" | "triadic" | "siri";

export const GLOW_HARMONIES: readonly GlowHarmony[] = [
  "auto",
  "analogous",
  "complementary",
  "split",
  "triadic",
  "siri",
];

/** The wallpaper's dominant colour, OKLCH — or null for a grey picture. */
export interface GlowSource {
  h: number;
  c: number;
}

type Rgb = readonly [number, number, number];

// -----------------------------------------------------------------------------
// Colour
// -----------------------------------------------------------------------------

const gamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);

/** OKLCH → sRGB 0–1, unclamped (out of gamut when any channel leaves 0–1). */
function oklch(l: number, c: number, h: number): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gamma(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    gamma(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    gamma(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

const inGamut = ([r, g, b]: Rgb) => [r, g, b].every((x) => x >= -0.001 && x <= 1.001);

/** The colour at this lightness and hue, as vivid as sRGB allows up to `c`. */
function glowColour(l: number, c: number, h: number): Rgb {
  let lo = 0;
  let hi = c;
  if (inGamut(oklch(l, hi, h))) lo = hi;
  else {
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklch(l, mid, h))) lo = mid;
      else hi = mid;
    }
  }
  const [r, g, b] = oklch(l, lo, h);
  const k = (x: number) => Math.min(1, Math.max(0, x));
  return [k(r), k(g), k(b)];
}

// -----------------------------------------------------------------------------
// Harmony
// -----------------------------------------------------------------------------

/** The rule a wallpaper gets under `auto`. */
export function autoHarmony(source: GlowSource | null): Exclude<GlowHarmony, "auto"> {
  if (!source) return "siri";
  return source.c >= 0.08 ? "analogous" : "split";
}

/** The three hues a rule picks from a base hue, degrees. */
export function harmonyHues(rule: Exclude<GlowHarmony, "auto" | "siri">, h: number): number[] {
  const offsets = {
    analogous: [-32, 0, 32],
    complementary: [0, 24, 180],
    split: [0, 150, 210],
    triadic: [0, 120, 240],
  }[rule];
  return offsets.map((o) => (((h + o) % 360) + 360) % 360);
}

/** The five stops, loop order, for a rule and a picture, in one theme. */
export function harmonyStops(
  harmony: GlowHarmony,
  source: GlowSource | null,
  dark: boolean,
): readonly Rgb[] {
  const rule = harmony === "auto" ? autoHarmony(source) : harmony;
  if (rule === "siri" || !source) return GLOW_STOPS;
  const [a, b, c] = harmonyHues(rule, source.h);
  // Light and vivid in the dark, where the glow adds up; a step deeper in
  // the light theme, where it tints.
  const L = dark ? 0.74 : 0.68;
  const C = 0.16;
  return [
    glowColour(L, C, a),
    glowColour(L, C, b),
    glowColour(L, C, c),
    glowColour(L + 0.05, C * 0.9, b),
    glowColour(L - 0.04, C, a),
  ];
}

// -----------------------------------------------------------------------------
// The store: the picture, the rule, and the palette easing between them
// -----------------------------------------------------------------------------

let source: GlowSource | null = null;
const listeners = new Set<() => void>();
const EASE_MS = 1500;

interface Palette {
  dark: Float32Array;
  light: Float32Array;
}

const flat = (stops: readonly Rgb[]) => new Float32Array(stops.flat());

function targetPalette(): Palette {
  const h = glowTuning().harmony;
  return { dark: flat(harmonyStops(h, source, true)), light: flat(harmonyStops(h, source, false)) };
}

let from: Palette = targetPalette();
let to: Palette = from;
let since = 0;
const current: Palette = { dark: new Float32Array(15), light: new Float32Array(15) };

function retarget() {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  // Ease from wherever the light is now, not from the last target.
  from = { dark: current.dark.slice(), light: current.light.slice() };
  to = targetPalette();
  since = now;
  listeners.forEach((l) => l());
}

/** Publish the wallpaper's dominant colour (null for a grey picture). */
export function setGlowSource(next: GlowSource | null) {
  if (next === source || (next && source && next.h === source.h && next.c === source.c)) return;
  source = next;
  retarget();
}

if (typeof window !== "undefined") subscribeGlowTuning(() => {
  const next = targetPalette();
  if (next.dark.every((v, i) => v === to.dark[i])) return;
  retarget();
});

/**
 * The palette for this frame: the five stops as 15 floats, eased toward the
 * current target. `moving` while the ease runs, so the renderer redraws a
 * held frame.
 */
export function glowPalette(now: number, dark: boolean): { stops: Float32Array; moving: boolean } {
  const k = Math.min(1, (now - since) / EASE_MS);
  const e = k * k * (3 - 2 * k);
  const out = dark ? current.dark : current.light;
  const a = dark ? from.dark : from.light;
  const b = dark ? to.dark : to.light;
  for (let i = 0; i < 15; i++) out[i] = a[i] + (b[i] - a[i]) * e;
  return { stops: out, moving: k < 1 };
}

// The first frame starts from the target, not from black.
current.dark.set(to.dark);
current.light.set(to.light);

/** Called when the palette starts easing somewhere new. */
export function subscribeGlowPalette(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The published picture and the rule it gets, for the devtool's swatches. */
export function useGlowPaletteState(): { source: GlowSource | null; to: Palette } {
  const snap = useSyncExternalStore(
    subscribeGlowPalette,
    () => to,
    () => to,
  );
  return { source, to: snap };
}

/** A stop as CSS, for swatches. */
export function stopCss(p: Float32Array, i: number): string {
  const c = (x: number) => Math.round(x * 255);
  return `rgb(${c(p[i * 3])} ${c(p[i * 3 + 1])} ${c(p[i * 3 + 2])})`;
}
