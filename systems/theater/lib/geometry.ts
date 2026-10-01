// =============================================================================
// Theater System: Stage geometry
//
// The stage (the persistent player element) is a single fixed rectangle that
// morphs between the theater (large centered) and PiP (small floating) modes.
// The math lives here as pure functions of the viewport, the PiP placement
// (and a drag, while one is in progress), and the device class. Both the stage and its chrome read identical numbers in
// the same render, so they stay pixel-aligned while animating and dragging.
// =============================================================================

import type { StageRect } from "./types";

const ASPECT = 9 / 16;
/** Gap from the viewport edge for the floating PiP tile. */
const PIP_MARGIN = 16;
/**
 * Room the window leaves under itself at rest. Centred at the bottom, it would
 * otherwise land exactly on the command bar, which is the site's whole
 * navigation: `bottom-6` + `h-12` in systems/command/fab.tsx, plus our gap.
 */
const PIP_BOTTOM_INSET = 24 + 48 + 8;
/**
 * The two sizes the PiP tile comes in, as a share of the viewport's width with
 * a ceiling. Large is the Live Activity card's width (`w-[min(92vw,360px)]` in
 * the dock) on a phone and a little more on a desk; small leaves the page most
 * of the screen. Both keep the 16:9 video over the ≳200px the YouTube IFrame API
 * wants for its ready handshake on any phone wider than ~360px.
 */
const PIP_SIZES = {
  small: { fraction: 0.56, max: 280 },
  large: { fraction: 0.92, max: 400 },
} as const;
/**
 * How high the tile may go: dragged, or parked above a surface. Clears the
 * dock's pill row (top inset + a 36px pill) with air to spare.
 */
export const PIP_TOP_STOP = 64;
/** Air between the PiP tile and whatever it is parked against. */
export const PIP_GAP = 8;
/** How much of a stashed tile stays on screen: the handle you pull it back by. */
export const PIP_STASH_PEEK = 28;
/**
 * How far a fling carries past the release point, in milliseconds of the
 * release velocity. The tile lands on the corner nearest to where the throw
 * was headed, not where the finger happened to stop.
 */
const PIP_PROJECTION_MS = 200;

/** One of the four places the tile rests. */
export type PipCorner = "tl" | "tr" | "bl" | "br";
export type PipSize = keyof typeof PIP_SIZES;
/** The edge a tile has been thrown into, or null when it is on screen. */
export type PipStash = "left" | "right" | null;

/**
 * Where the PiP tile is, as the user left it: a corner, a size, and whether it
 * has been tucked into a side edge. Positions are never stored. They are
 * derived from this and the viewport, so a rotation or a resize keeps the tile
 * in its corner instead of stranding it at old coordinates.
 */
export interface PipPlacement {
  corner: PipCorner;
  size: PipSize;
  stash: PipStash;
}

export const DEFAULT_PIP_PLACEMENT: PipPlacement = {
  corner: "br",
  size: "large",
  stash: null,
};

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
 * tablet-class viewport. Phones (including landscape) stay on PiP.
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

/** PiP tile width for a size. */
export function pipWidth(vp: Viewport, size: PipSize): number {
  const { fraction, max } = PIP_SIZES[size];
  return Math.min(vp.width * fraction, max);
}

/** The tile's top when it rests in a bottom corner: above the command bar. */
function pipBottomTop(vp: Viewport, height: number): number {
  return Math.max(vp.height - height - PIP_BOTTOM_INSET, PIP_TOP_STOP);
}

/**
 * The PiP tile's rect. With no drag in progress it is the placement's corner
 * (or its stash, mostly off the side it was thrown to). During a drag it is
 * wherever the finger has it: free sideways, so it can be pulled past an edge
 * into a stash, and held between the dock and the command bar vertically.
 */
export function pipRect(
  vp: Viewport,
  placement: PipPlacement,
  drag: { x: number; y: number } | null = null,
): StageRect {
  const width = pipWidth(vp, placement.size);
  const height = width * ASPECT;
  const bottom = pipBottomTop(vp, height);
  if (drag) {
    return {
      left: clamp(drag.x, -width + PIP_STASH_PEEK, vp.width - PIP_STASH_PEEK),
      top: clamp(drag.y, PIP_TOP_STOP, bottom),
      width,
      height,
    };
  }
  const top = placement.corner[0] === "t" ? PIP_TOP_STOP : bottom;
  let left =
    placement.corner[1] === "l" ? PIP_MARGIN : vp.width - width - PIP_MARGIN;
  if (placement.stash === "left") left = -width + PIP_STASH_PEEK;
  if (placement.stash === "right") left = vp.width - PIP_STASH_PEEK;
  return { top, left, width, height };
}

