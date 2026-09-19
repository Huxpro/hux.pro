// =============================================================================
// Demo defaults and the boot resolver, without React: vite.config.ts imports
// this at build time to inline the boot script into index.html. Imports reach
// into the package source by path for the same reason.
// =============================================================================

import type { BezelScroll } from "../../vitre";
import {
  BEZEL_BAND_MAX,
  BEZEL_BAND_MIN,
  DEFAULT_BEZEL_BAND,
  DEFAULT_BEZEL_RADIUS,
} from "../../src/constants";

export type ColorMode = "black" | "dark" | "theme" | "custom";
export type ThemeMode = "system" | "light" | "dark";
export type ScrollMode = "auto" | BezelScroll;
export type Backdrop = "aurora" | "sunset" | "none";

export interface DemoConfig {
  enabled: boolean;
  colorMode: ColorMode;
  customColor: string;
  band: number;
  radius: number;
  scroll: ScrollMode;
  theme: ThemeMode;
  backdrop: Backdrop;
}

export const DEFAULT_CONFIG: DemoConfig = {
  enabled: true,
  colorMode: "black",
  customColor: "#c1440e",
  band: DEFAULT_BEZEL_BAND,
  radius: DEFAULT_BEZEL_RADIUS,
  scroll: "auto",
  theme: "system",
  backdrop: "aurora",
};

/** The page's own ground, per theme: the chrome colour while the bezel is off. */
export const GROUND = { light: "#ffffff", dark: "#1a1a1a" } as const;

export const STORAGE_KEY = "vitre-demo";

/**
 * The boot resolver: the same decisions as the demo, before React runs. The
 * docs page (wide, not framed) gets no bezel; the phone in its frame starts
 * from the defaults; a phone visiting the demo starts from what it saved.
 */
export function bootResolver(): string {
  return `
var framed=new URLSearchParams(location.search).has("frame");
if(!framed&&!matchMedia("(max-width: 767px)").matches)return null;
var c=${JSON.stringify(DEFAULT_CONFIG)};
if(!framed){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}");for(var k in s)c[k]=s[k];}catch(e){}}
var dark=c.theme==="dark"||(c.theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
var ground=dark?${JSON.stringify(GROUND.dark)}:${JSON.stringify(GROUND.light)};
var color=c.colorMode==="black"?"#000000":c.colorMode==="dark"?${JSON.stringify(GROUND.dark)}:c.colorMode==="theme"?ground:c.customColor;
var band=Math.min(${BEZEL_BAND_MAX},Math.max(${BEZEL_BAND_MIN},Math.round(+c.band||0)));
var scroll=c.scroll==="auto"?(c.enabled?"container":"window"):c.scroll;
document.documentElement.style.background=ground;
return {enabled:!!c.enabled,color:color,band:band,scroll:scroll,ground:ground};`;
}
