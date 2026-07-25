/**
 * App catalog — single read of `content/apps.json` + icon snapshot for every
 * surface that launches or renders apps (home folder, ⌘K launcher, windows).
 *
 * Keep this module free of React imports so scripts and Node tooling can share
 * the same catalog helpers later if needed.
 */

import appIconSnapshot from "@/content/app-icons.json";
import appsJson from "@/content/apps.json";
import type { AppIconSnapshot, AppLink } from "@/lib/app-icon-core";

export const APPS: AppLink[] = (appsJson as { apps: AppLink[] }).apps;
export const APP_ICONS = appIconSnapshot as AppIconSnapshot;
export const DEFAULT_APP_IDS = APPS.map((a) => a.id);
export const APPS_BY_ID = new Map(APPS.map((a) => [a.id, a]));

/**
 * Full-bleed vs padded: opaque, purpose-drawn app icons (manifest / apple-touch
 * art is square and generously sized) fill the tile edge-to-edge; small or
 * non-square favicons are glyphs and sit centered with breathing room.
 */
export function iconFillsTile(
  entry: AppIconSnapshot[string] | undefined,
): boolean {
  if (!entry?.width || !entry?.height) return false;
  return entry.width === entry.height && entry.width >= 160;
}

/** Folder page capacity helpers — used by the home App Folder widget. */
export type AppFolderAxis = "x" | "y";

export interface AppFolderLayout {
  /** Icons per row. */
  columns: number;
  /** Rows per snap page. */
  rows: number;
  /** Scroll axis when apps overflow one page. */
  axis: AppFolderAxis;
}

/** Default springboard-folder layout: 4×2 pages, horizontal snap (iOS-like). */
export const DEFAULT_APP_FOLDER_LAYOUT: AppFolderLayout = {
  columns: 4,
  rows: 2,
  axis: "x",
};

export function pageCapacity(layout: Pick<AppFolderLayout, "columns" | "rows">): number {
  return layout.columns * layout.rows;
}

/** Chunk an ordered id list into fixed-size pages (last page may be short). */
export function chunkAppPages(ids: string[], capacity: number): string[][] {
  if (capacity <= 0) return [ids];
  if (ids.length === 0) return [[]];
  const pages: string[][] = [];
  for (let i = 0; i < ids.length; i += capacity) {
    pages.push(ids.slice(i, i + capacity));
  }
  return pages;
}
