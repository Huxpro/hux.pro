import type { LocationMode } from "./location";
import {
  DEFAULT_WALLPAPER_ID,
  getWallpaper,
  type WallpaperKind,
} from "./wallpaper";

// =============================================================================
// Ambient Settings
// =============================================================================

/**
 * Where the wallpaper paints. Named for weather because that was the only
 * source when it shipped; it now governs whichever source is active.
 *   full   — behind the whole page
 *   widget — only inside widget cards
 *   off    — nowhere (the global background kill switch)
 */
export type WeatherGradientMode = "full" | "off" | "widget";

export interface AmbientSettings {
  locationMode: LocationMode;
  weatherGradientMode: WeatherGradientMode;
  /** Which kind feeds the single background stack. */
  wallpaperKind: WallpaperKind;
  /** Selected built-in pair, used when `wallpaperKind === "image"`. */
  wallpaperId: string;
  /**
   * The home-screen scrim. On by default, but it is a whisper (see
   * WALLPAPER_VEIL.scrim): enough to seat the widgets on the picture rather
   * than leave them floating on raw artwork, and far short of the reading veil.
   * Turning it off shows the wallpaper at its own colour.
   */
  wallpaperDimHome: boolean;
  /** Defocus the wallpaper on reading pages so prose stays the figure. */
  wallpaperReadingBlur: boolean;
  /** Veil the wallpaper on reading pages. */
  wallpaperReadingDim: boolean;
}

const SETTINGS_KEY = "hux_ambient_settings";

export function getDefaultSettings(): AmbientSettings {
  return {
    locationMode: "ip",
    weatherGradientMode: "full",
    wallpaperKind: "weather",
    wallpaperId: DEFAULT_WALLPAPER_ID,
    wallpaperDimHome: true,
    wallpaperReadingBlur: true,
    wallpaperReadingDim: true,
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
      wallpaperKind?: string;
      wallpaperSource?: string;
    };
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

    // Unknown / removed wallpaper ids fall back rather than blanking the page.
    const wallpaperId =
      typeof parsed.wallpaperId === "string" && getWallpaper(parsed.wallpaperId)
        ? parsed.wallpaperId
        : defaults.wallpaperId;

    return {
      locationMode:
        parsed.locationMode === "accurate" ? "accurate" : defaults.locationMode,
      weatherGradientMode: mode,
      // `wallpaperSource: "picture"` was the field's first spelling.
      wallpaperKind:
        parsed.wallpaperKind === "image" || parsed.wallpaperSource === "picture"
          ? "image"
          : defaults.wallpaperKind,
      wallpaperId,
      wallpaperDimHome: parsed.wallpaperDimHome !== false,
      wallpaperReadingBlur: parsed.wallpaperReadingBlur !== false,
      wallpaperReadingDim: parsed.wallpaperReadingDim !== false,
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
