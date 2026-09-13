// =============================================================================
// Wallpaper — the background catalog
//
// The ambient background has always been a wallpaper; weather was just the only
// source of one. This module names the shared concept and adds the second kind,
// so the provider can hold ONE background stack fed by exactly one kind at a
// time:
//
//     wallpaperKind: "weather"  →  the live weather/sun-event gradient
//                    "image"    →  a fixed pair from this catalog
//
// Mutual exclusivity is therefore structural, not a rule anyone has to remember:
// there is a single stack, and a single kind feeds it. Where that stack paints
// (full page / widget cards / nowhere) stays the job of `weatherGradientMode`.
//
// The sun-event Live Activity (systems/ambient/components/phase-activity.tsx)
// reads weather + phase directly and never touches the background, so it keeps
// announcing sunrise/sunset under an image wallpaper too.
//
// Every wallpaper is a light/dark pair, and which half shows always follows the
// app theme. That is not a setting: pinning a half only ever produced light
// artwork under light text.
//
// ## The images
//
// Apple's own macOS and iOS default wallpapers, as light/dark pairs — the
// artwork these releases are recognised by. Sources and frame indices are
// recorded in `public/wallpapers/sources.json`; `pnpm wallpapers:check` verifies
// the committed files still match it.
//
// Apple retains rights to this artwork. It is committed here for a personal
// site, not licensed onward; the archives the frames were pulled from do not
// license Apple's images either, and their repository licenses are not asserted
// to do so.
// =============================================================================

export type WallpaperKind = "weather" | "image";

export type WallpaperPlatform = "macOS" | "iPadOS" | "iOS";

export interface WallpaperAsset {
  /** Full-size WebP, at most 2560px on the long edge. */
  src: string;
  /** 480px rendition for picker tiles and devtool swatches. */
  thumb: string;
  /** Average colour, painted under the image so the frame is never bare. */
  base: string;
}

export interface Wallpaper {
  id: string;
  /** Release name — a proper noun, shown untranslated. */
  name: string;
  platform: WallpaperPlatform;
  /** Release year, shown as the caption next to the platform. */
  year: number;
  /**
   * Overrides the `platform · year` caption.
   *
   * The caption says where the artwork comes from, so it should not repeat what
   * the name already said: the iPadOS colourways are named for the release, and
   * "iPadOS 18 Violet — iPadOS · 2024" both stutters and overflows the tile.
   */
  caption?: string;
  /** The light/dark pair. "auto" picks between these by theme. */
  light: WallpaperAsset;
  dark: WallpaperAsset;
}

/** A variant resolved into something renderable by <GradientStack />. */
export interface ResolvedWallpaper {
  backgroundImage: string;
  /** Images must cover the frame; the weather gradient already fills it. */
  cover: boolean;
  /** The file behind it, for the devtool readout. */
  src: string | null;
}

/**
 * How strongly the wallpaper layer itself paints.
 *
 * An image wallpaper paints at FULL STRENGTH. It is a photograph someone chose;
 * showing it at half opacity over the page background is not "tasteful
 * restraint", it is a washed-out picture. The home screen is a desktop — the
 * picture is the content, and the widgets float on it.
 *
 * The weather gradient is different in kind: a wash, authored to sit under
 * content, and it reads as intended below full strength.
 */
export const WALLPAPER_OPACITY: Record<
  WallpaperKind,
  { light: number; dark: number }
> = {
  weather: { light: 0.7, dark: 0.85 },
  image: { light: 1, dark: 1 },
};

