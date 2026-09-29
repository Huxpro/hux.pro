"use client";

import { useOptionalSkin } from "@/services/skin";
import { useOptionalWallpaper } from "@/systems/ambient/provider";
import { useEffect, useMemo } from "react";
import {
  ROLE_NAMES,
  schemeRoles,
  seedFromTint,
  type SchemeStyle,
} from "../lib/scheme";

/**
 * Writes the Material palette for the current wallpaper onto <html>, as
 * `--md-l-<role>` and `--md-d-<role>` (both themes at once, so a theme switch
 * is a stylesheet swap and never a recompute). The stylesheet resolves them
 * to `--md-<role>` per theme under `html[data-skin="material"]`.
 *
 * The seed is the ambient profile's `tint` — the same dominant colour the
 * glow harmonises with (systems/glow/components/palette-bridge.tsx). With no
 * full-page wallpaper there is no picture to take a colour from, and the
 * stylesheet's baseline (Android's fallback seed) stands.
 *
 * Mounted once, inside the ambient provider; renders nothing. Only computes
 * while the skin is Material.
 */
export function DynamicColorBridge() {
  const skin = useOptionalSkin();
  const wallpaper = useOptionalWallpaper();
  const active = skin?.skin === "material";
  const style: SchemeStyle = skin?.schemeStyle ?? "tonal-spot";

  const tint =
    wallpaper?.fullEnabled && wallpaper.profile.tint ? wallpaper.profile.tint : null;
  // Rounded, so a Sky drifting through its scene re-seeds by the degree, not
  // on every frame.
  const h = tint ? Math.round(tint.h) : null;
  const c = tint ? Math.round(tint.c * 100) / 100 : null;

  const palette = useMemo(() => {
    if (!active) return null;
    const seed = seedFromTint(h === null || c === null ? null : { h, c });
    return {
      light: schemeRoles(seed, style, false),
      dark: schemeRoles(seed, style, true),
    };
  }, [active, h, c, style]);

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
