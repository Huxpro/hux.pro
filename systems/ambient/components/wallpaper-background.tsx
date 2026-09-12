"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/services";
import { useWallpaper, useWeather } from "../provider";
import { GradientStack } from "./gradient-stack";

// ---------------------------------------------------------------------------
// WallpaperBackground — the full-page background layer.
//
// Source-agnostic: it renders whatever the provider's single background stack
// currently holds (a weather/sun-event gradient, or a picture wallpaper). That
// is what keeps the two mutually exclusive — there is one layer, not two that
// have to be arbitrated.
//
// Picture wallpapers carry more contrast than the weather gradients, so they
// sit at a slightly lower opacity to keep body copy readable over them.
//
// Pinning the appearance against the app theme (a light wallpaper in dark mode,
// say) puts light artwork under light text. The pin is a deliberate choice, so
// we honour it rather than override it — but we pull the layer well back, which
// lets the themed page background carry the contrast and leaves the wallpaper
// reading as a tint. Matching pairs (the "auto" default) are unaffected.
// ---------------------------------------------------------------------------

interface WallpaperBackgroundProps {
  enabled: boolean;
}

export function WallpaperBackground({ enabled }: WallpaperBackgroundProps) {
  const { gradientLayers, edgeFadeMask } = useWeather();
  const { source, resolvedAppearance } = useWallpaper();
  const { theme } = useTheme();

  if (gradientLayers.length === 0) return null;

  const isPicture = source === "picture";
  const isPinnedAgainstTheme = isPicture && resolvedAppearance !== theme;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out",
        !enabled
          ? "opacity-0"
          : isPinnedAgainstTheme
          ? "opacity-25 dark:opacity-30"
          : isPicture
          ? "opacity-60 dark:opacity-75"
          : "opacity-70 dark:opacity-85"
      )}
    >
      {/* Full-page background is already viewport-fixed, so the edge mask is
          applied statically (no per-frame tracking needed). */}
      <GradientStack layers={gradientLayers} edgeMask={edgeFadeMask} />
    </div>
  );
}
