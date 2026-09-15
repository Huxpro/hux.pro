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
// (full page / widget cards / nowhere) is `wallpaperPlacement`.
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
// Two categories, both Apple's artwork:
//
//   apple   the macOS / iPadOS / iOS release wallpapers, as light/dark pairs —
//           the artwork these releases are recognised by.
//   nature  the Mac OS X Nature desktop pictures (Aurora, Zebra, …), taken
//           from ryOS. One photograph each, so both halves are the same file.
//
// Every committed file covers a 2560×1600 viewport with at most a 7% stretch.
// iOS 17, 18 and 27 did not (1.25×, 1.73× and 1.94×) and were removed. Sources
// and frame indices are recorded in `public/wallpapers/sources.json`;
// `pnpm wallpapers:check` verifies the committed files still match it, the
// resolutions below included.
//
// Apple retains rights to this artwork. It is committed here for a personal
// site, not licensed onward; the archives the frames were pulled from do not
// license Apple's images either, and their repository licenses are not asserted
// to do so.
// =============================================================================

export type WallpaperKind = "weather" | "image";

export type WallpaperPlatform = "macOS" | "iPadOS" | "iOS";

export type WallpaperCategory = "apple" | "nature";

/** In picker order. Labels are proper nouns or i18n keys resolved by the UI. */
export const WALLPAPER_CATEGORIES: readonly WallpaperCategory[] = [
  "apple",
  "nature",
];

export interface WallpaperAsset {
  /** Full-size WebP, at most 2560px on the long edge. */
  src: string;
  /** 480px rendition for picker tiles and devtool swatches. */
  thumb: string;
  /** Average colour, painted under the image so the layer is never bare. */
  base: string;
  /** Pixel size of `src`, shown in the picker. Checked against the file. */
  width: number;
  height: number;
}

export interface Wallpaper {
  id: string;
  /** Release or picture name — a proper noun, shown untranslated. */
  name: string;
  category: WallpaperCategory;
  /** Release platform. Only the release wallpapers have one. */
  platform?: WallpaperPlatform;
  /** Release year, shown as the caption next to the platform. */
  year?: number;
  /**
   * Overrides the `platform · year` caption.
   *
   * The caption says where the artwork comes from, so it should not repeat what
   * the name already said: the iPadOS colourways are named for the release, and
   * "iPadOS 18 Violet — iPadOS · 2024" both stutters and overflows the tile.
   */
  caption?: string;
  /**
   * The light/dark pair; the theme picks between them. A photograph has one
   * image, and both halves are that same asset — see `isSingleImage`.
   */
  light: WallpaperAsset;
  dark: WallpaperAsset;
}

