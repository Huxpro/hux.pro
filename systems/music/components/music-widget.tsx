"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { PLAYLIST_ID } from "../lib/settings";
import { t, useLocale } from "@/services";
import { cn } from "@/lib/utils";
import {
  FastForward,
  Music,
  Pause,
  Play,
  Rewind,
} from "lucide-react";
import { useState } from "react";
import { useMusic } from "../provider";

// ---------------------------------------------------------------------------
// EQ Bars — Apple Music style animated "now playing" indicator
// Uses scaleY transform (GPU-accelerated) instead of height animation.
// ---------------------------------------------------------------------------

function EQBars({ className }: { className?: string }) {
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
// Music Widget
// ---------------------------------------------------------------------------

export function MusicWidget() {
  const { locale } = useLocale();
  const [showProgress, setShowProgress] = useState(false);
  const {
    track,
    playerState,
    currentTime,
    duration,
    isEnabled,
    play,
    pause,
    next,
    previous,
    playerContainerRef,
  } = useMusic();

  if (!PLAYLIST_ID) return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const isIdle = playerState === "idle" || playerState === "ended";
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // EQ bars visible when actively playing or buffering (stable across transitions)
  const showEQ = !!track && (isPlaying || isLoading);

  return (
    <WidgetShell>
      <WidgetHeader>
        <div className="flex items-center gap-2 min-w-0">
          {showEQ && <EQBars className="text-green-500" />}
          <WidgetTitle className="truncate">
            {t(locale, isPlaying || isLoading ? "widgetMusic" : "widgetMusicIdle")}
          </WidgetTitle>
        </div>
      </WidgetHeader>

      <WidgetBody>
        {track ? (
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
                <div className="flex items-center gap-1 -ml-2 -mb-2">
                  <button
                    onClick={previous}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 transition-colors active:scale-[0.92]"
                    aria-label="Previous track"
                  >
                    <Rewind className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={isPlaying ? pause : play}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 transition-colors active:scale-[0.92]"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={next}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 transition-colors active:scale-[0.92]"
                    aria-label="Next track"
                  >
                    <FastForward className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : playerState === "error" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground leading-relaxed">
            <Music className="h-4 w-4 shrink-0" />
            <span>{t(locale, "musicNotPlaying")}</span>
          </div>
        ) : isIdle && !isLoading ? (
          <div className="flex gap-3">
            <div className="w-18 h-18 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
              <Music className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <div className="min-w-0 flex-1 flex flex-col justify-between">
              <div className="text-xs font-mono text-muted-foreground">
                {t(locale, "musicNotPlaying")}
              </div>
              <button
                onClick={play}
                className="self-start -ml-2 -mb-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 transition-colors active:scale-[0.92]"
                aria-label="Play"
              >
                <Play className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
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
        )}

        {/* YouTube player container */}
        <div
          ref={playerContainerRef}
          className="h-0 w-0 overflow-hidden"
          aria-hidden
        />
      </WidgetBody>
    </WidgetShell>
  );
}
