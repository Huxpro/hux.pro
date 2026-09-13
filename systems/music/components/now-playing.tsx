"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { GLASS_BTN, GLASS_CLUSTER, GLASS_PILL } from "@/systems/theater/lib/chrome";
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

const TRANSPORT_BTN = cn(GLASS_BTN, "h-7 w-7");

function MusicTransport({
  isPlaying,
  onPrevious,
  onPlayPause,
  onNext,
  onPlaylist,
  playlistLabel,
  idle = false,
}: {
  isPlaying: boolean;
  onPrevious?: () => void;
  onPlayPause: () => void;
  onNext?: () => void;
  onPlaylist: () => void;
  playlistLabel: string;
  idle?: boolean;
}) {
  return (
    <div className={GLASS_CLUSTER}>
      {!idle && (
        <button onClick={onPrevious} aria-label="Previous track" className={TRANSPORT_BTN}>
          <Rewind className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        className={cn(TRANSPORT_BTN, GLASS_PILL, "text-foreground")}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5" fill="currentColor" />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
        )}
      </button>
      {!idle && (
        <button onClick={onNext} aria-label="Next track" className={TRANSPORT_BTN}>
          <FastForward className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={onPlaylist} aria-label={playlistLabel} className={TRANSPORT_BTN}>
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

export function NowPlaying() {
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
      <div className="flex gap-3">
        {/* Album art — mqdefault is 16:9, object-cover crops to square */}
        <div
          className="w-18 h-18 rounded-lg overflow-hidden shrink-0"
          onMouseEnter={() => setShowProgress(true)}
          onMouseLeave={() => setShowProgress(false)}
        >
          <img
            src={track.thumbnailUrl}
            alt={track.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Right: title/artist top-aligned, controls bottom-aligned */}
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div>
            <div className="text-sm text-foreground font-medium truncate leading-snug">
              {track.title}
            </div>
            <div className="text-xs font-mono text-muted-foreground truncate mt-0.5">
              {track.artist}
            </div>
          </div>

          {showProgress && duration > 0 ? (
            <div className="space-y-1">
              <div className="h-0.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground/50 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
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
      <div className="flex gap-3">
        <div className="w-18 h-18 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
          <Music className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <div className="min-w-0 flex-1 flex flex-col justify-between">
          <div className="text-xs font-mono text-muted-foreground">
            {t(locale, "musicNotPlaying")}
          </div>
          <MusicTransport
            isPlaying={false}
            onPlayPause={play}
            onPlaylist={openPlaylist}
            playlistLabel={t(locale, "musicOpenPlaylist")}
            idle
          />
        </div>
      </div>
    );
  }

  // loading skeleton
  return (
    <div className="flex gap-3">
      <div className="w-18 h-18 rounded-lg bg-muted animate-pulse shrink-0" />
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <div>
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted animate-pulse mt-1.5" />
        </div>
        <div className="h-3.5 w-16 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}
