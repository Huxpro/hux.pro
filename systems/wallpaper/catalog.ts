/** Apple originals, locally optimized. Provenance: public/wallpapers/sources.json. */
export const WALLPAPERS = [
  { id: "big-sur", name: "Big Sur", platform: "macOS", year: "2020" },
  { id: "monterey", name: "Monterey", platform: "macOS", year: "2021" },
  { id: "ios-13", name: "iOS 13", platform: "iOS", year: "2019" },
  { id: "ios-14", name: "iOS 14", platform: "iOS", year: "2020" },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]["id"];
export type WallpaperVariant = "light" | "dark";
export type WallpaperSource = "weather" | "image" | "none";
export type WallpaperAppearance = "auto" | WallpaperVariant;
export interface WallpaperSettings {
  source: WallpaperSource;
  light: WallpaperId;
  dark: WallpaperId;
  appearance: WallpaperAppearance;
}

export const DEFAULT_WALLPAPER: WallpaperSettings = {
  source: "weather",
  light: "big-sur",
  dark: "big-sur",
  appearance: "auto",
};

export function isWallpaperId(value: unknown): value is WallpaperId {
  return WALLPAPERS.some((wallpaper) => wallpaper.id === value);
}

/** Validate persisted data, including removed catalog entries and older settings. */
export function parseWallpaper(
  value: unknown,
  legacyOff = false,
): WallpaperSettings {
  const fallback = {
    ...DEFAULT_WALLPAPER,
    source: legacyOff ? ("none" as const) : ("weather" as const),
  };
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Record<string, unknown>;
  return {
    source:
      raw.source === "image" ||
      raw.source === "none" ||
      raw.source === "weather"
        ? raw.source
        : fallback.source,
    light: isWallpaperId(raw.light) ? raw.light : fallback.light,
    dark: isWallpaperId(raw.dark) ? raw.dark : fallback.dark,
    appearance:
      raw.appearance === "light" || raw.appearance === "dark"
        ? raw.appearance
        : "auto",
  };
}

export function resolveWallpaper(
  settings: WallpaperSettings,
  theme: WallpaperVariant,
) {
  const variant = settings.appearance === "auto" ? theme : settings.appearance;
  const id = settings[variant];
  return { id, variant, src: wallpaperImage(id, variant) };
}

export function wallpaperImage(
  id: WallpaperId,
  variant: WallpaperVariant,
  thumbnail = false,
) {
  return `/wallpapers/${id}-${variant}${thumbnail ? "-thumb" : ""}.webp`;
}
