"use client";

import { cn } from "@/lib/utils";
import { useWeather } from "../provider";
import { useWallpaper } from "../provider";
import { GradientStack } from "./gradient-stack";
import { BEZEL_INSET, BEZEL_LAYER_ATTRIBUTE } from "@hux/bezel";
import { WeatherWallpaper } from "./wallpaper";

// ---------------------------------------------------------------------------
// WallpaperBackground — the full-page background layer.
//
// Source-agnostic: it renders whatever the provider's single background stack
// currently holds (a weather sky, or an image wallpaper). That is what keeps
// them mutually exclusive — there is one layer, not several that have to be
// arbitrated.
//
// Under the weather kind there are two engines for the same scene. The CG
// style paints a WebGL canvas (sun, moon, clouds, rain, snow, fog, lightning,
// stars) at full strength — its theme veil is mixed inside the shader. The
// gradient style, and any WebGL fallback, paints the crossfading CSS stack at
// the wash opacity. The provider resolves which one (`renderer`), so this
// component only swaps the child.
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
  const {
    kind,
    renderer,
    layers,
    edgeMask,
    opacity,
    veil,
    blurred,
    bezel,
    gyro,
    reportShaderFallback,
    statsRef,
  } = useWallpaper();
  const { scene } = useWeather();

  const useShader = kind === "weather" && renderer === "shader";
  if (!useShader && layers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      // In container scroll this must not be `position: fixed`: Safari tints its
      // chrome from fixed content at the viewport edge, and a wallpaper there
      // would win over the bezel colour. See BEZEL_LAYER_ATTRIBUTE in @hux/bezel.
      {...{ [BEZEL_LAYER_ATTRIBUTE]: "" }}
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out"
      )}
      // With the bezel on, the layer stops inside it — see AmbientSurface.
      style={{ opacity: enabled ? opacity : 0, ...(bezel ? BEZEL_INSET : null) }}
    >
      {useShader ? (
        <WeatherWallpaper
          scene={scene}
          active={enabled}
          gyro={gyro.active}
          edgeMask={edgeMask}
          onFallback={reportShaderFallback}
          statsRef={statsRef}
        />
      ) : (
        /* Full-page background is already viewport-fixed, so the edge mask is
           applied statically (no per-frame tracking needed). */
        <GradientStack layers={layers} edgeMask={edgeMask} blurred={blurred} />
      )}

      {veil > 0 && (
        <div
          className="absolute inset-0 bg-background transition-opacity duration-500"
          style={{ opacity: veil }}
        />
      )}
    </div>
  );
}
