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
 * Where the active wallpaper paints.
 *
 *   full   — behind the whole page
 *   widget — only inside widget cards
 *   off    — nowhere (the global background kill switch)
 */
export type WallpaperPlacement = "full" | "off" | "widget";

export interface AmbientSettings {
  locationMode: LocationMode;
  wallpaperPlacement: WallpaperPlacement;
  /** Which kind feeds the single background stack. */
  wallpaperKind: WallpaperKind;
  /** Selected built-in pair, used when `wallpaperKind === "image"`. */
  wallpaperId: string;
  /**
   * Letterbox: paint everything outside the page's safe area — the notch
   * band, the home-indicator band, the browser chrome, the overscroll — solid
   * black, and keep the wallpaper inside it. `null` means auto: on for iOS
   * browsers, off elsewhere. See `letterbox` in the provider.
   */
  wallpaperLetterbox: boolean | null;
  /** Corner radius of the page inside the letterbox frame, in px. */
  wallpaperLetterboxRadius: number;
  /** Defocus the wallpaper on reading pages so prose stays the figure. */
  wallpaperReadingBlur: boolean;
  /** Veil the wallpaper on reading pages. */
  wallpaperReadingDim: boolean;
}

const SETTINGS_KEY = "hux_ambient_settings";

/** ryOS ships 12; a phone's own corners are far larger, and 24 reads as one. */
export const DEFAULT_LETTERBOX_RADIUS = 24;

export function getDefaultSettings(): AmbientSettings {
  return {
    locationMode: "ip",
    wallpaperPlacement: "full",
    wallpaperKind: "weather",
    wallpaperId: DEFAULT_WALLPAPER_ID,
    wallpaperLetterbox: null,
    wallpaperLetterboxRadius: DEFAULT_LETTERBOX_RADIUS,
    wallpaperReadingBlur: true,
    wallpaperReadingDim: true,
  };
}

export function getAmbientSettings(): AmbientSettings {
  if (typeof window === "undefined") {
    return getDefaultSettings();
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) return getDefaultSettings();

    const parsed = JSON.parse(stored) as Partial<AmbientSettings> & {
      /** Legacy field names, still read so an existing visitor keeps their setup. */
      weatherGradientMode?: string;
      wallpaperKind?: string;
      wallpaperSource?: string;
    };
    const defaults = getDefaultSettings();

    // `weatherGradientMode` was the field's name while the weather gradient was
    // the only thing that could paint; "adaptive" was a mode it used to have.
    const storedPlacement = parsed.wallpaperPlacement ?? parsed.weatherGradientMode;
    let placement = defaults.wallpaperPlacement;
    if (
      storedPlacement === "full" ||
      storedPlacement === "off" ||
      storedPlacement === "widget"
    ) {
      placement = storedPlacement;
    } else if (storedPlacement === "adaptive") {
      placement = "full";
    }

    // Unknown / removed wallpaper ids fall back rather than blanking the page.
    const wallpaperId =
      typeof parsed.wallpaperId === "string" && getWallpaper(parsed.wallpaperId)
        ? parsed.wallpaperId
        : defaults.wallpaperId;

    return {
      locationMode:
        parsed.locationMode === "accurate" ? "accurate" : defaults.locationMode,
      wallpaperPlacement: placement,
      // `wallpaperSource: "picture"` was the field's first spelling.
      wallpaperKind:
        parsed.wallpaperKind === "image" || parsed.wallpaperSource === "picture"
          ? "image"
          : defaults.wallpaperKind,
      wallpaperId,
      wallpaperLetterbox:
        typeof parsed.wallpaperLetterbox === "boolean"
          ? parsed.wallpaperLetterbox
          : null,
      wallpaperLetterboxRadius:
        typeof parsed.wallpaperLetterboxRadius === "number" &&
        Number.isFinite(parsed.wallpaperLetterboxRadius)
          ? Math.min(64, Math.max(0, parsed.wallpaperLetterboxRadius))
          : DEFAULT_LETTERBOX_RADIUS,
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
