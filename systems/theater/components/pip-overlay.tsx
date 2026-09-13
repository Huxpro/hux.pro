"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, SkipBack, SkipForward, X } from "lucide-react";
import { useRef } from "react";
import { GLASS_BTN, GLASS_CLUSTER, GLASS_PILL } from "../lib/chrome";
import { PIP_CONTROLS_H } from "../lib/geometry";
import { useTheater } from "../provider";
import { SurfaceSwitch } from "./surface-switch";

// ---------------------------------------------------------------------------
// PipOverlay — the floating, draggable Picture-in-Picture window.
//
// Universal across desktop (toggled from the theater) and phones (the default,
// since a full-screen takeover is too heavy there). The video is the shared
// <Stage />; this renders the control bar beneath it and owns the drag. On
// tablet+ it can expand back to theater; everywhere it can minimize to a Live
// Activity (keep listening) or close.
//
// Chrome matches Featured Talks / theater. The SurfaceSwitch pill marks PiP
// as the current view; Theater / Mini are the only moves. Close is outside
// the switcher — it ends the session, it is not a view.
// ---------------------------------------------------------------------------

const CLUSTER_BTN = cn(GLASS_BTN, "h-7 w-7");

export function PipOverlay() {
  const {
    mode,
    minimized,
    track,
    phase,
    rect,
    theaterAvailable,
    pipOffset,
    togglePlay,
    next,
    previous,
    toTheater,
    minimize,
    close,
    setPipOffset,
    setDragging,
    albumIndex,
    trackIndex,
    album,
    albums,
  } = useTheater();

  const open = mode === "pip" && !minimized;
  const isYouTube = track?.platform === "youtube" && !!track.videoId;
  const isPlaying = phase === "playing";

  const hasPrev = albumIndex > 0 || trackIndex > 0;
  const hasNext =
    trackIndex < (album?.tracks.length ?? 0) - 1 || albumIndex < albums.length - 1;

  const dragState = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragState.current = {
      x: e.clientX,
      y: e.clientY,
      ox: pipOffset.x,
      oy: pipOffset.y,
    };
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    if (!s) return;
    setPipOffset({ x: s.ox + (e.clientX - s.x), y: s.oy + (e.clientY - s.y) });
  };
  const onPointerUp = () => {
    dragState.current = null;
    setDragging(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="pip-controls"
          className={cn(
            "fixed z-[10004] flex items-center gap-1.5 px-1.5",
            // Same frosted card as WidgetShell; flat top so it joins the stage.
            "rounded-b-2xl border border-t-0 border-border/50",
            "bg-card/50 shadow-overlay backdrop-blur-xl",
          )}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          style={{
            top: rect.top + rect.height,
            left: rect.left,
            width: rect.width,
            height: PIP_CONTROLS_H,
          }}
        >
          {/* Drag handle + title — WidgetTitle voice. */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 active:cursor-grabbing"
          >
            <span className="truncate px-1.5 text-xs text-foreground/90">
              {track?.title ?? "Video"}
            </span>
          </div>

          <div className={GLASS_CLUSTER}>
            <button onClick={previous} disabled={!hasPrev} aria-label="Previous" className={CLUSTER_BTN}>
              <SkipBack className="h-3.5 w-3.5" fill="currentColor" />
            </button>
            {isYouTube && (
              <button
                onClick={togglePlay}
                aria-label={isPlaying ? "Pause" : "Play"}
                className={cn(CLUSTER_BTN, GLASS_PILL, "text-foreground")}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" fill="currentColor" />
                ) : (
                  <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                )}
              </button>
            )}
            <button onClick={next} disabled={!hasNext} aria-label="Next" className={CLUSTER_BTN}>
              <SkipForward className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          </div>

          <SurfaceSwitch
            current="pip"
            theaterAvailable={theaterAvailable}
            onSelect={(surface) => {
              if (surface === "theater") toTheater();
              if (surface === "mini") minimize();
            }}
          />
          <button onClick={close} aria-label="Close" className={CLUSTER_BTN}>
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
