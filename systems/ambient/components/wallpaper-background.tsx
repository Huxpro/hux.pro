"use client";

import { cn } from "@/lib/utils";
import { useAfterFirstPaint } from "@/lib/deferred";
import { useReducedMotion } from "framer-motion";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef } from "react";
import {
  armedPoke,
  isBackgroundPress,
  pokePoint,
  POKE_COOLDOWN_MS,
  type PokeKind,
} from "../lib/poke";
import { attachWipeDrag, WIPE_MIN_FOG, type WipeHandle } from "../lib/wipe";
import {
  attachTiltPrimer,
  shouldOfferTilt,
  TILT_PRIMER_MIN_PRECIP,
} from "../lib/tilt-primer";
import { useHomeEditing } from "@/components/ui/home-edit-store";
import { useWeather } from "../provider";
import { useWallpaper } from "../provider";
import { GradientStack } from "./gradient-stack";
import { BEZEL_INSET, BEZEL_LAYER_ATTRIBUTE } from "@hux/bezel";
const WeatherWallpaper = dynamic(
  () => import("./wallpaper").then((m) => ({ default: m.WeatherWallpaper })),
  { ssr: false },
);

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
// It is also where the weather easter eggs are wired: the wallpaper layer is
// pointer-events-none (it must be — it is behind the whole page), so the click
// is caught on the document and handed to the shader. The tapped eggs — a bolt
// on a thunder day, a meteor on a clear night — belong to the Sky alone: a wash
// has no geometry to strike and no star field for a streak to belong to, and
// either one faked would be a lesser find, so they are armed only while the
// shader is the one painting. See lib/poke.ts for which weather answers a
// click, with what, and what counts as a click on the sky.
//
// The foggy-day egg — a drag wipes the mist clear — is wired here too, and on
// the same terms: only the Sky has a fog layer to thin and a sky behind it to
// uncover, so it is armed only while the shader is painting. See lib/wipe.ts.
//
// The rain-and-snow egg — a drag stirs up a gust — is armed inside
// <WeatherWallpaper /> instead, for the same reason one layer down: only the
// Sky has particles for a wind to blow.
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
 * The tap the easter eggs are found by: while a kind is armed, a click that
 * lands on the wallpaper — and nowhere else — is handed on to be answered.
 * Armed *is* the kind, so there is one source of truth for both questions.
 *
 * On `click` rather than `pointerdown`, which is what makes it survive a phone:
 * a click is press and release on the same spot, so scrolling the page with a
 * thumb on the sky never lights it up. A drag that ended in a selection is
 * dropped too, and two pokes a second is the ceiling (see lib/poke.ts).
 */