/** A variant resolved into something renderable by <GradientStack />. */
export interface ResolvedWallpaper {
  backgroundImage: string;
  /** Images must cover the layer; the weather gradient already fills it. */
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
 * The flat veil drawn OVER an image wallpaper on a reading page.
 *
 * A photograph behind a 680px prose column is a competing figure, so reading
 * pages recede it: the layer is defocused (`wallpaperReadingBlur`) and this
 * veil sits on top (`wallpaperReadingDim`). Both are per-theme alphas of the
 * page background. The home screen gets neither — the picture is the content.
 */
export const WALLPAPER_READING_VEIL = { light: 0.45, dark: 0.55 } as const;

// -----------------------------------------------------------------------------
// Catalog
// -----------------------------------------------------------------------------

type Size = readonly [width: number, height: number];

/** A release pair: `public/wallpapers/<id>/{light,dark}.webp`, one size. */
function pair(
  id: string,
  lightBase: string,
  darkBase: string,
  [width, height]: Size
): Pick<Wallpaper, "light" | "dark"> {
  const base = `/wallpapers/${id}`;
  return {
    light: {
      src: `${base}/light.webp`,
      thumb: `${base}/light.thumb.webp`,
      base: lightBase,
      width,
      height,
    },
    dark: {
      src: `${base}/dark.webp`,
      thumb: `${base}/dark.thumb.webp`,
      base: darkBase,
      width,
      height,
    },
  };
}

/** A photograph: `public/wallpapers/nature/<id>.webp`, shown in both themes. */
function photo(
  id: string,
  base: string,
  [width, height]: Size
): Pick<Wallpaper, "light" | "dark"> {
  const asset: WallpaperAsset = {
    src: `/wallpapers/nature/${id}.webp`,
    thumb: `/wallpapers/nature/${id}.thumb.webp`,
    base,
    width,
    height,
  };
  return { light: asset, dark: asset };
}

export const BUILT_IN_WALLPAPERS: Wallpaper[] = [
  {
    id: "tahoe",
    name: "Tahoe",
    category: "apple",
    platform: "macOS",
    year: 2025,
    ...pair("tahoe", "rgb(59 125 182)", "rgb(25 39 123)", [2560, 2560]),
  },
  {
    id: "sequoia",
    name: "Sequoia",
    category: "apple",
    platform: "macOS",
    year: 2024,
    ...pair("sequoia", "rgb(119 113 149)", "rgb(47 93 173)", [2560, 2560]),
  },
  {
    id: "sonoma",
    name: "Sonoma",
    category: "apple",
    platform: "macOS",
    year: 2023,
    ...pair("sonoma", "rgb(135 148 111)", "rgb(57 104 109)", [2560, 2560]),
  },
  {
    id: "ventura",
    name: "Ventura",
    category: "apple",
    platform: "macOS",
    year: 2022,
    ...pair("ventura", "rgb(198 140 89)", "rgb(118 43 28)", [2560, 2560]),
  },
  {
    id: "monterey",
    name: "Monterey",
    category: "apple",
    platform: "macOS",
    year: 2021,
    ...pair("monterey", "rgb(152 88 187)", "rgb(52 14 120)", [2400, 2400]),
  },
  {
    id: "big-sur",
    name: "Big Sur",
    category: "apple",
    platform: "macOS",
    year: 2020,
    ...pair("big-sur", "rgb(123 101 140)", "rgb(74 36 71)", [2400, 2400]),
  },
  {
    id: "ipados-18-violet",
    name: "iPadOS 18 Violet",
    category: "apple",
    platform: "iPadOS",
    year: 2024,
    caption: "2024",
    ...pair("ipados-18-violet", "rgb(122 97 151)", "rgb(64 45 60)", [2560, 1779]),
  },
  {
    id: "ipados-18-indigo",
    name: "iPadOS 18 Indigo",
    category: "apple",
    platform: "iPadOS",
    year: 2024,
    caption: "2024",
    ...pair("ipados-18-indigo", "rgb(69 106 173)", "rgb(47 54 79)", [2560, 1779]),
  },
  {
    id: "ipados-18-blue",
    name: "iPadOS 18 Blue",
    category: "apple",
    platform: "iPadOS",
    year: 2024,
    caption: "2024",
    ...pair("ipados-18-blue", "rgb(91 132 173)", "rgb(36 49 92)", [2560, 1779]),
  },
  {
    id: "ipados-18-teal",
    name: "iPadOS 18 Teal",
    category: "apple",
    platform: "iPadOS",
    year: 2024,
    caption: "2024",
    ...pair("ipados-18-teal", "rgb(80 130 143)", "rgb(34 55 75)", [2560, 1779]),
  },
  {
    id: "ios-14",
    name: "iOS 14",
    category: "apple",
    platform: "iOS",
    year: 2020,
    ...pair("ios-14", "rgb(180 116 117)", "rgb(55 26 38)", [2400, 2400]),
  },
  {
    id: "ios-13",
    name: "iOS 13",
    category: "apple",
    platform: "iOS",
    year: 2019,
    ...pair("ios-13", "rgb(227 122 82)", "rgb(98 13 31)", [2400, 2400]),
  },
  {
    id: "aurora",
    name: "Aurora",
    category: "nature",
    ...photo("aurora", "rgb(118 86 113)", [2560, 1600]),
  },
  {
    id: "clown-fish",
    name: "Clown Fish",
    category: "nature",
    ...photo("clown-fish", "rgb(69 100 49)", [2560, 1600]),
  },
  {
    id: "dew-drop",
    name: "Dew Drop",
    category: "nature",
    ...photo("dew-drop", "rgb(79 137 90)", [2560, 1600]),
  },
  {
    id: "earth",
    name: "Earth",
    category: "nature",
    ...photo("earth", "rgb(25 34 45)", [2560, 1600]),
  },
  {
    id: "earth-horizon",
    name: "Earth Horizon",
    category: "nature",
    ...photo("earth-horizon", "rgb(84 104 152)", [2560, 1600]),
  },
  {
    id: "earth-moon-horizon",
    name: "Earth & Moon",
    category: "nature",
    ...photo("earth-moon-horizon", "rgb(91 117 149)", [2844, 1600]),
  },
  {
    id: "evening-reflections",
    name: "Evening Reflections",
    category: "nature",
    ...photo("evening-reflections", "rgb(125 144 167)", [2560, 1600]),
  },
  {
    id: "flowing-rock",
    name: "Flowing Rock",
    category: "nature",
    ...photo("flowing-rock", "rgb(184 98 56)", [2560, 1600]),
  },
  {
    id: "gentle-rapids",
    name: "Gentle Rapids",
    category: "nature",
    ...photo("gentle-rapids", "rgb(168 145 160)", [2560, 1600]),
  },
  {
    id: "golden-palace",
    name: "Golden Palace",
    category: "nature",
    ...photo("golden-palace", "rgb(107 113 75)", [2560, 1600]),
  },
  {
    id: "ladybug",
    name: "Ladybug",
    category: "nature",
    ...photo("ladybug", "rgb(104 160 96)", [2560, 1600]),
  },
  {
    id: "mt-fuji",
    name: "Mt. Fuji",
    category: "nature",
    ...photo("mt-fuji", "rgb(146 113 160)", [2560, 1600]),
  },
  {
    id: "rock-garden",
    name: "Rock Garden",
    category: "nature",
    ...photo("rock-garden", "rgb(112 113 106)", [2560, 1600]),
  },
  {
    id: "rocks",
    name: "Rocks",
    category: "nature",
    ...photo("rocks", "rgb(90 90 90)", [2560, 1600]),
  },
  {
    id: "snowy-hills",
    name: "Snowy Hills",
    category: "nature",
    ...photo("snowy-hills", "rgb(69 94 120)", [2560, 1600]),
  },
  {
    id: "stones",
    name: "Stones",
    category: "nature",
    ...photo("stones", "rgb(95 88 72)", [2560, 1600]),
  },
  {
    id: "sweeping-current",
    name: "Sweeping Current",
    category: "nature",
    ...photo("sweeping-current", "rgb(93 115 206)", [2560, 1600]),
  },
  {
    id: "tranquil-surface",
    name: "Tranquil Surface",
    category: "nature",
    ...photo("tranquil-surface", "rgb(108 134 180)", [2560, 1600]),
  },
  {
    id: "water",
    name: "Water",
    category: "nature",
    ...photo("water", "rgb(132 174 210)", [2560, 1600]),
  },
  {
    id: "zebra",
    name: "Zebra",
    category: "nature",
    ...photo("zebra", "rgb(113 109 103)", [2560, 1600]),
  },
  {
    id: "zen-garden",
    name: "Zen Garden",
    category: "nature",
    ...photo("zen-garden", "rgb(47 97 142)", [2560, 1600]),
  },
];

/**
 * Is this phone artwork?
 *
 * Derived, not stored. It was a flag once, set by hand on the pairs whose files
 * happened to be tall — which quietly made it mean "this file is portrait"
 * rather than "this is a phone wallpaper". iOS 13 and 14 are phone wallpapers
 * that ship square, so the glyph describes the artwork, not the encoding: every
 * iOS wallpaper is one, and shows a crop of itself on a desktop viewport.
 */
export function isPhoneWallpaper(wallpaper: Wallpaper): boolean {
  return wallpaper.platform === "iOS";
}

/**
 * Is this one photograph rather than a light/dark pair?
 *
 * Derived from the assets, not flagged: a picker that drew a pair card for it
 * would show the same picture twice under a sun and a moon, as if the theme
 * changed something.
 */
export function isSingleImage(wallpaper: Wallpaper): boolean {
  return wallpaper.light === wallpaper.dark;
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
    // The flat base sits under the image so the layer is never bare while it
    // decodes.
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
  /**
   * Resolve to the 480px thumb instead of the full-size file.
   *
   * For picker tiles and devtool swatches, which are small — and for the
   * blurred reading layer, where a 40px blur erases the difference anyway.
   */
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

