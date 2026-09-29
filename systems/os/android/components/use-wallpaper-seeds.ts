"use client";

import { useOptionalOsTheme } from "@/services/os-theme";
import { useOptionalWallpaper } from "@/systems/ambient/provider";
import { useEffect, useMemo, useState } from "react";
import { seedFromTint } from "../lib/scheme";
import { wallpaperSeeds } from "../lib/wallpaper-colors";

/**
 * The wallpaper's colour options, best first (lib/wallpaper-colors.ts): up
 * to four read from a photograph, or the live tint for a painted wallpaper
 * (and while a photograph is still being read). Always at least one.
 */
export function useWallpaperSeeds(): number[] {
  const os = useOptionalOsTheme();
  const wallpaper = useOptionalWallpaper();
  const active = os?.meta.dynamicColor ?? false;
  const full = wallpaper?.fullEnabled ?? false;
  const src = full ? (wallpaper?.src ?? null) : null;
  const tint = full ? (wallpaper?.profile.tint ?? null) : null;
  // Rounded, so a Sky drifting through its scene re-seeds by the degree, not
  // on every frame.
  const h = tint ? Math.round(tint.h) : null;
  const c = tint ? Math.round(tint.c * 100) / 100 : null;
  const tintSeed = useMemo(
    () => seedFromTint(h === null || c === null ? null : { h, c }),
    [h, c],
  );

  const [image, setImage] = useState<{ src: string; seeds: number[] } | null>(null);
  useEffect(() => {
    if (!active || !src) return;
    let live = true;
    void wallpaperSeeds(src).then((seeds) => {
      if (live) setImage({ src, seeds });
    });
    return () => {
      live = false;
    };
  }, [active, src]);

  return useMemo(
    () => (src && image?.src === src && image.seeds.length ? image.seeds : [tintSeed]),
    [src, image, tintSeed],
  );
}
