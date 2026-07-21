"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Maximize2,
  Minus,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  X,
} from "lucide-react";
import { useRef } from "react";
import { PIP_CONTROLS_H } from "../lib/geometry";
import { useTheater } from "../provider";

// ---------------------------------------------------------------------------
// PipOverlay — the floating, draggable Picture-in-Picture window.
//
// Universal across desktop (toggled from the theater) and mobile (the default,
// since a full-screen takeover is too heavy on phones). The video is the shared
// <Stage />; this renders the control bar beneath it and owns the drag. On
// desktop it can expand back to theater; everywhere it can minimize to a Live
// Activity (keep listening) or close.
// ---------------------------------------------------------------------------

export function PipOverlay() {
  const {
    mode,
    minimized,
    track,
    phase,
    rect,
    isCoarse,
    isYouTube,
    hasPrev,
    hasNext,
    pipOffset,
    togglePlay,
    next,
    previous,
    toTheater,
    minimize,
    close,
    setPipOffset,
    setDragging,
  } = useTheater();

  const open = mode === "pip" && !minimized;
  const isPlaying = phase === "playing";

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

  const barBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors active:scale-95 disabled:opacity-30 disabled:pointer-events-none";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="pip-controls"
          className="fixed z-[10004] flex items-center gap-1 rounded-b-xl border border-t-0 border-border/60 bg-card/85 px-2 shadow-overlay backdrop-blur-xl"
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
          {/* Drag handle + title. */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 active:cursor-grabbing"
          >
            <span className="text-[11px] font-medium text-foreground/90 truncate">
              {track?.title ?? "Video"}
            </span>
          </div>

          <div className="flex shrink-0 items-center">
            <button onClick={previous} disabled={!hasPrev} aria-label="Previous" className={barBtn}>
              <SkipBack className="h-3.5 w-3.5" fill="currentColor" />
            </button>
            {isYouTube && (
              <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className={barBtn}>
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" fill="currentColor" />
                ) : (
                  <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                )}
              </button>
            )}
            <button onClick={next} disabled={!hasNext} aria-label="Next" className={barBtn}>
              <SkipForward className="h-3.5 w-3.5" fill="currentColor" />
            </button>
            {!isCoarse && (
              <button onClick={toTheater} aria-label="Expand to theater" className={barBtn}>
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={minimize} aria-label="Minimize" className={barBtn}>
              <Minus className="h-4 w-4" />
            </button>
            <button onClick={close} aria-label="Close" className={barBtn}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
