import type { Locale } from "@/lib/i18n";

// =============================================================================
// Wallpaper — the background catalog
//
// The ambient background has always been a wallpaper; weather was just the only
// source of one. This module adds the second source (picture wallpapers) and
// names the shared concept, so the provider can hold ONE background stack fed by
// exactly one source at a time:
//
//     wallpaperSource: "weather"  →  the live weather/sun-event gradient
//                      "picture"  →  a fixed wallpaper from this catalog
//
// Mutual exclusivity is therefore structural, not a rule anyone has to remember:
// there is a single stack, and a single source feeds it. Where that stack paints
// (full page / widget cards / nowhere) stays the job of `weatherGradientMode`.
//
// The sun-event Live Activity (systems/ambient/components/phase-activity.tsx)
// reads weather + phase directly and never touches the background, so it keeps
// announcing sunrise/sunset under a picture wallpaper too.
//
// ## Built-ins
//
// The built-ins are ORIGINAL CSS artwork — layered radial gradients in the same
// OKLCH language as lib/gradient.ts — evoking the default desktops Apple shipped
// with each macOS/iOS release. They are re-interpretations, not Apple's image
// files: shipping those would redistribute copyrighted artwork and add tens of
// megabytes of binaries to a static site. As vectors they cost ~1KB each, stay
// crisp on any display, need no network, and give a real light/dark pair for
// free. A `picture` variant is supported for anyone who wants to drop actual
// image files into `public/` — see `WallpaperPicture`.
// =============================================================================

export type WallpaperSource = "weather" | "picture";

/**
 * Which half of a wallpaper's light/dark pair to show.
 * "auto" follows the app theme — the macOS "Dynamic Desktop" behaviour.
 */
export type WallpaperAppearance = "auto" | "light" | "dark";

export const WALLPAPER_APPEARANCES: WallpaperAppearance[] = [
  "auto",
  "light",
  "dark",
];

/** One soft radial bloom, positioned and sized in % of the frame. */
interface Bloom {
  /** Center, in % of the frame. */
  x: number;
  y: number;
  /** Size, in % of the frame. */
  w: number;
  h: number;
  color: string;
  /** Stop at which the bloom has fully faded out (%). */
  fade?: number;
}

/** Vector artwork: blooms composited over a base sweep. Resolution-independent. */
interface WallpaperArtwork {
  kind: "artwork";
  blooms: Bloom[];
  /** Base sweep, [from, to]. */
  base: [string, string];
  /** Base sweep angle in deg (CSS convention: 180 = top→bottom). */
  angle?: number;
}

/** A real image file (e.g. `/wallpapers/mine.jpg`), painted over a base color. */
interface WallpaperPicture {
  kind: "picture";
  url: string;
  /** Average color, shown under/around the image while it loads. */
  base: string;
}

export type WallpaperVariant = WallpaperArtwork | WallpaperPicture;

export interface Wallpaper {
  id: string;
  /** Release name — a proper noun, shown untranslated. */
  name: string;
  family: "macOS" | "iOS";
  /** Release year, shown as the subtitle next to the family. */
  year: number;
  /** The light/dark pair. "auto" picks between these by theme. */
  light: WallpaperVariant;
  dark: WallpaperVariant;
}

/** A variant resolved into something renderable by <GradientStack />. */
export interface ResolvedWallpaper {
  backgroundImage: string;
  /** Picture variants must cover the frame; artwork already fills it. */
  cover: boolean;
}

function oklch(L: number, C: number, H: number, alpha?: number): string {
  return alpha !== undefined
    ? `oklch(${L} ${C} ${H} / ${alpha})`
    : `oklch(${L} ${C} ${H})`;
}

function art(
  base: [string, string],
  blooms: Bloom[],
  angle?: number
): WallpaperArtwork {
  return { kind: "artwork", base, blooms, angle };
}

// -----------------------------------------------------------------------------
// Built-in catalog
// -----------------------------------------------------------------------------

