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

/**
 * The frame's colour when nothing is stored: black, as ryOS. The colour is
 * fixed per page load even though the frame turns on and off live — see
 * @/systems/bezel/tint. A stored `"theme"` from before that tint was removed no
 * longer parses and falls back to this.
 */
export const DEFAULT_LETTERBOX_TINT: BezelTint = "black";

/**
 * What each kind of wallpaper wants at the edge when nothing is pinned.
 *
 * The two want opposite things, which is why this is a table and not one set
 * of defaults. A weather gradient IS the page's own colour pushed to the
 * edges, so the honest treatment is to let it fade out into the ground: the
 * soft edge, no frame. A photograph is a picture ON the page, so fading it is
 * a printing error — it wants to end on a line, which is the frame, and it
 * wants as much of the screen as it can get, which is a band of nothing and
 * corners just large enough to read as a bezel.
 *
 * This table is the whole relationship. With nothing overridden, the provider
 * resolves each page from it, live, as the kind changes:
 *
 *   letterbox  frame on?          `wallpaperLetterbox` overrides it
 *   softEdge   fade on?           only while the frame is off; the devtool
 *                                 row overrides it
 *   band       frame thickness    `wallpaperLetterboxBand` overrides it
 *   radius     frame corners      `wallpaperLetterboxRadius` overrides it
 *
 * Both treatments are gated on iOS in the provider: they are phone treatments,
 * and a desktop window gets neither unless it is overridden on.
 */
export interface WallpaperKindDefaults {
  /** Whether this kind is framed (letterboxed) by default. */
  letterbox: boolean;
  /** Whether this kind fades out at the edges by default, when not framed. */
  softEdge: boolean;
  /** Frame band thickness, px. */
  band: number;
  /** Frame corner radius, px. */
  radius: number;
}

export const WALLPAPER_KIND_DEFAULTS: Record<WallpaperKind, WallpaperKindDefaults> = {
  weather: {
    letterbox: false,
    softEdge: true,
    band: DEFAULT_BEZEL_BAND,
    radius: DEFAULT_BEZEL_RADIUS,
  },
  image: {
    letterbox: true,
    softEdge: false,
    band: 0,
    radius: 16,
  },
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
  /**
   * Letterbox: paint everything outside the page's safe area — the notch
   * band, the home-indicator band, the browser chrome, the overscroll — solid
   * black, and keep the wallpaper inside it. `null` means auto: on for iOS
   * browsers, off elsewhere. See `letterbox` in the provider.
   */
  wallpaperLetterbox: boolean | null;
  /** Corner radius of the page inside the frame, px. `null` follows the kind. */
  wallpaperLetterboxRadius: number | null;
  /**
   * What colour the frame is: a named tint or a `#rrggbb` literal. Read once,
   * at load; a change takes effect on the next one. See `BezelTint`.
   */
  wallpaperLetterboxTint: BezelTint;
  /**
   * How thick the bands are, in px. `null` follows the wallpaper kind — see
   * `WALLPAPER_KIND_DEFAULTS`. Thinner than `BEZEL_CHROME_SAMPLE_PX` and the
   * browser's chrome stops matching; see @/systems/bezel for why that is a
   * threshold rather than a floor.
   */
  wallpaperLetterboxBand: number | null;
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
    wallpaperLetterboxRadius: null,
    wallpaperLetterboxTint: DEFAULT_LETTERBOX_TINT,
    wallpaperLetterboxBand: null,
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
      wallpaperId,
      wallpaperLetterbox:
        typeof parsed.wallpaperLetterbox === "boolean"
          ? parsed.wallpaperLetterbox
          : null,
      wallpaperLetterboxRadius:
        typeof parsed.wallpaperLetterboxRadius === "number" &&
        Number.isFinite(parsed.wallpaperLetterboxRadius)
          ? clampBezelRadius(parsed.wallpaperLetterboxRadius)
          : null,
      wallpaperLetterboxTint: isBezelTint(parsed.wallpaperLetterboxTint)
        ? parsed.wallpaperLetterboxTint
        : DEFAULT_LETTERBOX_TINT,
      wallpaperLetterboxBand:
        typeof parsed.wallpaperLetterboxBand === "number" &&
        Number.isFinite(parsed.wallpaperLetterboxBand)
          ? clampBezelBand(parsed.wallpaperLetterboxBand)
          : null,
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
