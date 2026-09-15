// =============================================================================
// Wallpaper profiles — what was measured about each wallpaper, once.
//
// `scripts/wallpaper-profile.ts` samples every committed picture (and
// synthesises the weather gradients from their palettes) and writes the
// results to `wallpaper-profiles.json` beside this file. Nothing at runtime
// decodes an image or touches a canvas: the profile is a dozen numbers per
// wallpaper, looked up by key.
//
// A profile is a fact about a file. What to do about it — how much text relief
// a busy picture earns, whether bare text flips to light ink over a dark top
// band — is the policy in `legibility.ts`, which the Legibility Lab can tune
// while looking at the result.
// =============================================================================

import type { SunEvent } from "./sun";
import type { WallpaperAsset } from "./wallpaper";
import type { WeatherCondition } from "./weather";

// Types and keys only. The table itself is imported by `legibility.ts`, so
// that the profiler script (plain Node, which needs an import attribute for
// JSON) can share this module without dragging the JSON in.

export interface WallpaperTint {
  /** OKLCH lightness of the dominant colour, 0..1 */
  l: number;
  /** OKLCH chroma of the dominant colour */
  c: number;
  /** OKLCH hue of the dominant colour, degrees */
  h: number;
}

export interface WallpaperProfile {
  /** Mean OKLab lightness of the frame, 0..1 */
  lum: number;
  /** Mean lightness of the top / middle / bottom thirds. */
  zones: { top: number; mid: number; bottom: number };
  /** Mean colour as sRGB bytes — for the lab's contrast estimate. */
  mean: [number, number, number];
  /** Standard deviation of lightness — how much the picture varies. */
  contrast: number;
  /** Mean local gradient of lightness — how much fine detail there is. */
  edges: number;
  /** Mean OKLab chroma — how colourful the picture is. */
  chroma: number;
  /** Dominant chromatic colour, or null when the picture is effectively grey. */
  tint: WallpaperTint | null;
}

export interface WallpaperProfiles {
  grid: { width: number; height: number };
  /** Keyed by `profileKeyForAsset`. */
  images: Record<string, WallpaperProfile>;
  /** Keyed by `profileKeyForWeather`. */
  weather: Record<string, WallpaperProfile>;
}

/** `tahoe/light`, `nature/aurora` — the file path minus the noise. */
export function profileKeyForAsset(asset: WallpaperAsset): string {
  return asset.src.replace(/^\/wallpapers\//, "").replace(/\.webp$/, "");
}

export type WeatherProfileParams =
  | { condition: WeatherCondition; isDay: boolean; theme: "light" | "dark" }
  | { event: SunEvent; theme: "light" | "dark" };

/** `clear/day/light`, `sunset/dark`. */
export function profileKeyForWeather(params: WeatherProfileParams): string {
  if ("event" in params) return `${params.event}/${params.theme}`;
  return `${params.condition}/${params.isDay ? "day" : "night"}/${params.theme}`;
}

/**
 * The profile of the plain page — no wallpaper at all. Flat, grey, and exactly
 * as bright as the theme's background, so the policy resolves to "nothing to
 * do", which is what the main path should cost.
 */
export function getPlainProfile(theme: "light" | "dark"): WallpaperProfile {
  const lum = theme === "dark" ? 0.2178 : 1;
  const byte = theme === "dark" ? 26 : 255;
  return {
    lum,
    zones: { top: lum, mid: lum, bottom: lum },
    mean: [byte, byte, byte],
    contrast: 0,
    edges: 0,
    chroma: 0,
    tint: null,
  };
}
