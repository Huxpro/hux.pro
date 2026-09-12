import { DEFAULT_WALLPAPER, parseWallpaper, type WallpaperSettings } from "../../wallpaper/catalog.ts";
import type { LocationMode } from "./location";

// =============================================================================
// Ambient Settings
// =============================================================================

export type WeatherGradientMode = "full" | "off" | "widget";

export interface AmbientSettings {
  locationMode: LocationMode;
  wallpaper: WallpaperSettings;
  weatherGradientMode: WeatherGradientMode;
}

const SETTINGS_KEY = "hux_ambient_settings";

export function getDefaultSettings(): AmbientSettings {
  return {
    locationMode: "ip",
    wallpaper: { ...DEFAULT_WALLPAPER },
    weatherGradientMode: "full",
  };
}

export function getAmbientSettings(options?: {
  isIOS?: boolean;
}): AmbientSettings {
  if (typeof window === "undefined") {
    return getDefaultSettings();
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      // No user preference stored yet — iOS defaults to widget mode
      return {
        ...getDefaultSettings(),
        ...(options?.isIOS && { weatherGradientMode: "widget" as const }),
      };
    }

    const parsed = JSON.parse(stored) as Partial<AmbientSettings> & {
      weatherGradientMode?: string;
    };
    if (!parsed || typeof parsed !== "object") return getDefaultSettings();
    const defaults = getDefaultSettings();

    // Migration: treat old "adaptive" as "full"
    let mode = defaults.weatherGradientMode;
    if (
      parsed.weatherGradientMode === "full" ||
      parsed.weatherGradientMode === "off" ||
      parsed.weatherGradientMode === "widget"
    ) {
      mode = parsed.weatherGradientMode;
    } else if (parsed.weatherGradientMode === "adaptive") {
      mode = "full";
    }

    return {
      locationMode:
        parsed.locationMode === "accurate" ? "accurate" : defaults.locationMode,
      weatherGradientMode: mode,
      wallpaper: parseWallpaper(parsed?.wallpaper, mode === "off"),
    };
  } catch {
    return getDefaultSettings();
  }
}

export function setAmbientSettings(settings: AmbientSettings): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}
