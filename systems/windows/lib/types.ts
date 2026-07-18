import type { AppLink } from "@/lib/app-icon-core";

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
 * A window's display state, mirroring the three macOS "traffic light" outcomes:
 *   - "normal"    — floating at its {@link WindowInstance.rect}.
 *   - "minimized" — hidden from the layer (genie'd away); still open, still in
 *                   the z-stack, reachable by tapping its icon again.
 *   - "maximized" — filled to the working area; the pre-maximize rect is kept
 *                   in {@link WindowInstance.restoreRect} so a second click on
 *                   the green light springs it back.
 */
export type WindowMode = "normal" | "minimized" | "maximized";

/** One open app window. Identified by the app id (one window per app). */
export interface WindowInstance {
  /** Same as the app id — one live window per app, tapping again just focuses. */
  id: string;
  app: AppLink;
  rect: Rect;
  mode: WindowMode;
  /** Stacking order; the focused window holds the highest value. */
  z: number;
  /** The pre-maximize rect, restored when un-maximizing. */
  restoreRect?: Rect;
}
