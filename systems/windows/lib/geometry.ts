import { SURFACE_BREAKPOINTS } from "@/systems/surface";
import type { Rect } from "./types";

// =============================================================================
// Window geometry — placement, size presets, clamping, and the working area
//
// Pure functions over rects and a viewport, so the provider can stay a thin
// state machine. All coordinates are viewport pixels (the window layer is a
// `position: fixed; inset: 0` surface, so client coords == layer coords).
// =============================================================================

/** Smallest a window may be resized to — enough to keep the chrome usable. */
export const MIN_SIZE = { width: 300, height: 220 };

/** Inset the working area keeps from the left / right / bottom edges. */
export const MARGIN = 12;

/**
 * Top inset — larger than MARGIN so windows (and a maximized window's top edge)
 * clear the top-center **live-activity dock band** (music / ambient / minimized
 * pills). This is why the mobile default never covers the dock, and why "max"
 * leaves a little breathing room up top.
 */
export const DOCK_BAND = 56;

/** Height of the floating chrome pill, in px — shared with the window layout. */
export const CHROME_H = 34;

/**
 * The three window size presets, iPad-style:
 *   - portrait  — a phone-shaped card (mobile Lynx / web apps).
 *   - landscape — a wide card (docs, desktop web).
 *   - max       — the whole working area (with the dock-clearing top inset).
 */
export type SizePreset = "portrait" | "landscape" | "max";

export interface Viewport {
  width: number;
  height: number;
}

export function getViewport(): Viewport {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Phone-width, by the surface system's own definition. It is the same question
 * the shape fork asks (`WINDOW_PRESENTATION` in window.tsx), and it has to be
 * the same answer: a phone window is a sheet, and the rule that follows from
 * that — one app at a time — is true exactly when it is one. Two literals
 * agreeing by coincidence would let the two drift apart in silence.
 */
export function isMobile(vp: Viewport): boolean {
  return vp.width < SURFACE_BREAKPOINTS.sm;
}

/**
 * The rectangle windows live in. Uniform side/bottom margin, a taller top inset
 * so the dock band up top stays visible (the macOS "don't tuck under the menu
 * bar" rule, plus room for our live-activity dock).
 */
export function workingArea(vp: Viewport): Rect {
  return {
    x: MARGIN,
    y: DOCK_BAND,
    width: Math.max(MIN_SIZE.width, vp.width - MARGIN * 2),
    height: Math.max(MIN_SIZE.height, vp.height - DOCK_BAND - MARGIN),
  };
}

/** Pixel size of a preset for this viewport, never larger than the working area. */
export function presetSize(
  preset: SizePreset,
  vp: Viewport,
): { width: number; height: number } {
  const area = workingArea(vp);
  if (preset === "max") return { width: area.width, height: area.height };

  // On phones every non-max preset simply fills the stage (there isn't room to
  // meaningfully distinguish portrait vs landscape), which also keeps the dock
  // uncovered by construction.
  if (isMobile(vp)) return { width: area.width, height: area.height };

  if (preset === "landscape") {
    return {
      width: Math.min(1024, area.width),
      height: Math.min(680, area.height),
    };
  }
  // portrait — a tall phone card (matches most Lynx sample apps).
  return {
    width: Math.min(400, area.width),
    height: Math.min(760, area.height),
  };
}

/** A preset resolved to a placed rect (centered, a touch above true center). */
export function presetRect(preset: SizePreset, vp: Viewport): Rect {
  const area = workingArea(vp);
  if (preset === "max") return { ...area };
  const size = presetSize(preset, vp);
  const x = area.x + (area.width - size.width) / 2;
  const y = area.y + Math.max(0, (area.height - size.height) / 2) * 0.72;
  return clampRect({ x, y, ...size }, vp);
}

/** The size preset an app prefers by default (Lynx apps are mobile → portrait). */
export function defaultPreset(
  runtime: "web" | "lynx" | "native" | undefined,
): SizePreset {
  return runtime === "lynx" ? "portrait" : "landscape";
}

/**
 * Where the n-th freshly opened window lands: its preset rect, cascaded
 * down-right by a fixed step per already-open window so stacked opens fan out
 * (classic window-manager cascade). "max" never cascades.
 */
export function placeWindow(
  openCount: number,
  vp: Viewport,
  preset: SizePreset,
): Rect {
  const rect = presetRect(preset, vp);
  if (preset === "max") return rect;
  const step = 28;
  const cascade = (openCount % 6) * step;
  return clampRect({ ...rect, x: rect.x + cascade, y: rect.y + cascade }, vp);
}

/** Keep a whole window inside the working area (used after resize / on relayout). */
export function clampRect(rect: Rect, vp: Viewport): Rect {
  const area = workingArea(vp);
  const width = Math.min(rect.width, area.width);
  const height = Math.min(rect.height, area.height);
  const maxX = area.x + area.width - width;
  const maxY = area.y + area.height - height;
  return {
    width,
    height,
    x: Math.min(Math.max(rect.x, area.x), Math.max(area.x, maxX)),
    y: Math.min(Math.max(rect.y, area.y), Math.max(area.y, maxY)),
  };
}

/**
 * Keep at least the chrome reachable after a drag. Unlike {@link clampRect} this
 * lets a window hang off the left/right/bottom edges (macOS lets you tuck a
 * window mostly offscreen) but never lets the chrome leave the top or drift
 * fully out of grabbing range. Returns whether it actually had to pull the
 * window back, so the caller can play a little bounce as a hint.
 */
export function clampDrag(
  rect: Rect,
  vp: Viewport,
): { rect: Rect; clamped: boolean } {
  const area = workingArea(vp);
  const keep = 88; // px of window that must stay on-screen horizontally
  const x = Math.min(
    Math.max(rect.x, area.x - rect.width + keep),
    area.x + area.width - keep,
  );
  const y = Math.min(Math.max(rect.y, area.y), area.y + area.height - CHROME_H);
  return { rect: { ...rect, x, y }, clamped: x !== rect.x || y !== rect.y };
}

/**
 * Run `onChange` when the viewport changes size, at most once a frame.
 *
 * Every window geometry that is a fraction of the viewport has to be recomputed
 * when it moves, and on iOS it moves constantly — through a rotation and every
 * time the URL bar slides. So this is one listener and one frame for the whole
 * system, not one per subscriber: the layer renders every window including the
 * minimized ones, and on a phone all but one of those are put away. Five open
 * apps were five listeners and five viewport reads a frame, four of them for
 * sheets nobody could see.
 */
const watchers = new Set<() => void>();
let watchRaf = 0;
let stopWatching: (() => void) | null = null;

export function onViewportChange(onChange: () => void): () => void {
  watchers.add(onChange);
  if (!stopWatching) {
    const handle = () => {
      if (watchRaf) return;
      watchRaf = requestAnimationFrame(() => {
        watchRaf = 0;
        for (const w of watchers) w();
      });
    };
    window.addEventListener("resize", handle);
    stopWatching = () => {
      window.removeEventListener("resize", handle);
      if (watchRaf) cancelAnimationFrame(watchRaf);
      watchRaf = 0;
    };
  }
  return () => {
    watchers.delete(onChange);
    if (watchers.size === 0) {
      stopWatching?.();
      stopWatching = null;
    }
  };
}
