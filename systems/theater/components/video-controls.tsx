"use client";

import { cn } from "@/lib/utils";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useTheater } from "../provider";
import { formatTime } from "../lib/player";

// ---------------------------------------------------------------------------
// VideoControls — transport controls bound to the global player. Full controls
// (scrub + play/pause) are only meaningful for YouTube tracks; other platforms
// keep their native in-iframe controls and expose only track navigation here.
// ---------------------------------------------------------------------------

interface VideoControlsProps {
  variant?: "theater" | "pip";
  className?: string;
}

export function VideoControls({ variant = "theater", className }: VideoControlsProps) {
  const {
    track,
    phase,
    currentTime,
    duration,
    isYouTube,
    hasPrev,
    hasNext,
    togglePlay,
    next,
    previous,
    seek,
  } = useTheater();

  const isPlaying = phase === "playing";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const pip = variant === "pip";
  const iconBtn =
    "inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors active:scale-[0.92] disabled:opacity-30 disabled:pointer-events-none";

  const scrubbable = isYouTube && duration > 0;

  const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubbable) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(Math.min(Math.max(ratio, 0), 1) * duration);
  };

  // Keyboard scrubbing: ←/→ nudge 5s, ↑/↓ 10s, Home/End jump to the ends.
  const onScrubKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!scrubbable) return;
    const step =
      e.key === "ArrowUp" || e.key === "ArrowDown"
        ? 10
        : e.key === "ArrowLeft" || e.key === "ArrowRight"
          ? 5
          : 0;
    let target: number | null = null;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") target = currentTime - step;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") target = currentTime + step;
    else if (e.key === "Home") target = 0;
    else if (e.key === "End") target = duration;
    if (target === null) return;
    e.preventDefault();
    seek(Math.min(Math.max(target, 0), duration));
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {isYouTube && (
        <div className={cn("flex items-center gap-2", pip ? "px-0.5" : "px-0")}>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-9 text-right">
            {formatTime(currentTime)}
          </span>
          <div
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            tabIndex={scrubbable ? 0 : -1}
            onClick={onScrub}
            onKeyDown={onScrubKey}
            className="group/scrub relative h-2 flex-1 cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
          >
            <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/25" />
            <div
              className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-foreground/70"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-9">
            {formatTime(duration)}
          </span>
        </div>
      )}

      <div className={cn("flex items-center", pip ? "justify-between" : "justify-center gap-2")}>
        <button
          onClick={previous}
          disabled={!hasPrev}
          aria-label="Previous video"
          className={cn(iconBtn, pip ? "h-8 w-8" : "h-9 w-9")}
        >
          <SkipBack className={pip ? "h-4 w-4" : "h-5 w-5"} fill="currentColor" />
        </button>

        {isYouTube ? (
          <button
            onClick={togglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className={cn(
              "inline-flex items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95",
              pip ? "h-9 w-9" : "h-11 w-11",
            )}
          >
            {isPlaying ? (
              <Pause className={pip ? "h-4 w-4" : "h-5 w-5"} fill="currentColor" />
            ) : (
              <Play className={cn("translate-x-px", pip ? "h-4 w-4" : "h-5 w-5")} fill="currentColor" />
            )}
          </button>
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {track?.platform}
          </span>
        )}

        <button
          onClick={next}
          disabled={!hasNext}
          aria-label="Next video"
          className={cn(iconBtn, pip ? "h-8 w-8" : "h-9 w-9")}
        >
          <SkipForward className={pip ? "h-4 w-4" : "h-5 w-5"} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
