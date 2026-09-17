"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef } from "react";
import {
  isBackgroundClick,
  strikePoint,
  STRIKE_COOLDOWN_MS,
} from "../lib/strike";
import {
  WIPE_ARM_MS,
  WIPE_ARM_SLOP_PX,
  WIPE_MIN_FOG,
  WIPE_RESUME_MS,
  WIPE_RESUME_NEAR,
  WIPE_SLOP_PX,
  type WipeHandle,
} from "../lib/wipe";
import { useHomeEditing } from "@/components/ui/home-edit-store";
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
// It is also where the thunder-day easter egg is wired: the wallpaper layer is
// pointer-events-none (it must be — it is behind the whole page), so the click
// is caught on the document and handed to the shader. The egg belongs to the
// Sky alone — a wash has no geometry to strike, and a flash without a bolt is
// not the same find — so it is armed only while the shader is the one painting.
// See lib/strike.ts for what counts as a click on the sky.
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

/**
 * The most path one frame may carry, as x, y pairs — a couple of hundred
 * samples, which no real hand reaches and a stalled tab would otherwise.
 */
const MAX_PENDING = 512;

/** Not in `CSSStyleDeclaration`, and the only way to sit on iOS's own hold. */
const CALLOUT = "-webkit-touch-callout";

/** What a wipe gesture reports back, in client coordinates. */
interface WipeGestureHandlers {
  /** The pointer is on the sky, here. Once per frame along the stroke. */
  onPoke: (clientX: number, clientY: number) => void;
  /** The stroke is over — after its last `onPoke`. */
  onEnd?: () => void;
}

/**
 * The foggy-day easter egg: while `armed`, a drag that stays on the wallpaper
 * wipes the mist along its path.
 *
 * A drag cannot use the strike's click trick, so it has to tell a wipe from a
 * scroll itself — and it cannot do that by watching which way the hand goes.
 * `preventDefault` on a pointer event does not stop scrolling; only a
 * non-passive `touchmove` does, and only before the scroll has started, which
 * on iOS means before the finger has moved at all. So on touch the question is
 * settled while the finger is still still, by a hold, exactly the way the
 * widget grid settles it (`TOUCH_ACTIVATION` in components/ui/sortable-order).
 * On a mouse there is no ambiguity and the slop is enough.
 *
 * "Is this the sky?" — the expensive question, a `getComputedStyle` per
 * ancestor — is asked once, on `pointerdown`, and never again while the hand
 * moves. The path itself is taken whole, coalesced samples and all, and handed
 * over once a frame; see `sample`.
 */