/**
 * What is drawn OVER an image wallpaper, in two parts.
 *
 * `VEIL` is flat — it dims the whole frame equally, which is what protects a
 * prose column and what "dim home" used to be made of entirely. `VIGNETTE` is
 * radial, dark at the margins and clear through the middle.
 *
 * Most of the weight lives in the vignette on purpose. A flat wash spends its
 * whole budget flattening the picture: everything recedes by the same amount,
 * so nothing recedes *relative* to anything. Moving that same budget into the
 * radial buys depth for free — the middle comes back to nearly its own colour
 * while the shoulders fall away, which is what a desktop actually looks like
 * and the reason macOS ships photographs with the light in the centre.
 *
 * Two strengths of each, because they answer different questions:
 *
 *   scrim   the home screen. Almost no flat component at all: the picture is
 *           the content, and the vignette alone is enough to seat the widgets
 *           on it rather than leave them floating on raw artwork.
 *   reading enough that a prose column wins, and no more. The BLUR is what
 *           actually protects legibility here; these two only have to stop the
 *           remaining colour from shouting, so they stay well under the
 *           ~0.45/0.55 the same idea usually gets built with.
 */
export const WALLPAPER_VEIL = {
  scrim: { light: 0.03, dark: 0.05 },
  reading: { light: 0.26, dark: 0.3 },
} as const;

export const WALLPAPER_VIGNETTE = {
  scrim: { light: 0.3, dark: 0.4 },
  reading: { light: 0.32, dark: 0.4 },
} as const;

// -----------------------------------------------------------------------------
// Catalog
// -----------------------------------------------------------------------------

function pair(
  id: string,
  lightBase: string,
  darkBase: string
): Pick<Wallpaper, "light" | "dark"> {
  const base = `/wallpapers/${id}`;
  return {
    light: {
      src: `${base}/light.webp`,
      thumb: `${base}/light.thumb.webp`,
      base: lightBase,
    },
    dark: {
      src: `${base}/dark.webp`,
      thumb: `${base}/dark.thumb.webp`,
      base: darkBase,
    },
  };
}

export const BUILT_IN_WALLPAPERS: Wallpaper[] = [
  {
    id: "tahoe",
    name: "Tahoe",
    platform: "macOS",
    year: 2025,
    ...pair("tahoe", "rgb(59 125 182)", "rgb(25 39 123)"),
  },
  {
    id: "sequoia",
    name: "Sequoia",
    platform: "macOS",
    year: 2024,
    ...pair("sequoia", "rgb(119 113 149)", "rgb(47 93 173)"),
  },
  {
    id: "sonoma",
    name: "Sonoma",
    platform: "macOS",
    year: 2023,
    ...pair("sonoma", "rgb(135 148 111)", "rgb(57 104 109)"),
  },
  {
    id: "ventura",
    name: "Ventura",
    platform: "macOS",
    year: 2022,
    ...pair("ventura", "rgb(198 140 89)", "rgb(118 43 28)"),
  },
  {
    id: "monterey",
    name: "Monterey",
    platform: "macOS",
    year: 2021,
    ...pair("monterey", "rgb(152 88 187)", "rgb(52 14 120)"),
  },
  {
    id: "big-sur",
    name: "Big Sur",
    platform: "macOS",
    year: 2020,
    ...pair("big-sur", "rgb(123 101 140)", "rgb(74 36 71)"),
  },
  {
    id: "ipados-18-violet",
    name: "iPadOS 18 Violet",
    platform: "iPadOS",
    year: 2024,
    caption: "2024",
    ...pair("ipados-18-violet", "rgb(122 97 151)", "rgb(64 45 60)"),
  },
  {
    id: "ipados-18-indigo",
    name: "iPadOS 18 Indigo",
    platform: "iPadOS",
    year: 2024,
    caption: "2024",
    ...pair("ipados-18-indigo", "rgb(69 106 173)", "rgb(47 54 79)"),
  },
  {
    id: "ipados-18-blue",
    name: "iPadOS 18 Blue",
    platform: "iPadOS",
    year: 2024,
    caption: "2024",
    ...pair("ipados-18-blue", "rgb(91 132 173)", "rgb(36 49 92)"),
  },
  {
    id: "ipados-18-teal",
    name: "iPadOS 18 Teal",
    platform: "iPadOS",
    year: 2024,
    caption: "2024",
    ...pair("ipados-18-teal", "rgb(80 130 143)", "rgb(34 55 75)"),
  },
  {
    id: "ios-27",
    name: "iOS 27",
    platform: "iOS",
    year: 2026,
    ...pair("ios-27", "rgb(118 109 112)", "rgb(41 44 64)"),
  },
  {
    id: "ios-18",
    name: "iOS 18",
    platform: "iOS",
    year: 2024,
    ...pair("ios-18", "rgb(71 106 128)", "rgb(7 11 15)"),
  },
  {
    id: "ios-17",
    name: "iOS 17",
    platform: "iOS",
    year: 2023,
    ...pair("ios-17", "rgb(149 102 125)", "rgb(98 39 106)"),
  },
  {
    id: "ios-14",
    name: "iOS 14",
    platform: "iOS",
    year: 2020,
    ...pair("ios-14", "rgb(180 116 117)", "rgb(55 26 38)"),
  },
  {
    id: "ios-13",
    name: "iOS 13",
    platform: "iOS",
    year: 2019,
    ...pair("ios-13", "rgb(227 122 82)", "rgb(98 13 31)"),
  },
];

