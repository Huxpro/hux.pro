"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isSiteStyle, SITE_STYLES, STORAGE_KEY, type SiteStyle } from "./style-core";

// =============================================================================
// Style: the site's look, as one saved choice.
//
//   default   the greyscale OS: glass over the wallpaper. No attribute.
//   cartoon   卡通: ink outlines and hard offset shadows on solid surfaces.
//   y2k       Y2K: candy plastic on a lilac grid, fat outlines, a gloss edge.
//   neon      夜光: surfaces that glow; in the dark, text that does too.
//   pixel     像素: the pocket pet. Square corners, LCD surfaces, bitmap faces.
//
// A Style is a set of design tokens, not a set of components. The choice is
// one attribute on <html> (`data-style`), and app/globals.css re-chooses the
// token INPUTS under it (STYLES): ink, ground, glass fills, radius, elevation,
// outline, faces. Everything that paints with the tokens follows, and nothing
// re-renders. Appearance (light / dark) is orthogonal: every Style has both.
//
// A Style other than the default owns the page's ground, so the ambient system
// reads `useSiteStyle()` and paints no wallpaper under it.
//
// The plain data (the list, labels, grounds, the boot script) is in
// ./style-core.ts, which a server component can import.
// =============================================================================

const CHANGE_EVENT = "hux:style";

function read(): SiteStyle {
  if (typeof window === "undefined") return "default";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSiteStyle(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** The saved Style; "default" on the server and the first client render. */
export function useSiteStyle(): SiteStyle {
  return useSyncExternalStore(subscribe, read, () => "default");
}

export function setSiteStyle(style: SiteStyle): void {
  try {
    if (style === "default") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, style);
  } catch {
    // Storage unavailable. The event still updates this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The Style after `style`, wrapping back to the default. */
export function nextSiteStyle(style: SiteStyle): SiteStyle {
  return SITE_STYLES[(SITE_STYLES.indexOf(style) + 1) % SITE_STYLES.length];
}

function applyStyle(style: SiteStyle) {
  const root = document.documentElement;
  if (style === "default") delete root.dataset.style;
  else root.dataset.style = style;
}

/** Reflects the saved Style onto <html>. Mount once at the app root. */
export function StyleRootSync() {
  const style = useSiteStyle();
  useEffect(() => applyStyle(style), [style]);
  return null;
}
