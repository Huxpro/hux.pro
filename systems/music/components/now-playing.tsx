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

import { TYPE } from "@/lib/typography";
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

// ---------------------------------------------------------------------------
// The transport in the Material skin (`m3:` — inside a home widget only; the
// Live Activity keeps its glass capsule). Android's media controls: no
// capsule around the buttons, icon buttons for the neighbours, and play /
// pause as the one filled button in `primary`. In Material 3 Expressive a
// button's *shape* carries its state: paused, it is round — the thing to
// press; playing, it settles into a rounded square; pressed, it squeezes
// tighter still. The corner rides the Expressive fast-spatial spring, so the
// morph has the platform's small overshoot. The playlist toggle, when on,
// is a tonal `secondary-container` button — Material's selected toggle.
// ---------------------------------------------------------------------------

// `!`: the glass classes these replace carry `dark:` and `hover:` variants
// that would otherwise win the cascade in one theme or on one state.
const M3_CLUSTER = cn(
  "m3:gap-1.5 m3:bg-transparent! m3:border-0! m3:p-0 m3:ring-0! m3:shadow-none! m3:backdrop-blur-none!",
);

const M3_ICON_BTN = cn(
  "m3:size-9 m3:rounded-full m3:text-(--md-on-surface-variant) m3:ring-0 m3:shadow-none",
  "m3:hover:bg-[color-mix(in_srgb,var(--md-on-surface)_8%,transparent)]",
  "m3:active:bg-[color-mix(in_srgb,var(--md-on-surface)_10%,transparent)]",
);

const M3_PLAY_BTN = cn(
  "m3:size-12 m3:rounded-[24px] m3:bg-(--md-primary)! m3:text-(--md-on-primary)!",
  "m3:ring-0! m3:shadow-none! m3:backdrop-blur-none!",
  "m3:hover:bg-[color-mix(in_srgb,var(--md-primary),var(--md-on-primary)_8%)]!",
  "m3:data-playing:rounded-[16px] m3:active:rounded-[12px]",
  "m3:transition-[border-radius,background-color] m3:duration-(--md-spring-fast-spatial-duration) m3:ease-(--md-spring-fast-spatial)",
);

function MusicTransport({
  isPlaying,
  onPrevious,
  onPlayPause,
  onNext,
  onPlaylist,
  playlistLabel,
  playlistOpen = false,
  idle = false,
  raised = true,
}: {
  isPlaying: boolean;
  onPrevious?: () => void;
  onPlayPause: () => void;
  onNext?: () => void;
  onPlaylist: () => void;
  playlistLabel: string;
  /** Lit while the playlist surface is up; the button then closes it again. */
  playlistOpen?: boolean;
  idle?: boolean;
  /** Live Activity keeps the raised cluster; the homepage widget uses a light frame. */
  raised?: boolean;
}) {
  return (
    <div className={cn(raised ? GLASS_CLUSTER : GLASS_CLUSTER_FLAT, M3_CLUSTER)}>
      {!idle && (
        <button type="button" onClick={onPrevious} aria-label="Previous track" className={cn(GLASS_CLUSTER_BTN, M3_ICON_BTN)}>
          <Rewind className="h-3.5 w-3.5 m3:size-[18px]" />
        </button>
      )}
      <button
        type="button"
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
        data-playing={isPlaying ? "" : undefined}
        className={cn(
          GLASS_CLUSTER_BTN,
          "text-foreground",
          raised ? GLASS_PILL : GLASS_PILL_FLAT,
          M3_PLAY_BTN,
        )}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5 m3:size-5" fill="currentColor" />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-px m3:size-5" fill="currentColor" />
        )}
      </button>
      {!idle && (
        <button type="button" onClick={onNext} aria-label="Next track" className={cn(GLASS_CLUSTER_BTN, M3_ICON_BTN)}>
          <FastForward className="h-3.5 w-3.5 m3:size-[18px]" />
        </button>
      )}
      {/* A toggle, and lit while the list is up: the playlist is a place you
          are in or out of, and a button that did nothing when you were already
          in it read as broken. */}
      <button
        type="button"
        onClick={onPlaylist}
        aria-pressed={playlistOpen}
        aria-label={playlistLabel}
        className={cn(
          GLASS_CLUSTER_BTN,
          playlistOpen &&
            cn(raised ? GLASS_PILL : GLASS_PILL_FLAT, "text-foreground"),
          M3_ICON_BTN,
          playlistOpen && "m3:bg-(--md-secondary-container) m3:text-(--md-on-secondary-container)",
        )}
      >
        <ListMusic className="h-3.5 w-3.5 m3:size-[18px]" />
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
  /** Live Activity keeps the raised cluster; the homepage widget uses a light frame. */
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
    isPlaylistOpen,
    openPlaylist,
    closePlaylist,
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
          className="h-20 w-20 overflow-hidden rounded-lg shrink-0 m3:size-[88px] m3:rounded-2xl"
          onMouseEnter={() => setShowProgress(true)}
          onMouseLeave={() => setShowProgress(false)}
        >
          <img
            src={track.thumbnailUrl}
            alt={track.title}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="flex h-20 min-w-0 flex-1 flex-col justify-between m3:h-[88px]">
          <div className="min-w-0">
            <div className={cn("truncate", TYPE.mediaTitle)}>
              {track.title}
            </div>
            {track.artist && (
              <div className={cn("mt-0.5 truncate", TYPE.meta)}>
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
              onPlaylist={isPlaylistOpen ? closePlaylist : openPlaylist}
              playlistLabel={t(
                locale,
                isPlaylistOpen ? "musicClosePlaylist" : "musicOpenPlaylist",
              )}
              playlistOpen={isPlaylistOpen}
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
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-muted/30 m3:size-[88px] m3:rounded-2xl">
          <Music className="h-6 w-6 text-quaternary-foreground" />
        </div>
        <div className="flex h-20 min-w-0 flex-1 flex-col justify-between m3:h-[88px]">
          <div className="text-xs font-mono text-muted-foreground">
            {t(locale, "musicNotPlaying")}
          </div>
          <MusicTransport
            isPlaying={false}
            onPlayPause={play}
            onPlaylist={isPlaylistOpen ? closePlaylist : openPlaylist}
            playlistLabel={t(
              locale,
              isPlaylistOpen ? "musicClosePlaylist" : "musicOpenPlaylist",
            )}
            playlistOpen={isPlaylistOpen}
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
      <div className="h-20 w-20 shrink-0 animate-pulse rounded-lg bg-muted m3:size-[88px] m3:rounded-2xl" />
      <div className="flex h-20 min-w-0 flex-1 flex-col justify-between m3:h-[88px]">
        <div>
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-7 w-28 animate-pulse rounded-full bg-muted/70" />
      </div>
    </div>
  );
}
