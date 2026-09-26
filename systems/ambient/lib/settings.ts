import { clampBezelBand, clampBezelRadius } from "vitre";
import { DEFAULT_BEZEL_TINT, isBezelTint, type BezelTint } from "./bezel";
import type { LocationMode } from "./location";
import {
  DEFAULT_WALLPAPER_ID,
  getWallpaper,
  readWallpaperPlay,
  readWallpaperPlayAlbum,
  readWallpaperPlayEvery,
  readWallpaperPlayOrder,
  readWeatherStyle,
  type WallpaperKind,
  type WallpaperPlay,
  type WallpaperPlayAlbum,
  type WallpaperPlayEvery,
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
   * When the image kind is playing an album rather than pinning one still.
   * `off` is a tap on a specific tile; Shuffle and Loop are the two mode
   * tiles at the front of Apple and Nature.
   */
  wallpaperPlay: WallpaperPlay;
  /** Which album Shuffle / Loop walks. Null while play is off. */
  wallpaperAlbum: WallpaperPlayAlbum | null;
  /** iOS Shuffle Frequency. Kept when play is off so the next Shuffle remembers. */
  wallpaperPlayEvery: WallpaperPlayEvery;
  /** Catalog / permutation index of the frame showing. */
  wallpaperPlayIndex: number;
  /** Shuffle's permutation of the album; Loop stores catalog order. */
  wallpaperPlayOrder: string[];
  /** Wall-clock ms of the last advance — Hourly and Daily compare against this. */
  wallpaperPlayAt: number;
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
  /**
   * Rain and snow fall along the device's gyroscope rather than straight down
   * the page (Sky only — see lib/gyroscope.ts). On by default: where the
   * browser hands over motion freely it just works, and where it does not
   * this is the wish waiting for the one tap that grants it.
   */
  weatherGyro: boolean;
  /**
   * WebKit only: motion access has been granted on this origin before, so it
   * can be re-taken silently on the next load. Without this record nothing
   * asks unprompted, and a visitor who has never answered is never prompted
   * out of nowhere.
   */
  weatherGyroGranted: boolean;
  /**
   * The tilt has been offered once, on a rainy or snowy sky, and answered —
   * taken or waved off. The offer is a one-time introduction to something the
   * visitor did not ask about, and a second one would be nagging — so this is
   * cleared only when a grant it led to has lapsed, or the ask never reached a
   * dialog. See lib/tilt-primer.ts.
   */
  weatherGyroPrimed: boolean;
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
    weatherGyro: true,
    weatherGyroGranted: false,
    weatherGyroPrimed: false,
    wallpaperId: DEFAULT_WALLPAPER_ID,
    wallpaperPlay: "off",
    wallpaperAlbum: null,
    wallpaperPlayEvery: "hourly",
    wallpaperPlayIndex: 0,
    wallpaperPlayOrder: [],
    wallpaperPlayAt: 0,
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

    const wallpaperAlbum = readWallpaperPlayAlbum(parsed.wallpaperAlbum);
    const wallpaperPlay = readWallpaperPlay(parsed.wallpaperPlay);
    // A saved Shuffle with a missing album is a pinned still.
    const play =
      wallpaperPlay !== "off" && wallpaperAlbum ? wallpaperPlay : defaults.wallpaperPlay;

    return {
      locationMode:
        parsed.locationMode === "accurate" ? "accurate" : defaults.locationMode,
      wallpaperPlacement: placement,
      wallpaperKind:
        parsed.wallpaperKind === "image" ? "image" : defaults.wallpaperKind,
      weatherStyle: readWeatherStyle(parsed.weatherStyle),
      weatherGyro: parsed.weatherGyro !== false,
      weatherGyroGranted: parsed.weatherGyroGranted === true,
      weatherGyroPrimed: parsed.weatherGyroPrimed === true,
      wallpaperId,
      wallpaperPlay: play,
      wallpaperAlbum: play === "off" ? null : wallpaperAlbum,
      wallpaperPlayEvery: readWallpaperPlayEvery(parsed.wallpaperPlayEvery),
      wallpaperPlayIndex:
        typeof parsed.wallpaperPlayIndex === "number" && Number.isFinite(parsed.wallpaperPlayIndex)
          ? Math.max(0, Math.floor(parsed.wallpaperPlayIndex))
          : defaults.wallpaperPlayIndex,
      wallpaperPlayOrder: readWallpaperPlayOrder(parsed.wallpaperPlayOrder, wallpaperAlbum),
      wallpaperPlayAt:
        typeof parsed.wallpaperPlayAt === "number" && Number.isFinite(parsed.wallpaperPlayAt)
          ? parsed.wallpaperPlayAt
          : defaults.wallpaperPlayAt,
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
