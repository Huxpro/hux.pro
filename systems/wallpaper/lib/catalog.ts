// =============================================================================
// Built-in wallpaper catalog
//
// Apple macOS / iOS default pairs, downloaded and compressed into
// public/wallpapers/. Each entry is a light/dark pair; the variant
// always follows the site theme.
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
  /** Calendar year the wallpaper shipped. */
  year: string;
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
    year: "2025",
    ...pairAssets("tahoe"),
  },
  {
    id: "sequoia",
    name: "Sequoia",
    nameZh: "Sequoia",
    source: "macos",
    year: "2024",
    ...pairAssets("sequoia"),
  },
  {
    id: "sonoma",
    name: "Sonoma",
    nameZh: "Sonoma",
    source: "macos",
    year: "2023",
    ...pairAssets("sonoma"),
  },
  {
    id: "ventura",
    name: "Ventura",
    nameZh: "Ventura",
    source: "macos",
    year: "2022",
    ...pairAssets("ventura"),
  },
  {
    id: "monterey",
    name: "Monterey",
    nameZh: "Monterey",
    source: "macos",
    year: "2021",
    ...pairAssets("monterey"),
  },
  {
    id: "big-sur",
    name: "Big Sur",
    nameZh: "Big Sur",
    source: "macos",
    year: "2020",
    ...pairAssets("big-sur"),
  },
  {
    id: "ios-27",
    name: "iOS 27",
    nameZh: "iOS 27",
    source: "ios",
    year: "2026",
    ...pairAssets("ios-27"),
  },
  {
    id: "ios-18",
    name: "iOS 18",
    nameZh: "iOS 18",
    source: "ios",
    year: "2024",
    ...pairAssets("ios-18"),
  },
  {
    id: "ios-17",
    name: "iOS 17",
    nameZh: "iOS 17",
    source: "ios",
    year: "2023",
    ...pairAssets("ios-17"),
  },
  {
    id: "ios-14",
    name: "iOS 14",
    nameZh: "iOS 14",
    source: "ios",
    year: "2020",
    ...pairAssets("ios-14"),
  },
  {
    id: "ios-13",
    name: "iOS 13",
    nameZh: "iOS 13",
    source: "ios",
    year: "2019",
    ...pairAssets("ios-13"),
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

export function wallpaperPlatformLabel(source: WallpaperSource): string {
  return source === "macos" ? "macOS" : "iOS";
}
