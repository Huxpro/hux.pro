"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { isReadingSurface } from "../lib/reading-surface";
import { useWallpaper, useWeather } from "../provider";
import { GradientStack } from "./gradient-stack";

// ---------------------------------------------------------------------------
// WallpaperBackground — the full-page background layer.
//
// Source-agnostic: it renders whatever the provider's single background stack
// currently holds (a weather/sun-event gradient, or an image wallpaper). That
// is what keeps them mutually exclusive — there is one layer, not several that
// have to be arbitrated.
//
// How strongly it paints is resolved upstream (`useWallpaper().opacity`), since
// the right weight depends on the kind and the theme together: photographs
// carry far more contrast than a gradient, and light mode has the least
// headroom.
//
// On reading surfaces an image wallpaper also recedes — defocused, and vignetted
// at the edges — so the prose column stays the figure. See lib/reading-surface.
// ---------------------------------------------------------------------------

interface WallpaperBackgroundProps {
  enabled: boolean;
}

export function WallpaperBackground({ enabled }: WallpaperBackgroundProps) {
  const { gradientLayers, edgeFadeMask } = useWeather();
  const { kind, opacity } = useWallpaper();
  const pathname = usePathname();

  const reading = isReadingSurface({ kind, pathname });

  if (gradientLayers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden",
        "transition-opacity duration-700 ease-in-out"
      )}
      style={{ opacity: enabled ? opacity : 0 }}
    >
      <div
        className={cn(
          "absolute inset-0 transition-[filter,transform] duration-500",
          // Scale past the frame so the blur has pixels to sample at the edges
          // instead of fading into nothing.
          reading && "scale-110 blur-2xl"
        )}
      >
        {/* Full-page background is already viewport-fixed, so the edge mask is
            applied statically (no per-frame tracking needed). */}
        <GradientStack layers={gradientLayers} edgeMask={edgeFadeMask} />
      </div>

      {/* Edge vignette — recedes the photo at the margins so the reading column
          reads as the figure. Full-bleed wash; no card, no radius. */}
      {reading && <div className="wallpaper-read-vignette absolute inset-0" />}
    </div>
  );
}
