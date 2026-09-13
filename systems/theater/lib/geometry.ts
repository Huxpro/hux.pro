// =============================================================================
// Theater System — Stage geometry
//
// The stage (the persistent player element) is a single fixed rectangle that
// morphs between the theater (large centered) and PiP (small floating) modes.
// Keeping the math here — pure functions of the viewport, a drag offset, and
// the device class — lets both the stage and its chrome read identical numbers
// in the same render so they stay pixel-aligned while animating and dragging.
// =============================================================================

import type { StageRect } from "./types";

const ASPECT = 9 / 16;
/** Gap from the viewport edge for the floating PiP window. */
const PIP_MARGIN = 16;
/**
 * The YouTube IFrame API needs a ≳200px viewport for its ready handshake, so
 * we keep the PiP wide enough that its 16:9 height clears that when the screen
 * allows (small phones fall back to edge-to-edge width).
 */
const PIP_MIN_WIDTH = 356;
const PIP_MAX_WIDTH = 400;
/** Height of the PiP control bar rendered directly beneath the video. */
export const PIP_CONTROLS_H = 44;

export interface Viewport {
  width: number;
  height: number;
}

/** Read the current viewport, SSR-safe. */
export function readViewport(): Viewport {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

// Chrome lives *around* the video, not on top of it, so the video rect is the
// largest 16:9 that leaves these margins free: a control bar above, the title +
// playlist rail below, and prev/next arrow gutters on the sides.
// Sized for the frosted-toolbar chrome (taller top band, wider side air).
export const THEATER_TOP_BAR = 56; // window chrome only (surface + close)
export const THEATER_BOTTOM = 248; // title + album tabs + playlist rail
export const THEATER_SIDE = 80; // prev / next arrow gutters
const THEATER_MARGIN = 16;

/**
 * Theater chrome (top bar + playlist rail + a watchable 16:9 stage) needs a
 * tablet-class viewport. Phones — including landscape — stay on PiP.
 * Matches Tailwind `md` / iPad mini portrait (768×1024).
 */
export const THEATER_MIN_WIDTH = 768;
export const THEATER_MIN_HEIGHT = 500;

/** True when the viewport can host the immersive theater modal. */
export function theaterAvailable(vp: Viewport): boolean {
  return vp.width >= THEATER_MIN_WIDTH && vp.height >= THEATER_MIN_HEIGHT;
}

/**
 * Adaptive stage size for theater mode.
 *
 * Fit the largest 16:9 rect that still leaves chrome margins free, then cap
 * so desktop stays a floating lightbox (76vw / 66vh). Tablet / short
 * viewports drop the airy cap and hug the edges (94vw / 80vh) so the
 * player reads as fullscreen rather than a small card.
 * Centered in the band between the top bar and the playlist rail. Top bar,
 * side arrows, and the playlist all read this same `rect`, so they stay
 * edge-aligned as the viewport changes.
 */
export function theaterRect(vp: Viewport): StageRect {
  // Tablet / short desktop: use more of the screen so the player reads as
  // fullscreen rather than a small floating card (desktop keeps the airy cap).
  const compact = vp.width < 1100 || vp.height < 820;
  const side = compact ? 16 : THEATER_SIDE + THEATER_MARGIN;
  const maxWidth = Math.min(
    vp.width - 2 * side,
    vp.width * (compact ? 0.94 : 0.76),
  );
  const maxHeight = Math.min(
    vp.height - THEATER_TOP_BAR - THEATER_BOTTOM - 2 * THEATER_MARGIN,
    vp.height * (compact ? 0.8 : 0.66),
  );
  let width = Math.min(maxWidth, maxHeight / ASPECT);
  let height = width * ASPECT;
  if (height > maxHeight) {
    height = maxHeight;
    width = height / ASPECT;
  }
  const left = (vp.width - width) / 2;
  const bandTop = THEATER_TOP_BAR + THEATER_MARGIN;
  const bandBottom = vp.height - THEATER_BOTTOM - THEATER_MARGIN;
  const top = Math.max(bandTop + (bandBottom - bandTop - height) / 2, bandTop);
  return { top, left, width, height };
}

/** PiP window width for the given viewport (mobile → near edge-to-edge). */
function pipWidth(vp: Viewport): number {
  const available = vp.width - PIP_MARGIN * 2;
  return Math.min(Math.max(Math.min(available, PIP_MIN_WIDTH), 240), PIP_MAX_WIDTH);
}

/**
 * Floating PiP rect. Anchored bottom-right by default; `offset` is the user's
 * accumulated drag, clamped so the window (plus its control bar) stays on
 * screen. The rect describes the VIDEO area only; the control bar sits in the
 * PIP_CONTROLS_H strip directly below it.
 */
export function pipRect(vp: Viewport, offset: { x: number; y: number }): StageRect {
  const width = pipWidth(vp);
  const height = width * ASPECT;
  const safeBottom = PIP_MARGIN;
  const baseLeft = vp.width - width - PIP_MARGIN;
  const baseTop = vp.height - height - PIP_CONTROLS_H - safeBottom;
  const left = clamp(baseLeft + offset.x, PIP_MARGIN, vp.width - width - PIP_MARGIN);
  const top = clamp(
    baseTop + offset.y,
    PIP_MARGIN + 48,
    vp.height - height - PIP_CONTROLS_H - safeBottom,
  );
  return { top, left, width, height };
}

/**
 * The stage's rect for a *visible* mode. Hidden states (closed / minimized)
 * don't move the stage off-screen anymore — they keep it at its mode's rect and
 * just fade + scale it out (so opening is a clean in-place morph, not a fly-in
 * from a parked corner), while the still-mounted iframe keeps audio alive.
 */
export function stageRectFor(
  mode: "theater" | "pip",
  vp: Viewport,
  offset: { x: number; y: number },
): StageRect {
  return mode === "pip" ? pipRect(vp, offset) : theaterRect(vp);
}
