// =============================================================================
// The committed profile table, looked up by key. Kept apart from
// `wallpaper-profile.ts` (types and keys) because the profiler script that
// writes the JSON imports that module under plain Node, which needs an import
// attribute for JSON that the bundler does not.
// =============================================================================

import {
  profileKeyForAsset,
  profileKeyForWeather,
  type WallpaperProfile,
  type WallpaperProfiles,
  type WeatherProfileParams,
} from "./wallpaper-profile";
import type { WallpaperAsset } from "./wallpaper";
import profilesJson from "./wallpaper-profiles.json";

// JSON widens the `mean` tuple to number[]; the profiler wrote three bytes.
export const WALLPAPER_PROFILES = profilesJson as unknown as WallpaperProfiles;

export function getImageProfile(asset: WallpaperAsset): WallpaperProfile | null {
  return WALLPAPER_PROFILES.images[profileKeyForAsset(asset)] ?? null;
}

export function getWeatherProfile(params: WeatherProfileParams): WallpaperProfile | null {
  return WALLPAPER_PROFILES.weather[profileKeyForWeather(params)] ?? null;
}
