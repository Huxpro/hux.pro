import {
  DEFAULT_WALLPAPER_ID,
  getWallpaperPair,
  type WallpaperPair,
} from "./catalog";
import type { WallpaperAppearance, WallpaperKind } from "./settings";

export type ThemeVariant = "light" | "dark";

export function resolvePairVariant(
  appearance: WallpaperAppearance,
  theme: ThemeVariant
): ThemeVariant {
  return appearance === "auto" ? theme : appearance;
}

export function resolveWallpaperSrc(
  pair: WallpaperPair,
  appearance: WallpaperAppearance,
  theme: ThemeVariant,
  opts?: { thumb?: boolean }
): string {
  const variant = resolvePairVariant(appearance, theme);
  return opts?.thumb ? pair[variant].thumb : pair[variant].src;
}

export function resolveCatalogPair(imageId: string): WallpaperPair {
  return getWallpaperPair(imageId) ?? getWallpaperPair(DEFAULT_WALLPAPER_ID)!;
}

export function wallpaperLabel(params: {
  kind: WallpaperKind;
  pair: WallpaperPair;
  appearance: WallpaperAppearance;
  locale: "en" | "zh";
  weatherModeLabel?: string;
}): string {
  const { kind, pair, locale, weatherModeLabel } = params;
  if (kind === "weather") {
    const weather = locale === "zh" ? "天气" : "Weather";
    return weatherModeLabel ? `${weather} · ${weatherModeLabel}` : weather;
  }

  const name = locale === "zh" ? pair.nameZh : pair.name;
  return name;
}
