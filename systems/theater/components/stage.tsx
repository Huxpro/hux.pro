"use client";

import { cn } from "@/lib/utils";
import { motion, useMotionValue, type MotionValue } from "framer-motion";
import { useEffect, useMemo } from "react";
import { embedUrlFor } from "../lib/player";
import type { StageRect, Track } from "../lib/types";

// ---------------------------------------------------------------------------
// Stage — the single persistent player element.
//
// Rendered once by the provider and repositioned (never remounted) as the mode
// morphs between theater / PiP / window / parked-off-screen. This is what lets playback
// survive mode + route changes: the YouTube player lives in `hostRef` (the API
// replaces the mounted child with its iframe), and non-YouTube tracks get a
// plain iframe here too. Chrome (controls, playlist, backdrop) is drawn by the
// overlays at higher/lower z, aligned to the same rect.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

/** How long the stage glides into a window's slot before it pins to it. */
const SETTLE_MS = 420;

/**
 * Pin the stage over a window's slot, every frame. A window is dragged and
 * resized by writing its DOM directly (no React render per frame), and it
 * springs open and genies away with transforms, so the slot's box is only
 * known by measuring it. For the first moments the stage closes the distance
 * rather than jumping, so arriving from PiP — or from wherever it last stood —
 * reads as the same player moving into the window.
 */
function useFollow(
  el: HTMLElement | null,
  values: Record<"top" | "left" | "width" | "height", MotionValue<number>>,
) {
  useEffect(() => {
    if (!el) return;
    const entries = Object.entries(values) as [keyof typeof values, MotionValue<number>][];
    entries.forEach(([, v]) => v.stop());
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const r = el.getBoundingClientRect();
      const k = performance.now() - start < SETTLE_MS ? 0.25 : 1;
      for (const [key, v] of entries) {
        const target = r[key];
        const cur = v.get();
        v.set(Math.abs(target - cur) < 0.5 ? target : cur + (target - cur) * k);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // The motion values are stable for the stage's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el]);
}

interface StageProps {
  hostRef: React.RefObject<HTMLDivElement | null>;
  rect: StageRect;
  track: Track | null;
  /** Player is mounted / playing (kept true while minimized for audio). */
  active: boolean;
  /** Stage is on-screen (false when parked / minimized / closed). */
  visible: boolean;
  dragging: boolean;
  /** In PiP the control bar sits directly below, so the video is flat-bottomed
   *  and shares a continuous border with the bar (reads as one window). */
  pip: boolean;
  /**
   * The Theater window's slot (unified windows): the stage stands over it, at
   * the window's z-index — above that window, below any in front of it —
   * instead of at its rect.
   */
  slot?: { el: HTMLElement; zIndex: number } | null;
}

export function Stage({
  hostRef,
  rect,
  track,
  active,
  visible,
  dragging,
  pip,
  slot = null,
}: StageProps) {
  const top = useMotionValue(rect.top);
  const left = useMotionValue(rect.left);
  const width = useMotionValue(rect.width);
  const height = useMotionValue(rect.height);
  useFollow(slot?.el ?? null, { top, left, width, height });
  const windowed = !!slot;
  const isYouTube = track?.platform === "youtube" && !!track.videoId;
  // A deck is its own player: the stage frames the deck URL as it is. Videos
  // off YouTube get a platform embed URL built for autoplay.
  const embedUrl = useMemo(() => {
    if (!track || isYouTube) return null;
    if (track.kind === "slides") return track.url;
    return embedUrlFor(track.url, track.platform);
  }, [track, isYouTube]);

  return (
    <motion.div
      aria-hidden={!visible}
      className={cn(
        "theater-stage fixed z-[10002] overflow-hidden bg-black",
        // PiP: flat bottom + widget-matched 2xl so it joins the glass bar as
        // one window. Theater: fully rounded, hairline ring. In a window it is
        // content, not a floating thing: no shadow of its own.
        windowed ? "rounded-xl" : pip ? "rounded-t-2xl" : "rounded-2xl",
        visible && "pointer-events-auto",
        visible && !windowed && "shadow-overlay",
        visible &&
          (windowed
            ? "ring-1 ring-black/10 dark:ring-white/10"
            : pip
              ? "border border-b-0 border-border/50"
              : "ring-1 ring-white/15"),
        !visible && "pointer-events-none",
      )}
      style={{
        transformOrigin: "center center",
        top,
        left,
        width,
        height,
        ...(slot ? { zIndex: slot.zIndex } : null),
      }}
      // A leftover `transform: scale(1)` containing-block blocks the Fullscreen
      // API, which is why iPad YouTube controls fall back to PiP. Drop the
      // transform once the morph has settled at scale 1.
      transformTemplate={({ scale }, generated) => {
        const s = typeof scale === "number" ? scale : 1;
        return s === 1 ? "none" : generated;
      }}
      initial={false}
      // Held by a window, the box is the window's business (useFollow);
      // otherwise it morphs to the mode's rect — from wherever it stood, a
      // window's slot included.
      animate={{
        ...(windowed
          ? null
          : { top: rect.top, left: rect.left, width: rect.width, height: rect.height }),
        opacity: visible ? 1 : 0,
        scale: visible ? 1 : 0.96,
      }}
      transition={
        dragging
          ? { duration: 0 }
          : {
              // Position/size morphs (theater ⇄ PiP) glide; show/hide is a
              // short, clean fade + scale in place — no fly-in from a corner.
              duration: 0.34,
              ease: EASE,
              opacity: { duration: 0.18, ease: "easeOut" },
              scale: { duration: 0.22, ease: "easeOut" },
            }
      }
    >
      {/* YouTube host — always mounted so the IFrame API instance persists. */}
      <div
        ref={hostRef}
        className={cn(
          "absolute inset-0 h-full w-full",
          isYouTube ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Non-YouTube (Bilibili / Vimeo) — a plain iframe, kept mounted while
          active so it keeps playing when parked / minimized. A slide deck is
          the same iframe: reveal.js drives itself from inside it (arrow keys
          once it has focus, taps on touch), so the stage only has to hold it.
          Decks get the clipboard for their own "copy link" affordances and no
          sandbox — they are ours, and reveal's fullscreen shortcut needs the
          real document. */}
      {active && !isYouTube && embedUrl && (
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={track?.title ?? "Video"}
          allow={
            track?.kind === "slides"
              ? "fullscreen; clipboard-write"
              : "autoplay; fullscreen; picture-in-picture"
          }
          allowFullScreen
          scrolling="no"
          sandbox={
            track?.kind === "slides"
              ? undefined
              : "allow-scripts allow-same-origin allow-popups allow-presentation"
          }
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      {/* Fallback frame when a track can't be embedded. */}
      {active && !isYouTube && !embedUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/60">
          {track?.kind === "slides" ? "Unable to open this deck" : "Unable to play this video"}
        </div>
      )}
    </motion.div>
  );
}
