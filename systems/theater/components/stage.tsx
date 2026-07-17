"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useMemo } from "react";
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
}

export function Stage({
  hostRef,
  rect,
  track,
  active,
  visible,
  dragging,
}: StageProps) {
  const isYouTube = track?.platform === "youtube" && !!track.videoId;
  const embedUrl = useMemo(
    () => (track && !isYouTube ? embedUrlFor(track.url, track.platform) : null),
    [track, isYouTube],
  );

  return (
    <motion.div
      aria-hidden={!visible}
      className={cn(
        "theater-stage fixed z-[10002] overflow-hidden bg-black",
        "rounded-none sm:rounded-xl",
        visible
          ? "shadow-overlay ring-1 ring-white/15 pointer-events-auto"
          : "pointer-events-none",
      )}
      animate={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        opacity: visible ? 1 : 0,
      }}
      transition={dragging ? { duration: 0 } : { duration: 0.34, ease: EASE }}
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
          active so it keeps playing when parked / minimized. */}
      {active && !isYouTube && embedUrl && (
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={track?.title ?? "Video"}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          scrolling="no"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
          className="absolute inset-0 h-full w-full border-0"
        />
      )}

      {/* Fallback frame when a track can't be embedded. */}
      {active && !isYouTube && !embedUrl && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-white/60">
          Unable to play this video
        </div>
      )}
    </motion.div>
  );
}