export const BUILT_IN_WALLPAPERS: Wallpaper[] = [
  {
    // Big Sur: the coastal dawn — a warm sun off to one side, cool ridge below.
    id: "big-sur",
    name: "Big Sur",
    family: "macOS",
    year: 2020,
    light: art(
      [oklch(0.93, 0.05, 230), oklch(0.98, 0.012, 90)],
      [
        { x: 78, y: 10, w: 70, h: 55, color: oklch(0.95, 0.09, 75), fade: 72 },
        { x: 16, y: 4, w: 65, h: 45, color: oklch(0.92, 0.06, 235), fade: 70 },
        { x: 50, y: 96, w: 130, h: 55, color: oklch(0.82, 0.07, 245, 0.55), fade: 76 },
      ]
    ),
    dark: art(
      [oklch(0.26, 0.06, 255), oklch(0.17, 0.03, 265)],
      [
        { x: 76, y: 8, w: 70, h: 52, color: oklch(0.5, 0.11, 60, 0.55), fade: 70 },
        { x: 14, y: 14, w: 72, h: 52, color: oklch(0.42, 0.09, 220, 0.7), fade: 72 },
        { x: 50, y: 98, w: 140, h: 50, color: oklch(0.2, 0.05, 275, 0.85), fade: 78 },
      ]
    ),
  },
  {
    // Monterey: crossing ribbons of cyan and magenta.
    id: "monterey",
    name: "Monterey",
    family: "macOS",
    year: 2021,
    light: art(
      [oklch(0.98, 0.008, 250), oklch(0.96, 0.02, 300)],
      [
        { x: 24, y: 24, w: 78, h: 62, color: oklch(0.9, 0.1, 205, 0.85), fade: 68 },
        { x: 74, y: 34, w: 72, h: 66, color: oklch(0.9, 0.09, 330, 0.8), fade: 68 },
        { x: 52, y: 82, w: 90, h: 50, color: oklch(0.93, 0.07, 270, 0.7), fade: 72 },
      ]
    ),
    dark: art(
      [oklch(0.19, 0.03, 280), oklch(0.14, 0.02, 270)],
      [
        { x: 26, y: 26, w: 80, h: 62, color: oklch(0.48, 0.14, 210, 0.75), fade: 66 },
        { x: 76, y: 36, w: 74, h: 66, color: oklch(0.46, 0.16, 330, 0.7), fade: 66 },
        { x: 52, y: 86, w: 96, h: 52, color: oklch(0.3, 0.1, 285, 0.7), fade: 72 },
      ]
    ),
  },
  {
    // Ventura: one wide turquoise swirl sweeping across the frame.
    id: "ventura",
    name: "Ventura",
    family: "macOS",
    year: 2022,
    light: art(
      [oklch(0.97, 0.02, 200), oklch(0.99, 0.006, 220)],
      [
        { x: 34, y: 20, w: 96, h: 70, color: oklch(0.88, 0.1, 195, 0.9), fade: 70 },
        { x: 82, y: 62, w: 76, h: 60, color: oklch(0.9, 0.08, 240, 0.8), fade: 70 },
        { x: 8, y: 86, w: 66, h: 48, color: oklch(0.94, 0.06, 165, 0.6), fade: 74 },
      ]
    ),
    dark: art(
      [oklch(0.2, 0.04, 215), oklch(0.13, 0.02, 235)],
      [
        { x: 34, y: 20, w: 98, h: 70, color: oklch(0.45, 0.12, 195, 0.8), fade: 68 },
        { x: 84, y: 60, w: 78, h: 62, color: oklch(0.38, 0.11, 250, 0.75), fade: 70 },
        { x: 6, y: 88, w: 70, h: 50, color: oklch(0.4, 0.09, 165, 0.5), fade: 74 },
      ]
    ),
  },
  {
    // Sonoma: soft lavender and peach ribbons, the warmest of the set.
    id: "sonoma",
    name: "Sonoma",
    family: "macOS",
    year: 2023,
    light: art(
      [oklch(0.98, 0.015, 320), oklch(0.97, 0.025, 60)],
      [
        { x: 22, y: 18, w: 80, h: 62, color: oklch(0.91, 0.08, 300, 0.85), fade: 70 },
        { x: 80, y: 24, w: 70, h: 58, color: oklch(0.94, 0.08, 35, 0.8), fade: 70 },
        { x: 46, y: 92, w: 110, h: 54, color: oklch(0.93, 0.06, 340, 0.65), fade: 74 },
      ]
    ),
    dark: art(
      [oklch(0.21, 0.04, 310), oklch(0.15, 0.025, 25)],
      [
        { x: 22, y: 18, w: 82, h: 62, color: oklch(0.42, 0.12, 305, 0.8), fade: 68 },
        { x: 82, y: 26, w: 72, h: 58, color: oklch(0.45, 0.12, 30, 0.7), fade: 70 },
        { x: 46, y: 94, w: 116, h: 56, color: oklch(0.28, 0.08, 345, 0.7), fade: 74 },
      ]
    ),
  },
  {
    // Sequoia: forest teal cut by a low amber light.
    id: "sequoia",
    name: "Sequoia",
    family: "macOS",
    year: 2024,
    light: art(
      [oklch(0.97, 0.02, 170), oklch(0.98, 0.02, 85)],
      [
        { x: 28, y: 14, w: 82, h: 60, color: oklch(0.9, 0.09, 170, 0.85), fade: 70 },
        { x: 84, y: 78, w: 78, h: 58, color: oklch(0.94, 0.09, 80, 0.8), fade: 70 },
        { x: 12, y: 92, w: 70, h: 50, color: oklch(0.9, 0.07, 200, 0.6), fade: 74 },
      ]
    ),
    dark: art(
      [oklch(0.19, 0.035, 175), oklch(0.14, 0.02, 200)],
      [
        { x: 28, y: 14, w: 84, h: 60, color: oklch(0.4, 0.1, 170, 0.8), fade: 68 },
        { x: 86, y: 80, w: 80, h: 58, color: oklch(0.46, 0.12, 75, 0.6), fade: 70 },
        { x: 10, y: 94, w: 72, h: 52, color: oklch(0.26, 0.07, 205, 0.75), fade: 74 },
      ]
    ),
  },
  {
    // Tahoe: the glass era — icy blue, high clarity, very little chroma.
    id: "tahoe",
    name: "Tahoe",
    family: "macOS",
    year: 2025,
    light: art(
      [oklch(0.99, 0.006, 230), oklch(0.96, 0.025, 215)],
      [
        { x: 50, y: 8, w: 100, h: 52, color: oklch(0.97, 0.04, 225, 0.9), fade: 72 },
        { x: 18, y: 68, w: 74, h: 58, color: oklch(0.92, 0.06, 205, 0.7), fade: 72 },
        { x: 86, y: 88, w: 70, h: 52, color: oklch(0.93, 0.05, 255, 0.65), fade: 74 },
      ]
    ),
    dark: art(
      [oklch(0.22, 0.03, 230), oklch(0.13, 0.015, 240)],
      [
        { x: 50, y: 6, w: 104, h: 54, color: oklch(0.42, 0.08, 225, 0.7), fade: 72 },
        { x: 16, y: 70, w: 76, h: 58, color: oklch(0.35, 0.08, 205, 0.7), fade: 72 },
        { x: 88, y: 90, w: 72, h: 54, color: oklch(0.32, 0.07, 265, 0.7), fade: 74 },
      ]
    ),
  },
  {
    // iOS Aurora: the bloom that rises from the bottom of the lock screen.
    id: "ios-aurora",
    name: "Aurora",
    family: "iOS",
    year: 2022,
    light: art(
      [oklch(0.99, 0.005, 280), oklch(0.95, 0.035, 285)],
      [
        { x: 50, y: 104, w: 120, h: 78, color: oklch(0.9, 0.09, 290, 0.85), fade: 72 },
        { x: 20, y: 88, w: 80, h: 60, color: oklch(0.92, 0.08, 230, 0.7), fade: 72 },
        { x: 82, y: 80, w: 74, h: 56, color: oklch(0.93, 0.08, 340, 0.6), fade: 74 },
      ]
    ),
    dark: art(
      [oklch(0.13, 0.015, 280), oklch(0.18, 0.05, 290)],
      [
        { x: 50, y: 106, w: 124, h: 80, color: oklch(0.46, 0.16, 295, 0.85), fade: 70 },
        { x: 18, y: 90, w: 84, h: 62, color: oklch(0.4, 0.13, 235, 0.7), fade: 72 },
        { x: 84, y: 82, w: 76, h: 58, color: oklch(0.42, 0.14, 345, 0.55), fade: 74 },
      ]
    ),
  },
  {
    // iOS Sunset: the warm dusk gradient, sun low and off to one side.
    id: "ios-sunset",
    name: "Sunset",
    family: "iOS",
    year: 2023,
    light: art(
      [oklch(0.98, 0.025, 70), oklch(0.95, 0.04, 20)],
      [
        { x: 74, y: 84, w: 86, h: 64, color: oklch(0.94, 0.1, 55, 0.9), fade: 70 },
        { x: 24, y: 22, w: 80, h: 58, color: oklch(0.93, 0.06, 300, 0.65), fade: 72 },
        { x: 50, y: 100, w: 120, h: 50, color: oklch(0.9, 0.09, 25, 0.6), fade: 76 },
      ]
    ),
    dark: art(
      [oklch(0.17, 0.03, 300), oklch(0.13, 0.02, 40)],
      [
        { x: 76, y: 86, w: 90, h: 66, color: oklch(0.52, 0.15, 55, 0.75), fade: 68 },
        { x: 22, y: 20, w: 82, h: 58, color: oklch(0.32, 0.1, 300, 0.7), fade: 72 },
        { x: 50, y: 102, w: 126, h: 52, color: oklch(0.34, 0.12, 20, 0.7), fade: 76 },
      ]
    ),
  },
];

