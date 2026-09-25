import { PAGE_FRAME_NAME } from "@/systems/windows/lib/embed";
import {
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  DEFAULT_BEZEL_BAND,
} from "vitre";
import { WALLPAPER_LOOK_FAMILY, type WallpaperFamily } from "./wallpaper";

// =============================================================================
// The site's bezel: what vitre is configured with here.
//
// The package draws a bezel in any colour, scrolls the page wherever it is
// told, and keeps the browser chrome in step. What the colour is, when the
// bezel is on and where the page scrolls are this site's decisions, and they
// all live in this file.
// =============================================================================

/** The page's own ground, per theme — `--background` in globals.css. */
export const PAGE_GROUND = { light: "#ffffff", dark: "#1a1a1a" } as const;

/**
 * What each wallpaper family wants at the edge (`WALLPAPER_LOOK_FAMILY` in
 * lib/wallpaper.ts says which family a look is). With no devtool override,
 * the provider resolves every page from this, live, as the look changes.
 *
 * A wash (Gradient, Classic) is the page's own colour pushed outward, so it
 * fades back into the ground: soft edge, no bezel. A picture (a photograph,
 * or the rendered Sky) ends on a line inside a bezel; fading it would be a
 * printing error. Soft edge applies only while the bezel is off. All of it is
 * a phone treatment: the provider gates it on iOS.
 *
 * Band, radius and tint are not per family. A bezel over the Sky uses the
 * same saved band and radius an image does, and a bezel turned on over a wash
 * does too.
 */
export interface WallpaperEdges {
  bezel: boolean;
  softEdge: boolean;
}

export const WALLPAPER_FAMILY_EDGES: Record<WallpaperFamily, WallpaperEdges> = {
  picture: { bezel: true, softEdge: false },
  wash: { bezel: false, softEdge: true },
};

/**
 * A bezel colour as a setting.
 *
 *   black    the default, and ryOS's.
 *   dark     the page's dark ground, in both themes.
 *   theme    the page's ground in the current theme: light in light, dark in
 *            dark. It changes live with the theme; vitre shows the change
 *            to the browser chrome.
 *   #rrggbb  anything else.
 */
export type BezelTint = "black" | "dark" | "theme" | `#${string}`;

/** The named tints, in the order a picker offers them. */
export const BEZEL_TINTS = ["black", "dark", "theme"] as const;
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

/** The tint as a colour a browser can paint, in the current theme. */
export function resolveBezelTint(tint: BezelTint, theme: "light" | "dark"): string {
  if (tint === "black") return BLACK;
  if (tint === "dark") return PAGE_GROUND.dark;
  if (tint === "theme") return PAGE_GROUND[theme];
  return tint;
}

/**
 * The boot resolver for `bezelBootScript`: the same decisions as the provider,
 * from what is knowable before React runs. It cannot import, so every constant
 * is interpolated and the two cannot drift.
 */
export function bezelBootResolver(): string {
  const tints = `^(black|dark|theme|${HEX_SOURCE.slice(1, -1)})$`;
  return `
var s=JSON.parse(localStorage.getItem("hux_ambient_settings")||"{}");
var ios=/iP(hone|ad|od)/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
var F=${JSON.stringify(WALLPAPER_LOOK_FAMILY)},E=${JSON.stringify(WALLPAPER_FAMILY_EDGES)};
var look=s.wallpaperKind==="image"?"image":(F[s.weatherStyle]?s.weatherStyle:"sky");
var edges=E[F[look]];
var t=localStorage.getItem("hux_theme");
var dark=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
var tint=s.bezelTint;
if(!new RegExp(${JSON.stringify(tints)}).test(tint))tint=${JSON.stringify(DEFAULT_BEZEL_TINT)};
var ground=dark?${JSON.stringify(PAGE_GROUND.dark)}:${JSON.stringify(PAGE_GROUND.light)};
var color=tint==="black"?${JSON.stringify(BLACK)}:tint==="dark"?${JSON.stringify(PAGE_GROUND.dark)}:tint==="theme"?ground:tint;
var band=s.bezelBand;
band=typeof band==="number"&&isFinite(band)?Math.min(${BEZEL_BAND_MAX},Math.max(${BEZEL_BAND_MIN},Math.round(band))):${DEFAULT_BEZEL_BAND};
var framed=window.top!==window&&(window.name||"").indexOf(${JSON.stringify(PAGE_FRAME_NAME)})===0;
var on=ios&&edges.bezel&&!framed;
return {enabled:on,color:color,band:band,scroll:on?"container":"window",ground:ground};`;
}
