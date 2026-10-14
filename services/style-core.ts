import { t, type Locale } from "@/lib/i18n";

// The Style's plain data (see ./style.tsx): no "use client", so the root
// layout can inline the boot script.

export type SiteStyle = "default" | "cartoon" | "darkroom" | "y2k" | "neon" | "pixel";

export const SITE_STYLES: readonly SiteStyle[] = [
  "default",
  "cartoon",
  "darkroom",
  "y2k",
  "neon",
  "pixel",
];

export const STORAGE_KEY = "hux_style";

const STYLE_LABEL = {
  default: "styleDefault",
  cartoon: "styleCartoon",
  darkroom: "styleDarkroom",
  y2k: "styleY2k",
  neon: "styleNeon",
  pixel: "stylePixel",
} as const satisfies Record<SiteStyle, string>;

export function getStyleLabel(style: SiteStyle, locale: Locale): string {
  return t(locale, STYLE_LABEL[style]);
}

export function isSiteStyle(value: unknown): value is SiteStyle {
  return typeof value === "string" && (SITE_STYLES as readonly string[]).includes(value);
}

/**
 * Each Style's page ground (`--background` under it in globals.css), as a
 * colour the browser chrome can take: theme-color and the iOS toolbar. Null
 * for the default, whose ground is the ambient system's own.
 */
export const STYLE_GROUND: Record<SiteStyle, { light: string; dark: string } | null> = {
  default: null,
  cartoon: { light: "#e6e9f2", dark: "#15151a" },
  darkroom: { light: "#e9e3d8", dark: "#0b0a10" },
  y2k: { light: "#eee9ff", dark: "#1e1a2e" },
  neon: { light: "#f1f2f8", dark: "#0f0e14" },
  pixel: { light: "#dcdfe8", dark: "#161b12" },
};

/**
 * Before first paint, so a saved Style never flashes the default's ground:
 * the same read as `useSiteStyle`, inlined into <head> (app/layout.tsx).
 */
export const STYLE_BOOT = `try{var s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(${JSON.stringify(
  SITE_STYLES.filter((style) => style !== "default")
)}.indexOf(s)>=0)document.documentElement.dataset.style=s}catch(e){}`;