function usePokeOnClick(
  kind: PokeKind | null,
  fire: (kind: PokeKind, clientX: number, clientY: number) => void
) {
  const fireRef = useRef(fire);
  useEffect(() => {
    fireRef.current = fire;
  });
  const lastAt = useRef(0);

  useEffect(() => {
    if (!kind) return;
    const onClick = (event: MouseEvent) => {
      // The cooldown first: it is a subtraction, and the sky test below walks
      // ancestors asking for computed styles.
      const at = event.timeStamp || performance.now();
      if (at - lastAt.current < POKE_COOLDOWN_MS) return;
      if (!isBackgroundPress(event)) return;
      lastAt.current = at;
      fireRef.current(kind, event.clientX, event.clientY);
    };
    // Bubble phase, on purpose: anything that stopped the click handled it.
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [kind]);
}

export function WallpaperBackground({ enabled }: WallpaperBackgroundProps) {
  const {
    kind,
    renderer,
    layers,
    crossfadeMs,
    skyThemeEaseMs,
    edgeMask,
    opacity,
    veil,
    blurred,
    bezel,
    gyro,
    gyroPrimed,
    offerTilt,
    reportShaderFallback,
    statsRef,
  } = useWallpaper();
  const { scene } = useWeather();

  const useShader = kind === "weather" && renderer === "shader";
  // Keep the shader + renderer chunk off first paint / TTI. The bezel boot
  // script already painted the ground colour; the canvas fades in on its
  // first frame the same way it always has.
  const skyReady = useAfterFirstPaint(useShader);

  // The pokes, the Sky's alone: the ref is registered by <WeatherWallpaper />
  // and is null under every other engine, so the eggs cannot half-exist. One
  // ref for both of them — a scene can only ever arm one, so there is never a
  // question of which one answers.
  const layerRef = useRef<HTMLDivElement | null>(null);
  const pokeRef = useRef<
    ((kind: PokeKind, x: number, y: number) => void) | null
  >(null);
  const wipeRef = useRef<WipeHandle | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  // Not while the home grid is in jiggle edit mode: there a tap on the empty
  // background means Done, and a long press there is about to mean Done too.
  // The page's own controls outrank an egg every time.
  const editingHome = useHomeEditing();
  const sky = enabled && useShader && !reducedMotion && !editingHome;

  /** Client space → the wallpaper layer's own, or null when that is not sky. */
  const at = useCallback((clientX: number, clientY: number) => {
    const layer = layerRef.current;
    if (!layer) return null;
    return pokePoint(layer.getBoundingClientRect(), clientX, clientY);
  }, []);

  // Which egg this weather has, if any — one scene can only ever arm one, so
  // nothing here has to arbitrate. A meteor is a small, fast, bright object
  // rather than a full-screen flash, so it is much less of a photosensitivity
  // concern than the strike; it refuses under `prefers-reduced-motion` all the
  // same (through `sky`), because the setting is about motion and not only
  // about flashes.
  const poke = sky ? armedPoke(scene) : null;
  usePokeOnClick(poke, (kind, clientX, clientY) => {
    const point = at(clientX, clientY);
    if (point) pokeRef.current?.(kind, point.x, point.y);
  });

  // The foggy-day egg. The recognizer is `lib/wipe.ts`'s, the way the gust's is
  // `lib/wallpaper/stir.ts`'s; all this end does is put the path into the
  // layer's own space.
  const wiping = sky && scene.fog >= WIPE_MIN_FOG;
  useEffect(() => {
    if (!wiping) return;
    return attachWipeDrag({
      onWipe: (path) => {
        const layer = layerRef.current;
        const sink = wipeRef.current;
        if (!layer || !sink) return;
        // One rect for the whole batch: the layer is `fixed inset-0` and cannot
        // have moved between two samples of the same frame.
        const box = layer.getBoundingClientRect();
        for (let i = 0; i < path.length; i += 2) {
          const point = pokePoint(box, path[i], path[i + 1]);
          if (point) sink.wipe(point.x, point.y);
        }
      },
      onEnd: () => wipeRef.current?.wipeEnd(),
    });
  }, [wiping]);

  // Not an egg — the feature introducing itself. A finger resting on a rainy
  // or snowy sky brings up what the tilt does, once ever, and only where there
  // is a permission standing between the visitor and it. See lib/tilt-primer.ts.
  const offering = shouldOfferTilt({
    primed: gyroPrimed,
    gated: gyro.gated,
    wished: gyro.enabled,
    falling:
      scene.precipitation.type !== "none" &&
      scene.precipitation.intensity > TILT_PRIMER_MIN_PRECIP,
    sky,
  });
  useEffect(() => {
    if (!offering) return;
    return attachTiltPrimer(offerTilt);
  }, [offering, offerTilt]);

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
        "transition-opacity ease-in-out"
      )}
      style={{
        opacity: enabled ? opacity : 0,
        // A wash weighs differently in the two themes (WALLPAPER_OPACITY), so
        // this moves on a theme change too — at the crossfade's pace, which is
        // the sun's slower one while the theme hands over.
        transitionDuration: `${crossfadeMs}ms`,
        ...(bezel ? BEZEL_INSET : null),
      }}
    >
      {useShader && skyReady ? (
        <WeatherWallpaper
          scene={scene}
          active={enabled}
          themeEaseMs={skyThemeEaseMs}
          gyro={gyro.active}
          edgeMask={edgeMask}
          // This is the one sky a hand can reach: a drag across the page
          // background stirs up a gust.
          interactive
          onFallback={reportShaderFallback}
          statsRef={statsRef}
          pokeRef={pokeRef}
          wipeRef={wipeRef}
        />
      ) : (
        /* Full-page background is already viewport-fixed, so the edge mask is
           applied statically (no per-frame tracking needed). */
        <GradientStack
          layers={layers}
          durationMs={crossfadeMs}
          edgeMask={edgeMask}
          blurred={blurred}
        />
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
