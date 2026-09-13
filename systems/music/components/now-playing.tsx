"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  GLASS_CLUSTER,
  GLASS_CLUSTER_BTN,
  GLASS_CLUSTER_FLAT,
  GLASS_PILL,
  GLASS_PILL_FLAT,
} from "@/systems/theater/lib/chrome";
import { FastForward, ListMusic, Music, Pause, Play, Rewind } from "lucide-react";
import { useState } from "react";
import { useMusic } from "../provider";

// ---------------------------------------------------------------------------
// EQ Bars — Apple Music style animated "now playing" indicator
// Uses scaleY transform (GPU-accelerated) instead of height animation.
// ---------------------------------------------------------------------------

export function EQBars({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-end gap-px h-2", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[2px] h-full rounded-full bg-current origin-bottom"
          style={{
            animation: "eq-bar 1.2s ease-in-out infinite alternate",
            animationDelay: `${-i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function MusicTransport({
  isPlaying,
  onPrevious,
  onPlayPause,
  onNext,
  onPlaylist,
  playlistLabel,
  idle = false,
  raised = true,
}: {
  isPlaying: boolean;
  onPrevious?: () => void;
  onPlayPause: () => void;
  onNext?: () => void;
  onPlaylist: () => void;
  playlistLabel: string;
  idle?: boolean;
  /** Live Activity keeps the framed cluster; the homepage widget stays flat until hover. */
  raised?: boolean;
}) {
  return (
    <div className={raised ? GLASS_CLUSTER : GLASS_CLUSTER_FLAT}>
      {!idle && (
        <button onClick={onPrevious} aria-label="Previous track" className={GLASS_CLUSTER_BTN}>
          <Rewind className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={cn(
          GLASS_CLUSTER_BTN,
          "text-foreground",
          raised ? GLASS_PILL : GLASS_PILL_FLAT,
        )}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" fill="currentColor" />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
        )}
      </button>
      {!idle && (
        <button onClick={onNext} aria-label="Next track" className={GLASS_CLUSTER_BTN}>
          <FastForward className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={onPlaylist} aria-label={playlistLabel} className={GLASS_CLUSTER_BTN}>
        <ListMusic className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NowPlaying — the shared "now playing" card body.
//
// Pure presentational surface bound to the global MusicProvider. Reused by
// both the homepage MusicWidget and the global MusicDock so controls and
// states stay identical everywhere.
// ---------------------------------------------------------------------------

export function NowPlaying({
  raised = true,
}: {
  /** Live Activity keeps the framed cluster; the homepage widget stays flat until hover. */
  raised?: boolean;
}) {
  const { locale } = useLocale();
  const [showProgress, setShowProgress] = useState(false);
  const {
    track,
    playerState,
    currentTime,
    duration,
    play,
    pause,
    next,
    previous,
    openPlaylist,
  } = useMusic();

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const isIdle = playerState === "idle" || playerState === "ended";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (track) {
    return (
      <div className="flex items-start gap-3.5">
        {/* Album art — mqdefault is 16:9, object-cover crops to square */}
        <div
          className="h-22 w-22 overflow-hidden rounded-lg shrink-0"
          onMouseEnter={() => setShowProgress(true)}
          onMouseLeave={() => setShowProgress(false)}
        >
          <img
            src={track.thumbnailUrl}
            alt={track.title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex h-22 min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium leading-snug text-foreground">
              {track.title}
            </div>
            {track.artist && (
              <div className="mt-1 truncate text-xs font-mono text-muted-foreground">
                {track.artist}
              </div>
            )}
          </div>

          {showProgress && duration > 0 ? (
            <div className="space-y-1">
              <div className="h-0.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/50 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
              </div>
            </div>
          ) : (
            <MusicTransport
              isPlaying={isPlaying}
              onPrevious={previous}
              onPlayPause={isPlaying ? pause : play}
              onNext={next}
              onPlaylist={openPlaylist}
              playlistLabel={t(locale, "musicOpenPlaylist")}
              raised={raised}
            />
          )}
        </div>
      </div>
    );
  }

  if (playerState === "error") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground leading-relaxed">
        <Music className="h-4 w-4 shrink-0" />
        <span>{t(locale, "musicNotPlaying")}</span>
      </div>
    );
  }

  if (isIdle && !isLoading) {
    return (
      <div className="flex items-start gap-3.5">
        <div className="flex h-22 w-22 shrink-0 items-center justify-center rounded-lg bg-muted/30">
          <Music className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <div className="flex h-22 min-w-0 flex-1 flex-col justify-between py-0.5">
          <div className="text-xs font-mono text-muted-foreground">
            {t(locale, "musicNotPlaying")}
          </div>
          <MusicTransport
            isPlaying={false}
            onPlayPause={play}
            onPlaylist={openPlaylist}
            playlistLabel={t(locale, "musicOpenPlaylist")}
            idle
            raised={raised}
          />
        </div>
      </div>
    );
  }

  // loading skeleton
  return (
    <div className="flex items-start gap-3.5">
      <div className="h-22 w-22 shrink-0 animate-pulse rounded-lg bg-muted" />
      <div className="flex h-22 min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-7 w-28 animate-pulse rounded-full bg-muted/70" />
      </div>
    </div>
  );
}
