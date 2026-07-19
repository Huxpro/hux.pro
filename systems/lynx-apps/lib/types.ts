export type AppWindowId = string;

export type AppWindowKind = "lynx" | "web";

export interface OpenAppWindow {
  /** Unique instance id (allows reopening same app later as a new window) */
  instanceId: AppWindowId;
  kind: AppWindowKind;
  /**
   * Stable id — Lynx registry id (`LYNX_APPS`) or shelf app id (`apps.json`).
   * Used to focus/restore an existing window for the same app.
   */
  appId: string;
  /** Shelf / window title (web apps; Lynx prefers localized registry titles). */
  title: string;
  /** iframe src when `kind === "web"`. */
  url?: string;
  zIndex: number;
  minimized: boolean;
  /** Cascaded origin offset from viewport center */
  offset: { x: number; y: number };
}
