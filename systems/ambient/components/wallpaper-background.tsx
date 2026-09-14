"use client";

import { cn } from "@/lib/utils";
import { useWallpaper } from "../provider";
import { GradientStack } from "./gradient-stack";
import { BEZEL_INSET } from "@/systems/bezel";

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
// widgets floating on it. Reading pages recede it instead — a defocus inside
// each layer and a veil over the stack. The soft-edge mask stays on the layer
// itself, OUTSIDE the blur, so the fade is never blurred or scaled with the
// picture; that is the arrangement that holds up on iOS Safari.
// ---------------------------------------------------------------------------

interface WallpaperBackgroundProps {
  enabled: boolean;
}

export function WallpaperBackground({ enabled }: WallpaperBackgroundProps) {
  const { layers, edgeMask, opacity, veil, blurred, letterbox } = useWallpaper();

  if (layers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      // On a locked phone this must not be `position: fixed`: Safari tints its
      // chrome from fixed content at the viewport edge, and a wallpaper there
      // would win over the frame colour. See `data-bezel-layer` in globals.css.
      data-bezel-layer
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out"
      )}
      // Framed, the layer stops inside the bezel — see AmbientSurface.
      style={{ opacity: enabled ? opacity : 0, ...(letterbox ? BEZEL_INSET : null) }}
    >
      {/* Full-page background is already viewport-fixed, so the edge mask is
          applied statically (no per-frame tracking needed). */}
      <GradientStack layers={layers} edgeMask={edgeMask} blurred={blurred} />

      {veil > 0 && (
        <div
          className="absolute inset-0 bg-background transition-opacity duration-500"
          style={{ opacity: veil }}
        />
      )}
    </div>
  );
}
