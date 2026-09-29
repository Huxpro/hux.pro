"use client";

import { useOptionalOsTheme } from "@/services/os-theme";
import { useEffect, useMemo } from "react";
import { ROLE_NAMES, schemeRoles, type SchemeStyle } from "../lib/scheme";
import { wallpaperOptions } from "../lib/wallpaper-colors";
import { useWallpaperSeeds } from "./use-wallpaper-seeds";

/**
 * Writes the Material palette for the current wallpaper onto <html>, as
 * `--md-l-<role>` and `--md-d-<role>` (both themes at once, so a theme switch
 * is a stylesheet swap and never a recompute). The stylesheet resolves them
 * to `--md-<role>` per theme under `:root[data-os-theme="android"]`.
 *
 * The seed is the colour option the visitor chose (`useOsTheme().seed`): one
 * of the wallpaper's own (`useWallpaperSeeds` — Android's extraction for a
 * photograph, the ambient profile's live tint for a painted wallpaper), the
 * first by default, or a basic colour. With no full-page wallpaper there is
 * no picture to take a colour from, and Android's fallback seed stands.
 *
 * Mounted once, inside the ambient provider; renders nothing. Only computes
 * while the theme generates its colour (the Android theme).
 */
export function DynamicColorBridge() {
  const os = useOptionalOsTheme();
  // Only a theme that generates its palette from the wallpaper computes one;
  // leaving it clears the variables (below), so nothing lingers.
  const active = os?.meta.dynamicColor ?? false;
  const style: SchemeStyle = os?.schemeStyle ?? "tonal-spot";
  const choice = os?.seed;
  const options = wallpaperOptions(useWallpaperSeeds());

  // The chosen option: a basic colour as is, or the wallpaper's option in
  // its slot (the style came with it, into `schemeStyle`).
  const seed =
    choice?.kind === "basic"
      ? choice.argb
      : options[Math.min(choice?.index ?? 0, options.length - 1)].seed;

  const palette = useMemo(() => {
    if (!active) return null;
    return {
      light: schemeRoles(seed, style, false),
      dark: schemeRoles(seed, style, true),
    };
  }, [active, seed, style]);

  useEffect(() => {
    const root = document.documentElement.style;
    if (!palette) {
      for (const name of ROLE_NAMES) {
        root.removeProperty(`--md-l-${name}`);
        root.removeProperty(`--md-d-${name}`);
      }
      return;
    }
    for (const name of ROLE_NAMES) {
      root.setProperty(`--md-l-${name}`, palette.light[name]);
      root.setProperty(`--md-d-${name}`, palette.dark[name]);
    }
  }, [palette]);

  return null;
}