/**
 * Is this phone artwork?
 *
 * Derived, not stored. It was a flag once, set by hand on the pairs whose files
 * happen to be tall — which quietly made it mean "this file is portrait" rather
 * than "this is a phone wallpaper". Those are not the same thing: iOS 13, 14
 * and 17 are phone wallpapers too, but they were centre-cropped to square on
 * import, so they lost a glyph that describes the artwork, not the encoding.
 *
 * The glyph says phone, so it means phone. Every iOS wallpaper is one, and
 * every one of them shows a crop of itself on a desktop viewport — the tall
 * files just crop harder.
 */
export function isPhoneWallpaper(wallpaper: Wallpaper): boolean {
  return wallpaper.platform === "iOS";
}

export const DEFAULT_WALLPAPER_ID = BUILT_IN_WALLPAPERS[0].id;

const BY_ID = new Map(BUILT_IN_WALLPAPERS.map((w) => [w.id, w]));

export function getWallpaper(id: string): Wallpaper | null {
  return BY_ID.get(id) ?? null;
}

/** The stored id, falling back to the default when it no longer exists. */
export function getWallpaperOrDefault(id: string): Wallpaper {
  return BY_ID.get(id) ?? BUILT_IN_WALLPAPERS[0];
}

function buildAsset(asset: WallpaperAsset, preview: boolean): ResolvedWallpaper {
  const url = preview ? asset.thumb : asset.src;
  return {
    // The flat base sits under the image so the frame is never bare while it
    // decodes (and shows through any letterboxing on odd aspect ratios).
    backgroundImage: `url("${url}"), linear-gradient(180deg, ${asset.base} 0%, ${asset.base} 100%)`,
    cover: true,
    src: url,
  };
}

/**
 * Resolve a wallpaper to a renderable background.
 *
 * Which half of the pair shows always follows the app theme — the macOS
 * Dynamic Desktop behaviour. There is deliberately no way to pin a half: the
 * only thing pinning ever bought was light artwork under light text, and the
 * damping needed to rescue that made the wallpaper a ghost anyway.
 */
export function getWallpaperBackground(params: {
  wallpaper: Wallpaper;
  theme: "light" | "dark";
  /** Preview surfaces resolve to the thumb rendition. */
  preview?: boolean;
}): ResolvedWallpaper {
  return buildAsset(params.wallpaper[params.theme], params.preview ?? false);
}

/**
 * Both halves at once — for the pair tiles in the picker and the devtool.
 * Always the thumb rendition, so opening the picker pulls tens of kilobytes
 * rather than the whole catalog.
 */
export function getWallpaperPairPreview(wallpaper: Wallpaper): {
  light: ResolvedWallpaper;
  dark: ResolvedWallpaper;
} {
  return {
    light: buildAsset(wallpaper.light, true),
    dark: buildAsset(wallpaper.dark, true),
  };
}

