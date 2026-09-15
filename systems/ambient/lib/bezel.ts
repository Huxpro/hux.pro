import {
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  DEFAULT_BEZEL_BAND,
} from "@hux/bezel";
import type { WallpaperKind } from "./wallpaper";

// =============================================================================
// The site's bezel: what @hux/bezel is configured with here.
//
// The package draws a bezel in any colour, scrolls the page wherever it is
// told, and keeps the browser chrome in step. What the colour is, when the
// bezel is on and where the page scrolls are this site's decisions, and they
// all live in this file.
// =============================================================================

/** The page's own ground, per theme — `--background` in globals.css. */
export const PAGE_GROUND = { light: "#ffffff", dark: "#1a1a1a" } as const;

/**
 * What each wallpaper kind wants at the edge. The whole relationship: with no
 * devtool override, the provider resolves every page from this, live, as the
 * kind changes.
 *
 * A weather gradient is the page's own colour pushed outward, so it fades back
 * into the ground: soft edge, no bezel. A photograph is a picture on the page,
 * so it ends on a line inside a bezel, and fading it would be a printing error.
 * Soft edge applies only while the bezel is off. Both are phone treatments:
 * the provider gates them on iOS.
 *
 * Band and radius are not per kind. A bezel turned on over weather uses the
 * same saved band and radius an image does.
 */
export const WALLPAPER_KIND_EDGES: Record<
  WallpaperKind,
  { bezel: boolean; softEdge: boolean }
> = {
  weather: { bezel: false, softEdge: true },
  image: { bezel: true, softEdge: false },
};

/**
 * A bezel colour as a setting.
 *
 *   black    the default, and ryOS's.
 *   dark     the page's dark ground, in both themes.
 *   #rrggbb  anything else.
 *
 * There is no tint that follows the theme. The chrome can follow a live change
 * now (see `syncChrome` in @hux/bezel), but a bezel that changes colour with
 * the theme reads as part of the page, not as the edge of the screen.
 */
export type BezelTint = "black" | "dark" | `#${string}`;

/** The named tints, in the order a picker offers them. */
export const BEZEL_TINTS = ["black", "dark"] as const;
export const DEFAULT_BEZEL_TINT: BezelTint = "black";

const BLACK = "#000000";
const HEX = /^#[0-9a-f]{6}$/i;
const HEX_SOURCE = "^#[0-9a-fA-F]{6}$";

/** Whether a string is a `#rrggbb` literal, i.e. a custom tint. */
export function isBezelHex(value: string): value is `#${string}` {
  return HEX.test(value);
}

export function isBezelTint(value: unknown): value is BezelTint {
  if (typeof value !== "string") return false;
  return (BEZEL_TINTS as readonly string[]).includes(value) || isBezelHex(value);
}

/** The tint as a colour a browser can paint. */
export function resolveBezelTint(tint: BezelTint): string {
  if (tint === "black") return BLACK;
  if (tint === "dark") return PAGE_GROUND.dark;
  return tint;
}

/**
 * The boot resolver for `bezelBootScript`: the same decisions as the provider,
 * from what is knowable before React runs. It cannot import, so every constant
 * is interpolated and the two cannot drift.
 */
export function bezelBootResolver(): string {
  const tints = `^(black|dark|${HEX_SOURCE.slice(1, -1)})$`;
  return `
var s=JSON.parse(localStorage.getItem("hux_ambient_settings")||"{}");
var ios=/iP(hone|ad|od)/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
var edges=s.wallpaperKind==="image"?${JSON.stringify(WALLPAPER_KIND_EDGES.image)}:${JSON.stringify(WALLPAPER_KIND_EDGES.weather)};
var t=localStorage.getItem("hux_theme");
var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
var tint=s.bezelTint;
if(!new RegExp(${JSON.stringify(tints)}).test(tint))tint=${JSON.stringify(DEFAULT_BEZEL_TINT)};
var color=tint==="black"?${JSON.stringify(BLACK)}:tint==="dark"?${JSON.stringify(PAGE_GROUND.dark)}:tint;
var band=s.bezelBand;
band=typeof band==="number"&&isFinite(band)?Math.min(${BEZEL_BAND_MAX},Math.max(${BEZEL_BAND_MIN},Math.round(band))):${DEFAULT_BEZEL_BAND};
var on=ios&&edges.bezel;
return {enabled:on,color:color,band:band,scroll:on?"container":"window",ground:dark?${JSON.stringify(PAGE_GROUND.dark)}:${JSON.stringify(PAGE_GROUND.light)}};`;
}
