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
 * Room the window leaves under itself at rest. Centred at the bottom, it would
 * otherwise land exactly on the command bar, which is the site's whole
 * navigation: `bottom-6` + `h-12` in systems/command/fab.tsx, plus our gap.
 */
const PIP_BOTTOM_INSET = 24 + 48 + 8;
/**
 * The PiP window is the same card as a Live Activity: the dock's
 * `w-[min(92vw,360px)]`, centred. The two are the player's two shapes, so they
 * are one object arriving at opposite edges of the screen rather than two
 * differently-sized boxes. 360px also keeps the 16:9 video at 202px, over the
 * ≳200px the YouTube IFrame API wants for its ready handshake (a phone
 * narrower than ~356px falls below that, as it always did).
 */
const PIP_WIDTH_FRACTION = 0.92;
const PIP_MAX_WIDTH = 360;
/** Height of the PiP control bar rendered directly beneath the video. */
export const PIP_CONTROLS_H = 44;
/**
 * How high the window may go: dragged, or parked above a surface. Clears the
 * dock's pill row (top inset + a 36px pill) with air to spare.
 */
export const PIP_TOP_STOP = 64;
/** Air between the PiP window and whatever it is parked against. */
export const PIP_GAP = 8;

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
export const THEATER_TOP_BAR = 64; // title + conf + window chrome
export const THEATER_BOTTOM = 200; // album tabs + playlist rail
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

/** PiP window width: the Live Activity card's, whatever the viewport. */
function pipWidth(vp: Viewport): number {
  return Math.min(vp.width * PIP_WIDTH_FRACTION, PIP_MAX_WIDTH);
}

/** Height of the whole window — video plus the control bar under it. */
function pipHeight(vp: Viewport): number {
  return pipWidth(vp) * ASPECT + PIP_CONTROLS_H;
}

/**
 * Floating PiP rect. Anchored bottom-centre by default — under the page, where
 * the Live Activity sits over it, on the same axis and the same width, so the
 * player reads as one card that moved rather than two. `offset` is the user's
 * accumulated drag, clamped so the window (plus its control bar) stays on
 * screen. The rect describes the VIDEO area only; the control bar sits in the
 * PIP_CONTROLS_H strip directly below it.
 */
export function pipRect(vp: Viewport, offset: { x: number; y: number }): StageRect {
  const width = pipWidth(vp);
  const height = width * ASPECT;
  const baseLeft = (vp.width - width) / 2;
  const baseTop = pipRestTop(vp);
  const left = clamp(baseLeft + offset.x, PIP_MARGIN, vp.width - width - PIP_MARGIN);
  const top = clamp(baseTop + offset.y, PIP_TOP_STOP, baseTop);
  return { top, left, width, height };
}

/** Where the window sits with no drag: bottom-centre, above the command bar. */
function pipRestTop(vp: Viewport): number {
  return Math.max(vp.height - pipHeight(vp) - PIP_BOTTOM_INSET, PIP_TOP_STOP);
}

/**
 * The drag offset that parks the PiP window at its top stop.
 *
 * What the playlist surface does with the window while it is up: the video
 * goes to the top of the screen and the list takes everything under it, the
 * way a phone player puts its queue below the picture. The horizontal drag is
 * kept (the window stays on the side it was left on) and the vertical one only
 * ever moves up, so a window already higher is left where it is.
 */
export function pipOffsetAtTop(
  vp: Viewport,
  from: { x: number; y: number },
): { x: number; y: number } {
  return { x: from.x, y: Math.min(PIP_TOP_STOP - pipRestTop(vp), from.y) };
}

/** The window's bottom edge once parked — the ceiling a sheet stops under. */
export function pipParkedBottom(vp: Viewport): number {
  return PIP_TOP_STOP + pipHeight(vp);
}

/** The shorter of the playlist sheet's two detents, where both fit. */
const PLAYLIST_FIRST_DETENT = 0.5;
/** Below this much room, a second detent would be a few pixels of travel. */
const PLAYLIST_SECOND_DETENT_MIN = 0.62;

/**
 * The playlist sheet's detents: everything below `ceiling`, and a half-height
 * stop under it when that leaves somewhere to drag to.
 *
 * `ceiling` is the bottom edge of whatever the player is showing — the parked
 * PiP window, or the dock card it collapsed into. The sheet stops there rather
 * than running to the top of the screen, so the video is never something the
 * list has to work around: on a phone the two share the screen, they do not
 * overlap. That makes the top detent a property of the player's current shape,
 * which is why this is a function and not a constant.
 */
export function playlistDetents(viewportHeight: number, ceiling: number): number[] {
  const top = clamp((viewportHeight - ceiling - PIP_GAP) / viewportHeight, 0.25, 0.95);
  return top >= PLAYLIST_SECOND_DETENT_MIN ? [PLAYLIST_FIRST_DETENT, top] : [top];
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
