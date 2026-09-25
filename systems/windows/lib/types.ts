import type { AppLink } from "@/lib/app-icon-core";
import type { SizePreset } from "./geometry";

// =============================================================================
// Window system — shared types
// =============================================================================

/** Position + size of a window, in viewport (client) pixels. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Whether a window is on the desktop or tucked into the dock. Size (including
 * the maximized/"max" state) is tracked separately via {@link SizePreset}, so
 * this is just the presence axis.
 *   - "normal"    — floating on the desktop at its {@link WindowInstance.rect}.
 *   - "minimized" — genied into the dock; still mounted (state preserved),
 *                   reachable by tapping its pill / icon.
 */
export type WindowMode = "normal" | "minimized";

/** One open app window. Identified by the app id (one window per app). */
export interface WindowInstance {
  /** Same as the app id — one live window per app, tapping again just focuses. */
  id: string;
  app: AppLink;
  rect: Rect;
  mode: WindowMode;
  /** Current size preset; `"max"` is the maximized state. */
  sizePreset: SizePreset;
  /** Stacking order; the focused window holds the highest value. */
  z: number;
  /**
   * Bumped by `reload` — the app frame keys off it, so a reload is a remount:
   * the only way to restart a cross-origin iframe or a Lynx runtime from here.
   */
  generation: number;
  /** Rect to return to when leaving "max". */
  restoreRect?: Rect;
  /** Preset to return to when leaving "max". */
  restorePreset?: SizePreset;
  /**
   * Where the window grows from when it opens, if not from its own rect: the
   * whole viewport, for a fullscreen page shrinking into a window. Cleared on
   * nothing — it only matters to the first mount.
   */
  origin?: Rect;
}

/** Options for opening an app. */
export interface OpenAppOptions {
  /** Grow the window out of this rect rather than in place (see `origin`). */
  origin?: Rect;
}
