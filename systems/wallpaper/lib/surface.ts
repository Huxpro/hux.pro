import type { WallpaperKind } from "./settings";

/** Site home is the desktop / springboard. Everything else is a reading surface. */
export const WALLPAPER_HOME_PATH = "/";

export function isWallpaperHomePath(pathname: string): boolean {
  return pathname === WALLPAPER_HOME_PATH;
}

/**
 * Document classes for the living background:
 * - `wallpaper-surface` — weather or image; remaps light System type tokens
 * - `wallpaper-image` — thin the System UI glass (home + inner pages)
 * - `wallpaper-read`  — defocus + veil the photo so prose can sit on top
 */
export function wallpaperDocumentClassNames(
  kind: WallpaperKind,
  pathname: string
): { surface: boolean; image: boolean; read: boolean } {
  const image = kind === "image";
  return {
    surface: kind === "weather" || image,
    image,
    read: image && !isWallpaperHomePath(pathname),
  };
}
