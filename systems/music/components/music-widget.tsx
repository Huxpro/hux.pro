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
  Loader2,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useMusic } from "../provider";

export function MusicWidget() {
  const { locale } = useLocale();
  const {
    track,
    playerState,
    isEnabled,
    play,
    pause,
    next,
    previous,
    playerContainerRef,
  } = useMusic();

  if (!isEnabled || !PLAYLIST_ID) return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const isIdle = playerState === "idle" || playerState === "ended";

  return (
    <WidgetShell>
      <WidgetHeader>
        <div className="flex items-center gap-1.5 min-w-0">
          <WidgetTitle className="truncate">
            {t(locale, "widgetMusic")}
          </WidgetTitle>
          {isLoading && (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>
        {track && (
          <div className="flex items-center gap-1">
            {isPlaying ? (
              <Play className="h-3 w-3 shrink-0 text-green-500 fill-green-500" />
            ) : (
              <Pause className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
          </div>
        )}
      </WidgetHeader>

      <WidgetBody>
        {track ? (
          <div className="space-y-3">
            {/* Track info row */}
            <div className="flex items-start gap-3">
              {/* Thumbnail */}
              <img
                src={track.thumbnailUrl}
                alt={track.title}
                className="h-12 w-12 rounded-lg object-cover shrink-0"
              />

              {/* Track metadata */}
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground truncate leading-snug">
                  {track.title}
                </div>
                <div className="text-xs font-mono text-muted-foreground truncate mt-0.5">
                  {track.artist}
                </div>
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={previous}
                className="text-muted-foreground hover:text-foreground transition-colors active:scale-[0.95]"
                aria-label="Previous track"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                onClick={isPlaying ? pause : play}
                className={cn(
                  "rounded-full p-2 transition-colors active:scale-[0.95]",
                  isPlaying
                    ? "bg-foreground text-background hover:bg-foreground/90"
                    : "bg-muted hover:bg-accent text-foreground",
                )}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 ml-0.5" />
                )}
              </button>
              <button
                onClick={next}
                className="text-muted-foreground hover:text-foreground transition-colors active:scale-[0.95]"
                aria-label="Next track"
              >
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : playerState === "error" ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground leading-relaxed">
            <Music className="h-4 w-4 shrink-0" />
            <span>{t(locale, "musicNotPlaying")}</span>
          </div>
        ) : isIdle && !isLoading ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground leading-relaxed">
              <Music className="h-4 w-4 shrink-0" />
              <span>{t(locale, "musicNotPlaying")}</span>
            </div>
            {/* Show play button even in idle so user can start */}
            <div className="flex items-center justify-center">
              <button
                onClick={play}
                className="rounded-full p-2 bg-muted hover:bg-accent text-foreground transition-colors active:scale-[0.95]"
                aria-label="Play"
              >
                <Play className="h-4 w-4 ml-0.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* YouTube player container — the IFrame API creates the iframe here */}
        <div
          ref={playerContainerRef}
          className="h-0 w-0 overflow-hidden"
          aria-hidden
        />
      </WidgetBody>
    </WidgetShell>
  );
}
