import type { LocationMode } from "./location";

/**
 * What each kind of wallpaper wants at the edge when nothing is overridden.
 *
 * The two want opposite things, which is why this is a table and not one
 * default. A weather gradient IS the page's own colour pushed to the edges, so
 * the honest treatment is to let it fade out into the ground: the soft edge. A
 * photograph is a picture ON the page, so fading it is a printing error — it
 * wants to end on a line.
 *
 * Still gated on iOS in the provider: the fade is a phone treatment, and a
 * desktop window never gets it.
 */
export interface WallpaperKindDefaults {
  softEdge: boolean;
}

export const WALLPAPER_KIND_DEFAULTS: Record<WallpaperKind, WallpaperKindDefaults> = {
  weather: { softEdge: true },
  image: { softEdge: false },
};
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
