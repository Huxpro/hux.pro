"use client";

import { useSyncExternalStore } from "react";

// =============================================================================
// The glow's ground — what the light is laid on, measured.
//
// The light used to know one thing about its ground: the theme (`uDark`). But
// what sits under a glow is the theme's page, or a wallpaper, under whatever
// surfaces the host is — a veil at 70%, Clear glass at 20%, a card, a tint —
// and the light has to read on that, not on the theme's idea of it. The
// legibility system already answers the same question for text
// (docs/system-legibility.md), in the same two halves, and this borrows both:
//
//   the picture   what paints under everything: its lightness by third of
//                 the screen and how busy it is — the wallpaper's profile,
//                 which for the plain page is the page itself. Published by
//                 the ambient provider (`setGlowGround`), once per change.
//   the surfaces  what the host is made of: every ancestor's computed
//                 background colour, composited front to back until opaque —
//                 so Tinted and Clear glass, a wallpaper tint, a veil and a
//                 card are measured, not listed. A backdrop blur on the way
//                 down calms the picture's texture.
//
// A glow's ground is then one lightness per edge (right, bottom, left, top):
// the surfaces' lightness over the picture's at that edge's height, by how
// much of it they cover — plus the picture's busyness, by how much of it
// shows. The shader turns lightness into how the light composites (added up
// on a dark ground, tinting a light one) and busyness into relief (a firmer
// core line, a little more light), as the legibility system turns them into
// ink alphas and text shadows.
//
// Measured when something changes — the picture, the theme, the glass (any
// class, style or data attribute on <html>), the host's size — never per
// frame.
// =============================================================================

export interface GlowGroundSource {
  /** OKLab lightness of what paints under everything, by third of the screen. */
  zones: { top: number; mid: number; bottom: number };
  /** How busy that picture is, 0–1 (legibility's `busy`). */
  busy: number;
}

export interface GlowGround {
  /** Lightness under each edge, 0–1: right, bottom, left, top. */
  edges: readonly [number, number, number, number];
  /** How much of the picture's busyness reaches the light, 0–1. */
  busy: number;
}

let source: GlowGroundSource | null = null;
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;
let queued = 0;

function notify() {
  if (queued) return;
  queued = requestAnimationFrame(() => {
    queued = 0;
    listeners.forEach((l) => l());
  });
}

/** Publish what paints under everything. Cheap to call with the same numbers. */
export function setGlowGround(next: GlowGroundSource) {
  if (
    source &&
    source.busy === next.busy &&
    source.zones.top === next.zones.top &&
    source.zones.mid === next.zones.mid &&
    source.zones.bottom === next.zones.bottom
  ) {
    return;
  }
  source = next;
  notify();
}

/** The published picture, for a readout. */
export function glowGroundSource(): GlowGroundSource | null {
  return source;
}

/**
 * Called when the ground may have changed: the picture, or anything on
 * <html> (the theme's class, the glass mode, legibility's variables).
 */
export function subscribeGlowGround(listener: () => void): () => void {
  listeners.add(listener);
  if (!observer && typeof MutationObserver !== "undefined") {
    observer = new MutationObserver(notify);
    observer.observe(document.documentElement, { attributes: true });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}

// -----------------------------------------------------------------------------
// Colour
// -----------------------------------------------------------------------------

type Rgba = readonly [number, number, number, number];

let probe: CanvasRenderingContext2D | null | undefined;
const parsed = new Map<string, Rgba>();

/** Any CSS colour — oklch, color-mix's results, rgb — as sRGB 0–1 and alpha. */
function toRgba(css: string): Rgba {
  const hit = parsed.get(css);
  if (hit) return hit;
  if (probe === undefined) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    probe = c.getContext("2d", { willReadFrequently: true });
  }
  let out: Rgba = [0, 0, 0, 0];
  if (probe) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "rgba(0,0,0,0)";
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    out = [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
  }
  if (parsed.size > 256) parsed.clear();
  parsed.set(css, out);
  return out;
}

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

/** OKLab lightness of an sRGB colour, 0–1 — the profiles' unit. */
function oklabL(r: number, g: number, b: number): number {
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

// -----------------------------------------------------------------------------
// Measuring
// -----------------------------------------------------------------------------

/** The page, when nothing has published a picture yet: the theme's ground. */
function fallbackSource(): GlowGroundSource {
  const dark = document.documentElement.classList.contains("dark");
  const l = dark ? 0.22 : 1;
  return { zones: { top: l, mid: l, bottom: l }, busy: 0 };
}

/** The picture's lightness at a height on screen: the thirds' means, as a
 *  line through their centres. */
function pictureAt(y: number, zones: GlowGroundSource["zones"]): number {
  const t = Math.min(1, Math.max(0, y / Math.max(1, window.innerHeight)));
  if (t <= 1 / 6) return zones.top;
  if (t >= 5 / 6) return zones.bottom;
  if (t <= 0.5) return zones.top + (zones.mid - zones.top) * ((t - 1 / 6) * 3);
  return zones.mid + (zones.bottom - zones.mid) * ((t - 0.5) * 3);
}

/**
 * The ground under a glow whose box is `box`, laid on `over` — the surface
 * the light sits on, and everything under it up to the page. `over` null
 * means straight on the picture.
 */
export function measureGround(box: HTMLElement, over: HTMLElement | null): GlowGround {
  const pic = source ?? fallbackSource();

  // The surfaces, front to back, until opaque. The body and <html> are not
  // surfaces here — they paint the bezel, or the page the picture already
  // describes.
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let blurred = false;
  for (let el = over; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const cs = getComputedStyle(el);
    const [cr, cg, cb, ca] = toRgba(cs.backgroundColor);
    if (ca > 0) {
      const k = (1 - a) * ca;
      r += k * cr;
      g += k * cg;
      b += k * cb;
      a += k;
    }
    const filter = cs.backdropFilter || (cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
    if (filter && filter.includes("blur")) blurred = true;
    if (a > 0.995) break;
  }
  const surfaceL = a > 0 ? oklabL(r / a, g / a, b / a) : 0;

  const rect = box.getBoundingClientRect();
  const mid = rect.top + rect.height / 2;
  const at = (y: number) => a * surfaceL + (1 - a) * pictureAt(y, pic.zones);
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return {
    edges: [round(at(mid)), round(at(rect.bottom)), round(at(mid)), round(at(rect.top))],
    // A blur behind the surfaces smooths the picture's texture; what they
    // cover, the light never sees.
    busy: round(pic.busy * (1 - a) * (blurred ? 0.4 : 1)),
  };
}

/** The ground as one line — right bottom left top · busy — for a readout. */
export function formatGround(g: GlowGround): string {
  return `${g.edges.map((e) => e.toFixed(2)).join(" ")} · ${g.busy.toFixed(2)}`;
}

/** The published picture as React state, for the devtool's readout. */
export function useGlowGroundSource(): GlowGroundSource | null {
  return useSyncExternalStore(subscribeGlowGround, glowGroundSource, () => null);
}

export function sameGround(x: GlowGround, y: GlowGround): boolean {
  return x.busy === y.busy && x.edges.every((e, i) => e === y.edges[i]);
}