function useWipeOnDrag(armed: boolean, handlers: WipeGestureHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!armed) return;

    // The gesture in progress. `id` of -1 is "no hand down"; `live` means it
    // has been decided to be a wipe rather than a scroll or a stray press.
    let id = -1;
    let live = false;
    let touch = false;
    let startX = 0;
    let startY = 0;
    let atX = 0;
    let atY = 0;
    let raf = 0;
    let arming = 0;
    let selectable = "";
    let callout = "";
    // Where and when the last stroke ended, for the resume window.
    let endedAt = 0;
    let endedX = 0;
    let endedY = 0;
    // The path since the last frame, as x, y pairs.
    const pending: number[] = [];

    const flush = () => {
      raf = 0;
      if (live) {
        for (let i = 0; i < pending.length; i += 2) {
          handlersRef.current.onPoke(pending[i], pending[i + 1]);
        }
      }
      pending.length = 0;
    };

    /**
     * Take the whole path, hand it over once a frame.
     *
     * A `pointermove` is not one position: the browser coalesces everything the
     * digitiser reported since the last one into it, and a pen or a trackpad
     * reports several times a frame. Keeping only the newest — which is what
     * "sample once a frame" used to mean here — throws the shape of the path
     * away and hands the renderer a frame-rate polygon to draw, so a fast curve
     * comes out as the chords between wherever the hand happened to be on each
     * frame. Every one of them goes in, in order; what to keep is the
     * renderer's decision, and it makes it by shape rather than by count.
     *
     * The *delivery* is still once a frame, because that is how often anything
     * can be drawn. A stalled frame is capped: past the ceiling the oldest
     * samples go, since the near end of the path is the part still being drawn.
     */
    const sample = (event: PointerEvent) => {
      const coalesced = event.getCoalescedEvents?.() ?? [];
      if (coalesced.length > 0) {
        for (const e of coalesced) pending.push(e.clientX, e.clientY);
      } else {
        pending.push(event.clientX, event.clientY);
      }
      if (pending.length > MAX_PENDING) {
        pending.splice(0, pending.length - MAX_PENDING);
      }
      if (!raf) raf = requestAnimationFrame(flush);
    };

    /**
     * The one thing that stops the page scrolling under a wipe — and the reason
     * the hold above has to happen first. A pointer event cannot cancel a
     * scroll; only a non-passive `touchmove` can, and only before the scroll has
     * started, which on iOS means before the finger has moved at all.
     *
     * It is attached when a stroke arms and removed the moment it ends, never
     * while one is merely possible: a non-passive `touchmove` sitting on the
     * document makes the browser wait for JS on every scroll frame, and the
     * page's own scrolling is not this egg's to slow down.
     */
    const holdScroll = (event: TouchEvent) => {
      if (live && event.cancelable) event.preventDefault();
    };

    /**
     * Once it is a wipe, the page stops selecting and scrolling under it. A hand
     * dragged across the sky would otherwise leave a blue smear of whatever text
     * it crossed — and clear whatever was already selected, since a selection
     * made before the gesture was claimed is not something the visitor asked for
     * either.
     */
    const engage = () => {
      live = true;
      const root = document.documentElement;
      selectable = root.style.userSelect;
      root.style.userSelect = "none";
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) selection.removeAllRanges();
      if (touch) {
        document.addEventListener("touchmove", holdScroll, { passive: false });
      }
      // The mist opening under the finger is the only "armed" tell there is, and
      // the only one worth having: it is the effect itself.
      handlersRef.current.onPoke(atX, atY);
    };

    const disarm = () => {
      if (arming) clearTimeout(arming);
      arming = 0;
    };

    const release = () => {
      disarm();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (live) {
        // Whatever the last frame did not get to belongs to THIS stroke, and it
        // has to go in before the stroke is closed. Dropping it loses the tail
        // of every stroke whose last move and release land in the same frame,
        // which on a quick lift is most of them.
        flush();
        document.documentElement.style.userSelect = selectable;
        document.removeEventListener("touchmove", holdScroll);
        handlersRef.current.onEnd?.();
        endedAt = performance.now();
        endedX = atX;
        endedY = atY;
      }
      // And nothing may outlive the gesture. A sample left in the queue is
      // replayed by the *next* stroke's first frame, after that stroke has
      // already begun — and since the two ends are usually nearer than
      // WIPE_JUMP, the renderer joins them: a line straight from where the next
      // touch went down back to where the last one came up.
      pending.length = 0;
      if (touch) {
        const root = document.documentElement;
        if (callout) root.style.setProperty(CALLOUT, callout);
        else root.style.removeProperty(CALLOUT);
      }
      id = -1;
      live = false;
    };

    /** Is this touch the next stroke of something already being drawn? */
    const resuming = (x: number, y: number) => {
      if (!endedAt || performance.now() - endedAt > WIPE_RESUME_MS) return false;
      const near = WIPE_RESUME_NEAR * window.innerHeight;
      return Math.hypot(x - endedX, y - endedY) <= near;
    };

    const onDown = (event: PointerEvent) => {
      // A second finger is a pinch, or a scroll starting over. Either way this
      // is not one hand drawing: give the gesture back rather than fight for it.
      if (id !== -1) {
        detach();
        release();
        return;
      }
      if (!event.isPrimary || event.button !== 0 || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;
      if (!isBackgroundClick(event.target)) return;
      id = event.pointerId;
      touch = event.pointerType !== "mouse";
      startX = atX = event.clientX;
      startY = atY = event.clientY;
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onCancel);
      if (!touch) return;
      // iOS starts its own ~500 ms clock on a press, and the callout it can put
      // up would land right on top of a stroke. Suppressed for the length of
      // this press and restored on release, whether it became a wipe or not.
      const root = document.documentElement;
      callout = root.style.getPropertyValue(CALLOUT);
      root.style.setProperty(CALLOUT, "none");
      if (resuming(atX, atY)) engage();
      else arming = window.setTimeout(engage, WIPE_ARM_MS);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== id) return;
      atX = event.clientX;
      atY = event.clientY;
      if (!live) {
        const travelled = Math.hypot(atX - startX, atY - startY);
        if (touch) {
          // The finger moved before the hold was good, so it was the scroller's
          // all along. Nothing was ever bound, so there is nothing to give back
          // — but the gesture still has to be closed properly, or the callout
          // suppression put up on the way down is left on the document for the
          // rest of the session.
          if (travelled > WIPE_ARM_SLOP_PX) {
            detach();
            release();
          }
          return;
        }
        if (travelled <= WIPE_SLOP_PX) return;
        engage();
      }
      sample(event);
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== id) return;
      atX = event.clientX;
      atY = event.clientY;
      // A mouse press that never travelled is a click, and a click clears one
      // patch. On touch the hold has already done that, or nothing has.
      if (!live && !touch) {
        handlersRef.current.onPoke(atX, atY);
        handlersRef.current.onEnd?.();
      }
      detach();
      release();
    };

    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== id) return;
      detach();
      release();
    };

    const detach = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
    };

    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      detach();
      release();
    };
  }, [armed]);
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
    reportShaderFallback,
    statsRef,
  } = useWallpaper();
  const { scene } = useWeather();

  const useShader = kind === "weather" && renderer === "shader";

  // The strike, the Sky's alone: the ref is registered by <WeatherWallpaper />
  // and is null under every other engine, so the egg cannot half-exist.
  const layerRef = useRef<HTMLDivElement | null>(null);
  const strikeRef = useRef<((x: number, y: number) => void) | null>(null);
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
    return strikePoint(layer.getBoundingClientRect(), clientX, clientY);
  }, []);

  useStrikeOnClick(sky && scene.lightning > 0, (clientX, clientY) => {
    const point = at(clientX, clientY);
    if (point) strikeRef.current?.(point.x, point.y);
  });

  useWipeOnDrag(sky && scene.fog >= WIPE_MIN_FOG, {
    onPoke: (clientX, clientY) => {
      const point = at(clientX, clientY);
      if (point) wipeRef.current?.wipe(point.x, point.y);
    },
    onEnd: () => wipeRef.current?.wipeEnd(),
  });

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
      {useShader ? (
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
          strikeRef={strikeRef}
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
