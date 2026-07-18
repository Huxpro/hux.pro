import type { Rect } from "./types";

// =============================================================================
// Window geometry — placement, clamping, and the working area
//
// Pure functions over rects and a viewport, so the provider can stay a thin
// state machine. All coordinates are viewport pixels (the window layer is a
// `position: fixed; inset: 0` surface, so client coords == layer coords).
// =============================================================================

/** Smallest a window may be resized to — enough to keep the chrome usable. */
export const MIN_SIZE = { width: 320, height: 240 };

/** Inset the working area keeps from the viewport edges. */
export const MARGIN = 12;

/** Height of the title bar, in px — shared by the chrome and maximize math. */
export const TITLE_BAR_H = 40;

export interface Viewport {
  width: number;
  height: number;
}

export function getViewport(): Viewport {
  if (typeof window === "undefined") return { width: 1280, height: 800 };
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * The rectangle windows are allowed to live in. Leaves a top inset so a window
 * pinned to the top still clears the site's sticky header zone, and a uniform
 * margin elsewhere — the macOS "don't tuck the title bar under the menu bar"
 * rule.
 */
export function workingArea(vp: Viewport): Rect {
  const top = MARGIN;
  return {
    x: MARGIN,
    y: top,
    width: Math.max(MIN_SIZE.width, vp.width - MARGIN * 2),
    height: Math.max(MIN_SIZE.height, vp.height - top - MARGIN),
  };
}

/**
 * A comfortable default window size for the viewport: a phone-ish portrait card
 * on narrow screens (apps are mostly mobile Lynx/web content), a landscape
 * card on desktop. Never larger than the working area.
 */
export function defaultSize(vp: Viewport): { width: number; height: number } {
  const area = workingArea(vp);
  if (vp.width < 640) {
    // Small screens: near-fullscreen, the iPad "app takes the stage" feel.
    return { width: area.width, height: area.height };
  }
  const width = Math.min(420, area.width);
  const height = Math.min(720, area.height);
  return { width, height };
}

/**
 * Where the n-th freshly opened window lands. Centered, then cascaded down-right
 * by a fixed step per already-open window so stacked opens fan out instead of
 * hiding behind each other (classic window-manager cascade).
 */
export function placeWindow(openCount: number, vp: Viewport): Rect {
  const area = workingArea(vp);
  const size = defaultSize(vp);
  const step = 28;
  const cascade = (openCount % 6) * step;

  const cx = area.x + (area.width - size.width) / 2;
  const cy = area.y + Math.max(0, (area.height - size.height) / 2) * 0.6;

  return clampRect(
    { x: cx + cascade, y: cy + cascade, ...size },
    vp,
  );
}

/** Keep a whole window inside the working area (used after drag / on resize). */
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
 * Keep at least the title bar reachable after a drag. Unlike {@link clampRect}
 * this lets a window hang off the left/right/bottom edges (macOS lets you tuck
 * a window mostly offscreen) but never lets the title bar leave the top or go
 * fully out of grabbing range.
 */
export function clampDrag(rect: Rect, vp: Viewport): Rect {
  const area = workingArea(vp);
  const keep = 80; // px of window that must stay on-screen horizontally
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, area.x - rect.width + keep), area.x + area.width - keep),
    y: Math.min(Math.max(rect.y, area.y), area.y + area.height - TITLE_BAR_H),
  };
}
