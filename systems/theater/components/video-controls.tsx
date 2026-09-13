"use client";

import { cn } from "@/lib/utils";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { GLASS_BTN, GLASS_CLUSTER, GLASS_PILL } from "../lib/chrome";
import { formatTime } from "../lib/player";
import { useTheater } from "../provider";

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
    albums,
    albumIndex,
    trackIndex,
    album,
    togglePlay,
    next,
    previous,
    seek,
  } = useTheater();

  const isYouTube = track?.platform === "youtube" && !!track.videoId;
  const isPlaying = phase === "playing";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const hasPrev = albumIndex > 0 || trackIndex > 0;
  const hasNext =
    trackIndex < (album?.tracks.length ?? 0) - 1 || albumIndex < albums.length - 1;

  const pip = variant === "pip";
  const iconBtn = cn(GLASS_BTN, pip ? "h-8 w-8" : "h-9 w-9");

  const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isYouTube || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(Math.min(Math.max(ratio, 0), 1) * duration);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {isYouTube && (
        <div className={cn("flex items-center gap-2", pip ? "px-0.5" : "px-0")}>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground w-9 text-right">
            {formatTime(currentTime)}
          </span>
          <div
            onClick={onScrub}
            className="group/scrub relative h-2 flex-1 cursor-pointer"
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

      <div className={cn("flex items-center justify-center", pip && "px-0.5")}>
        <div className={GLASS_CLUSTER}>
          <button
            onClick={previous}
            disabled={!hasPrev}
            aria-label="Previous video"
            className={iconBtn}
          >
            <SkipBack className={pip ? "h-4 w-4" : "h-5 w-5"} fill="currentColor" />
          </button>

          {isYouTube ? (
            <button
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className={cn(iconBtn, GLASS_PILL, "text-foreground", !pip && "h-10 w-10")}
            >
              {isPlaying ? (
                <Pause className={pip ? "h-4 w-4" : "h-5 w-5"} fill="currentColor" />
              ) : (
                <Play className={cn("translate-x-px", pip ? "h-4 w-4" : "h-5 w-5")} fill="currentColor" />
              )}
            </button>
          ) : (
            <span className="px-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {track?.platform}
            </span>
          )}

          <button
            onClick={next}
            disabled={!hasNext}
            aria-label="Next video"
            className={iconBtn}
          >
            <SkipForward className={pip ? "h-4 w-4" : "h-5 w-5"} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
