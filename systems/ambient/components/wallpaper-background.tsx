"use client";

import { cn } from "@/lib/utils";
import { useWallpaper, useWeather } from "../provider";
import { GradientStack } from "./gradient-stack";

// ---------------------------------------------------------------------------
// WallpaperBackground — the full-page background layer.
//
// Source-agnostic: it renders whatever the provider's single background stack
// currently holds (a weather/sun-event gradient, a vector wallpaper, or a
// photograph). That is what keeps them mutually exclusive — there is one layer,
// not several that have to be arbitrated.
//
// How strongly it paints is resolved upstream (`useWallpaper().opacity`), since
// the right weight depends on the medium and the theme together: photographs
// carry far more contrast than vector artwork, light mode has the least
// headroom, and a pair pinned against the theme has to fall back to a tint.
// ---------------------------------------------------------------------------

interface WallpaperBackgroundProps {
  enabled: boolean;
}

export function WallpaperBackground({ enabled }: WallpaperBackgroundProps) {
  const { gradientLayers, edgeFadeMask } = useWeather();
  const { opacity } = useWallpaper();

  if (gradientLayers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out"
      )}
      style={{ opacity: enabled ? opacity : 0 }}
    >
      {/* Full-page background is already viewport-fixed, so the edge mask is
          applied statically (no per-frame tracking needed). */}
      <GradientStack layers={gradientLayers} edgeMask={edgeFadeMask} />
    </div>
  );
}
