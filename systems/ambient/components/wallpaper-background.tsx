"use client";

import { cn } from "@/lib/utils";
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
// An image wallpaper paints at FULL STRENGTH. On the home screen that is the
// whole treatment: the picture is the content, sharp and untinted, with the
// widgets floating on it. Reading pages recede it instead — a defocus and a
// veil over the top, which costs far less of the picture than dimming the layer
// itself on every route alike. All three parts are switchable in the devtool
// (see lib/reading-surface.ts) because it is a taste call.
// ---------------------------------------------------------------------------

interface WallpaperBackgroundProps {
  enabled: boolean;
}

export function WallpaperBackground({ enabled }: WallpaperBackgroundProps) {
  const { gradientLayers, edgeFadeMask } = useWeather();
  const { opacity, veil, blurred } = useWallpaper();

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
          blurred && "scale-110 blur-2xl"
        )}
      >
        {/* Full-page background is already viewport-fixed, so the edge mask is
            applied statically (no per-frame tracking needed). */}
        <GradientStack layers={gradientLayers} edgeMask={edgeFadeMask} />
      </div>

      {/* The veil, and an edge vignette under it that recedes the picture at
          the margins so the reading column reads as the figure. Full-bleed —
          no card, no radius. */}
      {veil > 0 && (
        <>
          <div
            className="absolute inset-0 bg-background transition-opacity duration-500"
            style={{ opacity: veil }}
          />
          <div className="wallpaper-read-vignette absolute inset-0" />
        </>
      )}
    </div>
  );
}
