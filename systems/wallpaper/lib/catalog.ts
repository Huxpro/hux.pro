// =============================================================================
// Built-in wallpaper catalog
//
// Apple macOS / iOS default pairs, downloaded and compressed into
// public/wallpapers/. Each entry is a light/dark pair so appearance can
// follow the theme (auto) or lock to one variant.
// =============================================================================

export type WallpaperSource = "macos" | "ios";

export interface WallpaperAsset {
  src: string;
  thumb: string;
}

export interface WallpaperPair {
  id: string;
  name: string;
  nameZh: string;
  source: WallpaperSource;
  /** Release the default wallpaper shipped with. */
  release: string;
  light: WallpaperAsset;
  dark: WallpaperAsset;
}

function pairAssets(id: string): Pick<WallpaperPair, "light" | "dark"> {
  const base = `/wallpapers/${id}`;
  return {
    light: { src: `${base}/light.jpg`, thumb: `${base}/light.thumb.jpg` },
    dark: { src: `${base}/dark.jpg`, thumb: `${base}/dark.thumb.jpg` },
  };
}

export const WALLPAPER_CATALOG: WallpaperPair[] = [
  {
    id: "tahoe",
    name: "Tahoe",
    nameZh: "Tahoe",
    source: "macos",
    release: "macOS 26",
    ...pairAssets("tahoe"),
  },
  {
    id: "sequoia",
    name: "Sequoia",
    nameZh: "Sequoia",
    source: "macos",
    release: "macOS 15",
    ...pairAssets("sequoia"),
  },
  {
    id: "sonoma",
    name: "Sonoma",
    nameZh: "Sonoma",
    source: "macos",
    release: "macOS 14",
    ...pairAssets("sonoma"),
  },
  {
    id: "ventura",
    name: "Ventura",
    nameZh: "Ventura",
    source: "macos",
    release: "macOS 13",
    ...pairAssets("ventura"),
  },
  {
    id: "big-sur",
    name: "Big Sur",
    nameZh: "Big Sur",
    source: "macos",
    release: "macOS 11",
    ...pairAssets("big-sur"),
  },
  {
    id: "ios-27",
    name: "iOS 27",
    nameZh: "iOS 27",
    source: "ios",
    release: "iOS 27",
    ...pairAssets("ios-27"),
  },
  {
    id: "ios-18",
    name: "iOS 18",
    nameZh: "iOS 18",
    source: "ios",
    release: "iOS 18",
    ...pairAssets("ios-18"),
  },
  {
    id: "ios-17",
    name: "iOS 17",
    nameZh: "iOS 17",
    source: "ios",
    release: "iOS 17",
    ...pairAssets("ios-17"),
  },
];

export const DEFAULT_WALLPAPER_ID = "tahoe";

const CATALOG_BY_ID = new Map(WALLPAPER_CATALOG.map((pair) => [pair.id, pair]));

export function getWallpaperPair(id: string): WallpaperPair | undefined {
  return CATALOG_BY_ID.get(id);
}

export function getWallpaperPairsBySource(
  source: WallpaperSource
): WallpaperPair[] {
  return WALLPAPER_CATALOG.filter((pair) => pair.source === source);
}
