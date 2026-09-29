"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import type { WidgetSize } from "@/components/ui/widget-size";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Music, Pause, Play } from "lucide-react";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { EQBars, NowPlaying } from "./now-playing";

// ---------------------------------------------------------------------------
// Music Widget — homepage grid card, in two sizes.
//
//   small   the cover: the album art fills the square edge to edge, the
//           label sits on it top-left, and the bottom carries the title and
//           one round play / pause — Apple Music's small widget. There is
//           no room for a transport here, and it does not need one: the
//           card's tap opens the playlist, where everything else lives.
//   medium  the player: art beside the title and artist, with the full
//           transport under them — the shared <NowPlaying /> body the Live
//           Activity also renders.
//
// The YouTube player itself lives in MusicProvider (always mounted) so audio
// survives navigation. This widget is purely a control surface bound to the
// global player state.
// ---------------------------------------------------------------------------

export const MUSIC_WIDGET_SIZES: readonly WidgetSize[] = ["small", "medium"];

export function MusicWidget({ size = "medium" }: { size?: WidgetSize }) {
  const { locale } = useLocale();
  const { track, playerState, openPlaylist, play, pause } = useMusic();

  if (!PLAYLIST_ID) return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";

  // EQ bars visible when actively playing or buffering (stable across transitions)
  const showEQ = !!track && (isPlaying || isLoading);
  const title = t(locale, isPlaying || isLoading ? "widgetMusic" : "widgetMusicIdle");

  if (size === "small") {
    return (
      <WidgetShell onOpen={openPlaylist}>
        {track && (
          <>
            {/* The art is the surface: full bleed, under a scrim that keeps
                the text on it legible whatever the cover is. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- remote cover art, same as NowPlaying */}
            <img
              src={track.thumbnailUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/70"
            />
          </>
        )}
        {/* Everything on the art is drawn in white ink, not the theme's:
            it reads off the cover, which has no theme. */}
        <div className={cn("relative flex h-full flex-col", track && "text-white")}>
          <WidgetHeader className="pb-0">
            <div className="flex items-center gap-2 min-w-0">
              {showEQ && <EQBars className={track ? "text-white" : "text-green-500"} />}
              <WidgetTitle
                className={cn("truncate", track && "text-white/85")}
              >
                {title}
              </WidgetTitle>
            </div>
          </WidgetHeader>

          <WidgetBody fill className="justify-end">
            {track ? (
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className={cn("truncate", TYPE.mediaTitle, "text-white")}>
                    {track.title}
                  </div>
                  {track.artist && (
                    <div className={cn("mt-0.5 truncate", TYPE.meta, "text-white/70")}>
                      {track.artist}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={isPlaying ? pause : play}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/90 text-black shadow-raised transition-transform hover:scale-105 active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="h-3.5 w-3.5" fill="currentColor" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                  )}
                </button>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-3">
                <div className={cn("min-w-0 truncate", TYPE.meta)}>
                  {t(locale, "musicNotPlaying")}
                </div>
                <button
                  type="button"
                  onClick={play}
                  aria-label="Play"
                  className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/40 text-foreground transition-colors hover:bg-muted/60 active:bg-muted/70"
                >
                  {isLoading ? (
                    <Music className="h-3.5 w-3.5 text-quaternary-foreground" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                  )}
                </button>
              </div>
            )}
          </WidgetBody>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell onOpen={openPlaylist}>
      <WidgetHeader className="pb-3">
        <div className="flex items-center gap-2 min-w-0">
          {showEQ && <EQBars className="text-green-500" />}
          <WidgetTitle className="truncate">{title}</WidgetTitle>
        </div>
      </WidgetHeader>

      <WidgetBody fill className="justify-center pb-6">
        <NowPlaying raised={false} />
      </WidgetBody>
    </WidgetShell>
  );
}
