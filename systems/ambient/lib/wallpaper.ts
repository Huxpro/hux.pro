// =============================================================================
// Wallpaper — the background catalog
//
// The ambient background has always been a wallpaper; weather was just the only
// source of one. This module names the shared concept and adds the second kind,
// so the provider can hold ONE background stack fed by exactly one kind at a
// time:
//
//     wallpaperKind: "weather"  →  the live sky, in one of three styles
//                                   (`weatherStyle`: Sky, Gradient, Classic)
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
// ## The catalog
//
// Three categories. The first is the live one; the other two are Apple's
// artwork:
//
//   weather the sky outside, right now, in three styles: Sky (a WebGL shader —
//           sun, moon, clouds, rain, snow, fog, lightning, stars), Gradient
//           (the same scene as a CSS wash, live to the minute) and Classic
//           (the six hand-tuned condition palettes the site started with).
//           Sky falls back to Gradient where WebGL2 is missing.
//   apple   the macOS / iPadOS / iOS release wallpapers, as light/dark pairs —
//           the artwork these releases are recognised by.
//   nature  the Mac OS X Nature desktop pictures (Aurora, Zebra, …), taken
//           from ryOS. One photograph each, so both halves are the same file.
//
// Every committed full-size file covers a 2560×1600 viewport with at most a 7%
// stretch. iOS 17, 18 and 27 did not (1.25×, 1.73× and 1.94×) and were removed.
// Photographs also ship 1280×800 and 1920×1200 cover renditions so a phone does
// not download the desktop file. Sources and frame indices are recorded in
// `public/wallpapers/sources.json`; `pnpm wallpapers:check` verifies the
// committed files still match it, the resolutions below included.
//
// Apple retains rights to this artwork. It is committed here for a personal
// site, not licensed onward; the archives the frames were pulled from do not
// license Apple's images either, and their repository licenses are not asserted
// to do so.
// =============================================================================

import { t, type Locale } from "@/lib/i18n";

export type WallpaperKind = "weather" | "image";

export type WallpaperPlatform = "macOS" | "iPadOS" | "iOS";

export type WallpaperCategory = "weather" | "apple" | "nature";

/** In picker order. Labels are proper nouns or i18n keys resolved by the UI. */
export const WALLPAPER_CATEGORIES: readonly WallpaperCategory[] = [
  "weather",
  "apple",
  "nature",
];

/**
 * The three weather wallpapers.
 *
 *   sky       the WebGL shader — the whole `WeatherScene` (lib/scene.ts),
 *             animated, at full strength (its veil is painted inside the
 *             shader). Needs WebGL2; otherwise the page quietly paints the
 *             Gradient and the devtool says so.
 *   gradient  the same scene as a CSS gradient — the sky's colour at the real
 *             sun position, live to the minute, crossfaded on change. Sky's
 *             fallback, and what widget cards paint under Sky.
 *   classic   the original: six hand-tuned condition palettes by day and
 *             night, with the sunrise and sunset events. It steps at phase
 *             and weather changes rather than following the clock. Chosen
 *             by hand only; nothing falls back to it.
 */
export type WeatherStyle = "sky" | "gradient" | "classic";

export const WEATHER_STYLES: readonly WeatherStyle[] = ["sky", "gradient", "classic"];

/** i18n keys for each style's name and its technical subtitle. */
export const WEATHER_STYLE_LABEL = {
  sky: "wallpaperWeatherSky",
  gradient: "wallpaperWeatherGradient",
  classic: "wallpaperWeatherClassic",
} as const satisfies Record<WeatherStyle, string>;

export const WEATHER_STYLE_META = {
  sky: "wallpaperWeatherSkyMeta",
  gradient: "wallpaperWeatherGradientMeta",
  classic: "wallpaperWeatherClassicMeta",
} as const satisfies Record<WeatherStyle, string>;

/** "Weather · Sky" — how every surface names a weather style in use. */
export function getWeatherWallpaperName(locale: Locale, style: WeatherStyle): string {
  return `${t(locale, "wallpaperWeather")} · ${t(locale, WEATHER_STYLE_LABEL[style])}`;
}