export const DEFAULT_WALLPAPER_ID = BUILT_IN_WALLPAPERS[0].id;

export function getWallpaper(id: string): Wallpaper | null {
  return BUILT_IN_WALLPAPERS.find((w) => w.id === id) ?? null;
}

/** The stored id, falling back to the default when it no longer exists. */
export function getWallpaperOrDefault(id: string): Wallpaper {
  return getWallpaper(id) ?? BUILT_IN_WALLPAPERS[0];
}

/** Which half of the pair an appearance resolves to under the current theme. */
export function resolveAppearance(
  appearance: WallpaperAppearance,
  theme: "light" | "dark"
): "light" | "dark" {
  return appearance === "auto" ? theme : appearance;
}

function buildVariant(variant: WallpaperVariant): ResolvedWallpaper {
  if (variant.kind === "picture") {
    return {
      // The flat base sits under the image so the frame is never bare while it
      // decodes (and shows through any letterboxing on odd aspect ratios).
      backgroundImage: `url("${variant.url}"), linear-gradient(180deg, ${variant.base} 0%, ${variant.base} 100%)`,
      cover: true,
    };
  }

  const blooms = variant.blooms.map(
    (b) =>
      `radial-gradient(${b.w}% ${b.h}% at ${b.x}% ${b.y}%, ${b.color} 0%, transparent ${b.fade ?? 70}%)`
  );
  blooms.push(
    `linear-gradient(${variant.angle ?? 180}deg, ${variant.base[0]} 0%, ${variant.base[1]} 100%)`
  );

  return { backgroundImage: blooms.join(", "), cover: false };
}

/** Resolve a wallpaper to a renderable background for the given appearance. */
export function getWallpaperBackground(params: {
  wallpaper: Wallpaper;
  appearance: WallpaperAppearance;
  theme: "light" | "dark";
}): ResolvedWallpaper {
  const half = resolveAppearance(params.appearance, params.theme);
  return buildVariant(params.wallpaper[half]);
}

/** Both halves at once — for pair previews in the picker and the devtool. */
export function getWallpaperPair(wallpaper: Wallpaper): {
  light: ResolvedWallpaper;
  dark: ResolvedWallpaper;
} {
  return { light: buildVariant(wallpaper.light), dark: buildVariant(wallpaper.dark) };
}

export function getWallpaperAppearanceLabel(
  appearance: WallpaperAppearance,
  locale: Locale
): string {
  const zh = locale === "zh";
  if (appearance === "light") return zh ? "浅色" : "Light";
  if (appearance === "dark") return zh ? "深色" : "Dark";
  return zh ? "自动" : "Auto";
}