/**
 * Where a released tile comes to rest. The release point is carried along the
 * throw (`PIP_PROJECTION_MS` of its velocity, in px/ms) and the tile goes to the
 * corner nearest that projected point. Thrown hard enough past a side edge, it
 * stashes there instead, keeping the row (top or bottom) it was headed for.
 */
export function pipSettle(
  vp: Viewport,
  size: PipSize,
  at: { x: number; y: number },
  velocity: { x: number; y: number },
): PipPlacement {
  const width = pipWidth(vp, size);
  const height = width * ASPECT;
  const x = at.x + velocity.x * PIP_PROJECTION_MS;
  const y = at.y + velocity.y * PIP_PROJECTION_MS;
  const row = y + height / 2 < vp.height / 2 ? "t" : "b";
  if (x < -width * 0.35) return { size, corner: `${row}l`, stash: "left" };
  if (x > vp.width - width * 0.65) return { size, corner: `${row}r`, stash: "right" };
  const side = x + width / 2 < vp.width / 2 ? "l" : "r";
  return { size, corner: `${row}${side}` as PipCorner, stash: null };
}

// ---------------------------------------------------------------------------
// The phone's card
//
// On a phone the player is one object anchored at the top of the screen, in
// three sizes: the Live Activity's pill in the dock, a card hanging under the
// dock, and the card with the playlist sheet taking the rest of the screen
// under it. Pull it down and it grows, push it up and it shrinks. The card is
// the Live Activity panel's width (`w-[min(92vw,360px)]` in the dock), so the
// pill and the card are the same object at two sizes rather than two boxes.
// ---------------------------------------------------------------------------

/** The card's outer width: the dock panel's. */
const PIP_CARD_FRACTION = 0.92;
const PIP_CARD_MAX = 360;
/** Glass around the video, inside the card. */
export const PIP_CARD_PAD = 6;
/** The row under the video: title, transport, close. */
export const PIP_CARD_FOOTER = 44;
/** The grabber under the row: the card's "this pulls" sign. */
export const PIP_CARD_GRABBER = 12;

/** The card's outer width on this viewport. */
function pipCardWidth(vp: Viewport): number {
  return Math.min(vp.width * PIP_CARD_FRACTION, PIP_CARD_MAX);
}

/**
 * The video's rect inside the phone's card. The card hangs at
 * `PIP_TOP_STOP`, under the dock's pill row, centred. During a vertical drag
 * `dragTop` is where the video's top edge is following the finger to.
 */
export function pipCardRect(vp: Viewport, dragTop: number | null = null): StageRect {
  const outer = pipCardWidth(vp);
  const width = outer - PIP_CARD_PAD * 2;
  return {
    left: (vp.width - outer) / 2 + PIP_CARD_PAD,
    top: dragTop ?? PIP_TOP_STOP + PIP_CARD_PAD,
    width,
    height: width * ASPECT,
  };
}

/** The card's outer box, from the video rect it wraps. */
export function pipCardBox(video: StageRect): StageRect {
  return {
    left: video.left - PIP_CARD_PAD,
    top: video.top - PIP_CARD_PAD,
    width: video.width + PIP_CARD_PAD * 2,
    height: video.height + PIP_CARD_PAD + PIP_CARD_FOOTER + PIP_CARD_GRABBER,
  };
}

/** The shorter of the playlist sheet's two detents, where both fit. */
const PLAYLIST_FIRST_DETENT = 0.5;
/** Below this much room, a second detent would be a few pixels of travel. */
const PLAYLIST_SECOND_DETENT_MIN = 0.62;

/**
 * The playlist sheet's detents: everything below `ceiling`, and a half-height
 * stop under it when that leaves somewhere to drag to.
 *
 * `ceiling` is the bottom edge of whatever the player is showing: the phone's
 * card, or the dock panel it collapsed into. The sheet stops there rather
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
 * don't move the stage off-screen anymore. They keep it at its mode's rect and
 * fade + scale it out (so opening is an in-place morph, not a fly-in from a
 * parked corner), while the still-mounted iframe keeps audio alive.
 */
export function stageRectFor(
  mode: "theater" | "pip",
  vp: Viewport,
  placement: PipPlacement,
  drag: { x: number; y: number } | null,
  /** A phone: PiP is the card hanging under the dock, not a corner tile. */
  card: boolean,
): StageRect {
  if (mode === "theater") return theaterRect(vp);
  return card ? pipCardRect(vp, drag?.y ?? null) : pipRect(vp, placement, drag);
}
