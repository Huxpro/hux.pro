import type { BezelBootState } from "../vitre";
import {
  BAND_VAR,
  BEZEL_ATTRIBUTE,
  BOOT_GLOBAL,
  COLOR_VAR,
  SCROLL_ATTRIBUTE,
  STYLE_ID,
  THEME_COLOR_ID,
} from "./constants";
import { BEZEL_CSS } from "./css";

// =============================================================================
// Boot — the first frame, before React runs.
//
// A bezel applied only by a component arrives a frame or more after first
// paint, and on iOS Safari that first paint is when the chrome picks its
// colour. So the host puts this script inline in <head>. It installs the
// stylesheet, applies the resolved state to <html>, creates `theme-color`, and
// records the state on `window` — React never touches `window`, so the record
// survives a failed hydration that strips <html>.
// =============================================================================

export function bezelBootScript(resolver: string): string {
  return `(function(){try{
var s=(function(){${resolver}})();if(!s)return;
var d=document,h=d.documentElement;
if(!d.getElementById(${JSON.stringify(STYLE_ID)})){var st=d.createElement("style");st.id=${JSON.stringify(STYLE_ID)};st.textContent=${JSON.stringify(BEZEL_CSS)};d.head.appendChild(st);}
window[${JSON.stringify(BOOT_GLOBAL)}]={enabled:!!s.enabled,color:String(s.color),band:+s.band||0,scroll:s.scroll==="container"?"container":"window",ground:String(s.ground)};
if(s.enabled){h.setAttribute(${JSON.stringify(BEZEL_ATTRIBUTE)},"");h.style.setProperty(${JSON.stringify(COLOR_VAR)},s.color);h.style.setProperty(${JSON.stringify(BAND_VAR)},(+s.band||0)+"px");h.style.backgroundColor=s.color;}
if(s.scroll==="container")h.setAttribute(${JSON.stringify(SCROLL_ATTRIBUTE)},"container");
var m=d.createElement("meta");m.id=${JSON.stringify(THEME_COLOR_ID)};m.name="theme-color";m.content=s.enabled?s.color:s.ground;d.head.appendChild(m);
}catch(e){}})()`;
}

export function readBezelBoot(): BezelBootState | null {
  if (typeof window === "undefined") return null;
  const value = (window as unknown as Record<string, unknown>)[BOOT_GLOBAL];
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<BezelBootState>;
  if (typeof v.color !== "string" || typeof v.ground !== "string") return null;
  return {
    enabled: v.enabled === true,
    color: v.color,
    band: typeof v.band === "number" ? v.band : 0,
    scroll: v.scroll === "container" ? "container" : "window",
    ground: v.ground,
  };
}