/** Which engine paints the full-page layer: the canvas or the CSS stack. */
export type WallpaperEngine = "shader" | "css";

/** Style → engine, one-to-one. The Sky is the canvas; everything else is CSS. */
export const WEATHER_STYLE_ENGINE: Record<WeatherStyle, WallpaperEngine> = {
  sky: "shader",
  gradient: "css",
  classic: "css",
};

/** The style after the fallback: Sky without WebGL2 is the Gradient. */
export function resolveWeatherStyle(params: {
  weatherStyle: WeatherStyle;
  shaderSupported: boolean;
}): WeatherStyle {
  if (params.weatherStyle === "sky" && !params.shaderSupported) return "gradient";
  return params.weatherStyle;
}

/** The stored style, or the default for anything unknown. */
export function readWeatherStyle(raw: unknown): WeatherStyle {
  return (WEATHER_STYLES as readonly unknown[]).includes(raw) ? (raw as WeatherStyle) : "sky";
}

/**
 * A smaller cover of the same photograph, encoded for a named CSS-pixel
 * viewport. Sorted smallest-first on `WallpaperAsset.srcset`.
 *
 * ryOS does not ship these — it serves the original JPEG plus a picker thumb.
 * We add them so raising encode quality (Aurora's source is 1.3MB) does not
 * mean a phone pays for a 2560px file.
 */
export interface WallpaperRendition {
  src: string;
  width: number;
  height: number;
}

