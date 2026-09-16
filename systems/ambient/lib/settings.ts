import { clampBezelBand, clampBezelRadius } from "@hux/bezel";
import { DEFAULT_BEZEL_TINT, isBezelTint, type BezelTint } from "./bezel";
import type { LocationMode } from "./location";
import {
  DEFAULT_WALLPAPER_ID,
  getWallpaper,
  readWeatherStyle,
  type WallpaperKind,
  type WeatherStyle,
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
  /**
   * Which of the three weather wallpapers paints when `wallpaperKind` is
   * "weather": the animated Sky, the live Gradient, or the Classic palettes.
   * Sky falls back to Gradient on its own when WebGL2 is missing; the setting
   * records the wish.
   */
  weatherStyle: WeatherStyle;
  /** Selected built-in pair, used when `wallpaperKind === "image"`. */
  wallpaperId: string;
  /**
   * The bezel's colour: a named tint or a `#rrggbb` literal. Whether the bezel
   * is on is not a setting — the wallpaper kind decides, and the devtool can
   * override it for the session. See `WALLPAPER_FAMILY_EDGES`.
   */
  bezelTint: BezelTint;
  /** Band thickness, px. `null` is `DEFAULT_BEZEL_BAND`. The same for every kind. */
  bezelBand: number | null;
  /** Inner corner radius, px. `null` is `DEFAULT_BEZEL_RADIUS`. The same for every kind. */
  bezelRadius: number | null;
  /**
   * At sunrise and sunset, the app theme follows the sun — Light while the sun
   * is up, Dark once it is down. It only ever switches on a crossing the
   * session watched happen, and it never writes the Appearance preference: the
   * switch is a session override (see services/theme.tsx). On by default; this
   * is the flag that turns it off.
   */
  themeFollowsSun: boolean;
  /** Defocus the wallpaper on reading pages so prose stays the figure. */
  wallpaperReadingBlur: boolean;
  /** Veil the wallpaper on reading pages. */
  wallpaperReadingDim: boolean;
}

const SETTINGS_KEY = "hux_ambient_settings";

function finiteOrNull(value: unknown, clamp: (n: number) => number): number | null {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value) : null;
}

export function getDefaultSettings(): AmbientSettings {
  return {
    locationMode: "ip",
    wallpaperPlacement: "full",
    wallpaperKind: "weather",
    weatherStyle: "sky",
    wallpaperId: DEFAULT_WALLPAPER_ID,
    bezelTint: DEFAULT_BEZEL_TINT,
    bezelBand: null,
    bezelRadius: null,
    themeFollowsSun: true,
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
      wallpaperLetterboxTint?: unknown;
      wallpaperLetterboxBand?: unknown;
      wallpaperLetterboxRadius?: unknown;
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
      wallpaperKind:
        parsed.wallpaperKind === "image" ? "image" : defaults.wallpaperKind,
      weatherStyle: readWeatherStyle(parsed.weatherStyle),
      wallpaperId,
      // `wallpaperLetterbox*` were these fields' names before the bezel was
      // its own package.
      bezelTint: isBezelTint(parsed.bezelTint ?? parsed.wallpaperLetterboxTint)
        ? ((parsed.bezelTint ?? parsed.wallpaperLetterboxTint) as BezelTint)
        : DEFAULT_BEZEL_TINT,
      bezelBand: finiteOrNull(parsed.bezelBand ?? parsed.wallpaperLetterboxBand, clampBezelBand),
      bezelRadius: finiteOrNull(
        parsed.bezelRadius ?? parsed.wallpaperLetterboxRadius,
        clampBezelRadius
      ),
      // Default on: only an explicit false turns the sun off.
      themeFollowsSun: parsed.themeFollowsSun !== false,
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
