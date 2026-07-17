// =============================================================================
// Theater System — Stage geometry
//
// The stage (the persistent player element) is a single fixed rectangle that
// morphs between the theater (large centered) and PiP (small floating) modes.
// Keeping the math here — pure functions of the viewport, a drag offset, and
// the device class — lets both the stage and its chrome read identical numbers
// in the same render so they stay pixel-aligned while animating and dragging.
// =============================================================================

import type { StageRect, TheaterMode } from "./types";

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

/** Largest centered 16:9 box that fits the theater budget (~70% height). */
export function theaterRect(vp: Viewport): StageRect {
  const maxHeight = vp.height * 0.7;
  const maxWidth = vp.width * 0.92;
  let width = Math.min(maxWidth, maxHeight / ASPECT);
  let height = width * ASPECT;
  if (height > maxHeight) {
    height = maxHeight;
    width = height / ASPECT;
  }
  const top = Math.max((vp.height - height) / 2 - vp.height * 0.03, 56);
  const left = (vp.width - width) / 2;
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

/** Off-screen parking spot that keeps the player mounted (audio alive). */
export function parkedRect(vp: Viewport): StageRect {
  const width = pipWidth(vp);
  return { top: -9999, left: -9999, width, height: width * ASPECT };
}

export function stageRectFor(
  mode: TheaterMode,
  vp: Viewport,
  offset: { x: number; y: number },
): StageRect {
  if (mode === "theater") return theaterRect(vp);
  if (mode === "pip") return pipRect(vp, offset);
  return parkedRect(vp);
}