export interface WallpaperAsset {
  /** Full-size WebP, sized to cover `WALLPAPER_VIEWPORT`. */
  src: string;
  /**
   * Smaller cover renditions of `src`, smallest first. Empty on the graphic
   * pairs, which already compress to tens of kilobytes.
   */
  srcset: readonly WallpaperRendition[];
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
 * What is on the page: an image, or one of the weather styles. Callers decide
 * which style to feed in — the saved one (for the edge of the page, so the
 * boot script and the provider agree before WebGL support is known, and a Sky
 * that falls back keeps its frame) or the resolved one (for what paints).
 */
export type WallpaperLook = WeatherStyle | "image";

export function getWallpaperLook(kind: WallpaperKind, style: WeatherStyle): WallpaperLook {
  return kind === "image" ? "image" : style;
}

/**
 * The one distinction every look-dependent treatment hangs on.
 *
 *   picture  a photograph, or the rendered Sky — something ON the page. Paints
 *            at full strength (an image at half opacity is a washed-out
 *            picture; the Sky's veil is mixed inside the shader) and ends on a
 *            line inside a bezel.
 *   wash     a CSS gradient — the page's own colour pushed outward. Reads as
 *            intended below full strength, and fades back into the ground.
 *
 * Opacity and the edge treatment (lib/bezel.ts) are both keyed by this, so a
 * new style is one line here.
 */
export type WallpaperFamily = "picture" | "wash";

export const WALLPAPER_LOOK_FAMILY: Record<WallpaperLook, WallpaperFamily> = {
  sky: "picture",
  image: "picture",
  gradient: "wash",
  classic: "wash",
};

export const WALLPAPER_OPACITY: Record<WallpaperFamily, { light: number; dark: number }> = {
  picture: { light: 1, dark: 1 },
  wash: { light: 0.7, dark: 0.85 },
};

// The flat veil drawn OVER an image wallpaper on a reading page, and the
// defocus under it, are outputs of the legibility policy (`legibility.ts`):
// a per-theme base that grows with how busy the picture is.

// -----------------------------------------------------------------------------
// Catalog
// -----------------------------------------------------------------------------

type Size = readonly [width: number, height: number];

/**
 * The desktop viewport a full-size file has to cover, and the smaller
 * viewports the photograph renditions are encoded for.
 *
 * 16:10 because that is the Mac OS X Nature frame and the picker tile. A
 * rendition is the smallest cover of its viewport — same rule as the full
 * file, just a smaller screen.
 */
export const WALLPAPER_VIEWPORT = { width: 2560, height: 1600 } as const;
export const WALLPAPER_RENDITIONS = [
  { id: 1280, width: 1280, height: 800 },
  { id: 1920, width: 1920, height: 1200 },
] as const;
/** Stretch past this looks soft; matching the check script's floor. */
export const WALLPAPER_MAX_STRETCH = 1.07;

/** Smallest size of `source` that still covers `viewport`. Never upscales. */
export function coverSize(
  source: { width: number; height: number },
  viewport: { width: number; height: number }
): { width: number; height: number } {
  const scale = Math.min(
    1,
    Math.max(viewport.width / source.width, viewport.height / source.height)
  );
  return {
    width: Math.round(source.width * scale),
    height: Math.round(source.height * scale),
  };
}

export function wallpaperRenditionSrc(src: string, id: number): string {
  return src.replace(/\.webp$/, `.${id}.webp`);
}

/**
 * The current CSS-pixel viewport and device pixel ratio.
 *
 * Falls back to the desktop cover size on the server, where there is no
 * window. Image wallpapers only apply after hydration (the default kind is
 * weather), so the fallback is not what paints.
 */
export function readDisplaySize(): { width: number; height: number; dpr: number } {
  if (typeof window === "undefined") {
    return { width: WALLPAPER_VIEWPORT.width, height: WALLPAPER_VIEWPORT.height, dpr: 1 };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
  };
}

/**
 * Smallest rendition of `asset` that covers `viewport` at its DPR, within
 * `WALLPAPER_MAX_STRETCH`. A portrait phone at 2×/3× still needs the full
 * file — the landscape photographs are 1600px tall, and that is the covering
 * axis.
 */
export function pickWallpaperSrc(
  asset: WallpaperAsset,
  viewport: { width: number; height: number; dpr?: number }
): string {
  const dpr = viewport.dpr ?? 1;
  const needW = viewport.width * dpr;
  const needH = viewport.height * dpr;
  const candidates: WallpaperRendition[] = [
    ...asset.srcset,
    { src: asset.src, width: asset.width, height: asset.height },
  ];
  for (const candidate of candidates) {
    const stretch = Math.max(needW / candidate.width, needH / candidate.height);
    if (stretch <= WALLPAPER_MAX_STRETCH) return candidate.src;
  }
  return candidates[candidates.length - 1].src;
}

function emptySrcset(): readonly WallpaperRendition[] {
  return [];
}

function photoSrcset(src: string, [width, height]: Size): WallpaperRendition[] {
  const source = { width, height };
  const out: WallpaperRendition[] = [];
  for (const rendition of WALLPAPER_RENDITIONS) {
    const size = coverSize(source, rendition);
    if (size.width >= width - 1 && size.height >= height - 1) continue;
    out.push({
      src: wallpaperRenditionSrc(src, rendition.id),
      width: size.width,
      height: size.height,
    });
  }
  return out;
}

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
      srcset: emptySrcset(),
      thumb: `${base}/light.thumb.webp`,
      base: lightBase,
      width,
      height,
    },
    dark: {
      src: `${base}/dark.webp`,
      srcset: emptySrcset(),
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
  const src = `/wallpapers/nature/${id}.webp`;
  const asset: WallpaperAsset = {
    src,
    srcset: photoSrcset(src, [width, height]),
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

function buildAsset(
  asset: WallpaperAsset,
  preview: boolean,
  viewport?: { width: number; height: number; dpr?: number }
): ResolvedWallpaper {
  const url = preview
    ? asset.thumb
    : viewport
      ? pickWallpaperSrc(asset, viewport)
      : asset.src;
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
  /**
   * CSS-pixel viewport used to pick a photograph rendition. Pairs ignore it
   * (one file). Omit to always use the full-size file.
   */
  viewport?: { width: number; height: number; dpr?: number };
}): ResolvedWallpaper {
  return buildAsset(
    params.wallpaper[params.theme],
    params.preview ?? false,
    params.viewport
  );
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

