"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useWeather } from "../provider";
import { useWallpaper } from "../provider";
import { GradientStack } from "./gradient-stack";
import { BEZEL_INSET, BEZEL_LAYER_ATTRIBUTE } from "@hux/bezel";
import {
  ParallaxDriver,
  type ParallaxPermission,
  type ParallaxSource,
} from "../lib/parallax";
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
    reportShaderFallback,
    statsRef,
    parallax,
    parallaxPermission,
    reportParallaxStatus,
  } = useWallpaper();
  const { scene } = useWeather();

  const useShader = kind === "weather" && renderer === "shader";
  const setStage = useParallaxStage(enabled && parallax, parallaxPermission, reportParallaxStatus);

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
      {/* The parallax stage. It is here whether or not the egg is on, so
          switching it never remounts the canvas or restarts a crossfade;
          `overflow-hidden` keeps the zoomed layer inside the bezel as it
          drifts. */}
      <div ref={setStage} className="absolute inset-0 overflow-hidden">
        {useShader ? (
          <WeatherWallpaper
            scene={scene}
            active={enabled}
            edgeMask={edgeMask}
            onFallback={reportShaderFallback}
            statsRef={statsRef}
          />
        ) : (
          /* Full-page background is already viewport-fixed, so the edge mask is
             applied statically (no per-frame tracking needed). */
          <GradientStack layers={layers} edgeMask={edgeMask} blurred={blurred} />
        )}
      </div>

      {veil > 0 && (
        <div
          className="absolute inset-0 bg-background transition-opacity duration-500"
          style={{ opacity: veil }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useParallaxStage — the ParallaxDriver that owns the stage's transform.
//
// The driver writes that transform itself, on a rAF, so a tilt sixty times a
// second is zero React renders. It is kept across on/off so the two are a
// glide each way: `stop` eases out of the crop and leaves the layer clean,
// where a teardown would snap it. Only a change the driver cannot absorb —
// reduced motion — rebuilds it.
// ---------------------------------------------------------------------------

function useParallaxStage(
  active: boolean,
  permission: ParallaxPermission,
  onStatus: (status: { source: ParallaxSource; permission: ParallaxPermission }) => void
) {
  // The stage is state, not a ref: this component returns null until the
  // background stack has something in it, so the element arrives after the
  // first render and the driver has to be built when it does.
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const driverRef = useRef<ParallaxDriver | null>(null);
  const reducedMotion = useReducedMotion() ?? false;

  useEffect(() => {
    if (!stage) return;
    // `onStatus` is the provider's stable reporter, so it can be a dependency
    // without churning the driver.
    const driver = new ParallaxDriver(stage, { reducedMotion, onStatus });
    driverRef.current = driver;
    return () => {
      driver.destroy();
      driverRef.current = null;
    };
  }, [stage, reducedMotion, onStatus]);

  // Effects run in order, so whatever the effect above just built is what this
  // one drives — which is why the driver's own inputs are dependencies here too.
  useEffect(() => {
    const driver = driverRef.current;
    if (!driver) return;
    if (active) driver.start(permission);
    else driver.stop();
  }, [stage, reducedMotion, active, permission]);

  return setStage;
}
