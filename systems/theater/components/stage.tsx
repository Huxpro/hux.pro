"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useLayoutEffect, useMemo, useRef } from "react";
import { embedUrlFor } from "../lib/player";
import type { StageRect, Track } from "../lib/types";

// ---------------------------------------------------------------------------
// Stage — the single persistent player element.
//
// Rendered once by the provider and repositioned (never remounted) as the mode
// morphs between theater / PiP / parked-off-screen. This is what lets playback
// survive mode + route changes: the YouTube player lives in `hostRef` (the API
// replaces the mounted child with its iframe), and non-YouTube tracks get a
// plain iframe here too. Chrome (controls, playlist, backdrop) is drawn by the
// overlays at higher/lower z, aligned to the same rect.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

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
   * When set, the stage node is moved into this element so it travels with
   * the Watch window. The same DOM node — the YouTube player must not remount.
   */
  dockTarget?: HTMLElement | null;
}

export function Stage({
  hostRef,
  rect,
  track,
  active,
  visible,
  dragging,
  pip,
  dockTarget = null,
}: StageProps) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const homeRef = useRef<HTMLDivElement>(null);
  const docked = !!dockTarget;

  useLayoutEffect(() => {
    const node = nodeRef.current;
    const home = homeRef.current;
    if (!node || !home) return;
    const parent = dockTarget ?? home;
    if (node.parentElement !== parent) parent.appendChild(node);
  }, [dockTarget]);
  const isYouTube = track?.platform === "youtube" && !!track.videoId;
  // A deck is its own player: the stage frames the deck URL as it is. Videos
  // off YouTube get a platform embed URL built for autoplay.
  const embedUrl = useMemo(() => {
    if (!track || isYouTube) return null;
    if (track.kind === "slides") return track.url;
    return embedUrlFor(track.url, track.platform);
  }, [track, isYouTube]);

  return (
    <div ref={homeRef} className="contents">
    <motion.div
      ref={nodeRef}
      aria-hidden={!visible}
      className={cn(
        "theater-stage overflow-hidden bg-black",
        docked ? "absolute inset-0 z-0 rounded-none" : "fixed z-[10002]",
        // PiP: flat bottom + widget-matched 2xl so it joins the glass bar as
        // one window. Theater: fully rounded, hairline ring.
        !docked && (pip ? "rounded-t-2xl" : "rounded-2xl"),
        visible && !docked && "shadow-overlay pointer-events-auto",
        docked && visible && "pointer-events-auto",
        visible && !docked && (pip ? "border border-b-0 border-border/50" : "ring-1 ring-white/15"),
        !visible && "pointer-events-none",
      )}
      style={{ transformOrigin: "center center" }}
      // A leftover `transform: scale(1)` containing-block blocks the Fullscreen
      // API, which is why iPad YouTube controls fall back to PiP. Drop the
      // transform once the morph has settled at scale 1.
      transformTemplate={({ scale }, generated) => {
        const s = typeof scale === "number" ? scale : 1;
        return s === 1 ? "none" : generated;
      }}
      initial={false}
      animate={
        docked
          ? {
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: visible ? 1 : 0,
              scale: 1,
            }
          : {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              opacity: visible ? 1 : 0,
              scale: visible ? 1 : 0.96,
            }
      }
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
    </div>
  );
}
