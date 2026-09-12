import { DEFAULT_WALLPAPER_ID, getWallpaperPair } from "./catalog";

// =============================================================================
// Wallpaper Settings
//
// Weather and image are mutually exclusive kinds of the same wallpaper
// surface. Image pairs support auto (follow theme) or a locked variant.
// =============================================================================

export type WallpaperKind = "weather" | "image";
export type WallpaperAppearance = "auto" | "light" | "dark";

export interface WallpaperSettings {
  kind: WallpaperKind;
  imageId: string;
  appearance: WallpaperAppearance;
}

const SETTINGS_KEY = "hux_wallpaper";

export function getDefaultWallpaperSettings(): WallpaperSettings {
  return {
    kind: "weather",
    imageId: DEFAULT_WALLPAPER_ID,
    appearance: "auto",
  };
}

export function getWallpaperSettings(): WallpaperSettings {
  if (typeof window === "undefined") {
    return getDefaultWallpaperSettings();
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return getDefaultWallpaperSettings();
    return normalizeWallpaperSettings(JSON.parse(stored));
  } catch {
    return getDefaultWallpaperSettings();
  }
}

export function setWallpaperSettings(settings: WallpaperSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function normalizeWallpaperSettings(
  raw: unknown
): WallpaperSettings {
  const defaults = getDefaultWallpaperSettings();
  if (!raw || typeof raw !== "object") return defaults;

  const parsed = raw as Partial<WallpaperSettings>;
  const kind: WallpaperKind =
    parsed.kind === "image" || parsed.kind === "weather"
      ? parsed.kind
      : defaults.kind;
  const appearance: WallpaperAppearance =
    parsed.appearance === "light" ||
    parsed.appearance === "dark" ||
    parsed.appearance === "auto"
      ? parsed.appearance
      : defaults.appearance;
  const imageId =
    typeof parsed.imageId === "string" && getWallpaperPair(parsed.imageId)
      ? parsed.imageId
      : defaults.imageId;

  return { kind, imageId, appearance };
}
