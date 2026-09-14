import {
  clampBezelBand,
  clampBezelRadius,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
  isBezelTint,
  type BezelGround,
  type BezelTint,
} from "@/systems/bezel";
import type { LocationMode } from "./location";

/**
 * The page's own ground, per theme — `--background` in globals.css, as a hex
 * a script can hand to a browser before any stylesheet exists. The browser's
 * chrome takes it when there is no frame, and the `dark` and `theme` bezel
 * tints resolve against it.
 */
export const PAGE_GROUND: BezelGround = { light: "#ffffff", dark: "#1a1a1a" };

/** The frame's colour when nothing is stored: dark in both themes. */
export const DEFAULT_LETTERBOX_TINT: BezelTint = "dark";
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
  /**
   * What colour the frame is: a named tint or a `#rrggbb` literal. See
   * `BezelTint` in @/systems/bezel.
   */
  wallpaperLetterboxTint: BezelTint;
  /**
   * How thick the bands are where the safe area is thinner, in px. Floored at
   * `BEZEL_BAND_MIN` for a reason — see @/systems/bezel.
   */
  wallpaperLetterboxBand: number;
  /** Defocus the wallpaper on reading pages so prose stays the figure. */
  wallpaperReadingBlur: boolean;
  /** Veil the wallpaper on reading pages. */
  wallpaperReadingDim: boolean;
}

const SETTINGS_KEY = "hux_ambient_settings";

export function getDefaultSettings(): AmbientSettings {
  return {
    locationMode: "ip",
    wallpaperPlacement: "full",
    wallpaperKind: "weather",
    wallpaperId: DEFAULT_WALLPAPER_ID,
    wallpaperLetterbox: null,
    wallpaperLetterboxRadius: DEFAULT_BEZEL_RADIUS,
    wallpaperLetterboxTint: DEFAULT_LETTERBOX_TINT,
    wallpaperLetterboxBand: DEFAULT_BEZEL_BAND,
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
          ? clampBezelRadius(parsed.wallpaperLetterboxRadius)
          : DEFAULT_BEZEL_RADIUS,
      wallpaperLetterboxTint: isBezelTint(parsed.wallpaperLetterboxTint)
        ? parsed.wallpaperLetterboxTint
        : DEFAULT_LETTERBOX_TINT,
      wallpaperLetterboxBand:
        typeof parsed.wallpaperLetterboxBand === "number" &&
        Number.isFinite(parsed.wallpaperLetterboxBand)
          ? clampBezelBand(parsed.wallpaperLetterboxBand)
          : DEFAULT_BEZEL_BAND,
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
