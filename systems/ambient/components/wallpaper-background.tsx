"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import {
  isBackgroundClick,
  strikePoint,
  STRIKE_COOLDOWN_MS,
} from "../lib/strike";
import { useWeather } from "../provider";
import { useWallpaper } from "../provider";
import { GradientStack } from "./gradient-stack";
import { BEZEL_INSET, BEZEL_LAYER_ATTRIBUTE } from "@hux/bezel";
import { StrikeFlash } from "./strike-flash";
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
// It is also where the thunder-day easter egg is wired: the wallpaper layer is
// pointer-events-none (it must be — it is behind the whole page), so the click
// is caught on the document and answered by whichever engine is mounted. See
// lib/strike.ts for what counts as a click on the sky.
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

/**
 * The thunder-day easter egg: while `armed`, a click that lands on the
 * wallpaper — and nowhere else — calls a bolt down onto it.
 *
 * On `click` rather than `pointerdown`, which is what makes it survive a phone:
 * a click is press and release on the same spot, so scrolling the page with a
 * thumb on the sky never lights it up. A drag that ended in a selection is
 * dropped too, and two strikes a second is the ceiling (see lib/strike.ts).
 */
function useStrikeOnClick(
  armed: boolean,
  fire: (clientX: number, clientY: number) => void
) {
  const fireRef = useRef(fire);
  useEffect(() => {
    fireRef.current = fire;
  });
  const lastAt = useRef(0);

  useEffect(() => {
    if (!armed) return;
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const at = event.timeStamp || performance.now();
      if (at - lastAt.current < STRIKE_COOLDOWN_MS) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      if (!isBackgroundClick(event.target)) return;
      lastAt.current = at;
      fireRef.current(event.clientX, event.clientY);
    };
    // Bubble phase, on purpose: anything that stopped the click handled it.
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [armed]);
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
  } = useWallpaper();
  const { scene } = useWeather();

  const useShader = kind === "weather" && renderer === "shader";

  // The strike. One ref, registered by whichever engine is mounted — there is
  // never more than one, so there is never a question of which one answers.
  const layerRef = useRef<HTMLDivElement | null>(null);
  const strikeRef = useRef<((x: number, y: number) => void) | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  useStrikeOnClick(
    enabled && kind === "weather" && scene.lightning > 0 && !reducedMotion,
    (clientX, clientY) => {
      const layer = layerRef.current;
      if (!layer) return;
      const point = strikePoint(layer.getBoundingClientRect(), clientX, clientY);
      if (point) strikeRef.current?.(point.x, point.y);
    }
  );

  if (!useShader && layers.length === 0) return null;

  return (
    <div
      ref={layerRef}
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
          edgeMask={edgeMask}
          onFallback={reportShaderFallback}
          statsRef={statsRef}
          strikeRef={strikeRef}
        />
      ) : (
        <>
          {/* Full-page background is already viewport-fixed, so the edge mask is
              applied statically (no per-frame tracking needed). */}
          <GradientStack layers={layers} edgeMask={edgeMask} blurred={blurred} />
          {kind === "weather" && <StrikeFlash strikeRef={strikeRef} />}
        </>
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
