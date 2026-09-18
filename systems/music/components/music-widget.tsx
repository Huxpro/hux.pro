"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { sizeSpec } from "@/components/ui/widget-grid";
import { useWidgetSize } from "@/components/ui/widget-size";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { PLAYLIST_ID } from "../lib/settings";
import { t, useLocale } from "@/services";
import { useMusic } from "../provider";
import { EQBars, NowPlaying } from "./now-playing";

// ---------------------------------------------------------------------------
// Music Widget — homepage grid card.
//
// The YouTube player itself lives in MusicProvider (always mounted) so audio
// survives navigation. This widget is purely a control surface bound to the
// global player state.
//
// Footprints: one cell is now playing — art, title, transport. Two cells
// wide adds what comes next: the following entries of the playlist, each a
// tap away, so the wide widget is a glimpse of the queue rather than a
// larger cover. No height: a taller "now playing" is the playlist sheet's
// job, and the surface already opens it.
// ---------------------------------------------------------------------------

export const MUSIC_WIDGET_SIZE = sizeSpec([1, 1], [2, 1], [1, 1]);

/** Upcoming entries the wide footprint lists. */
const UP_NEXT = 3;

export function MusicWidget() {
  const { locale } = useLocale();
  const { w } = useWidgetSize(MUSIC_WIDGET_SIZE.default);
  const { track, playerState, openPlaylist, playlist, playlistIndex, playAt } =
    useMusic();

  if (!PLAYLIST_ID) return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";

  // EQ bars visible when actively playing or buffering (stable across transitions)
  const showEQ = !!track && (isPlaying || isLoading);

  // The next few playlist entries after the current one, wrapping around.
  const upNext =
    w >= 2 && playlist.length > 1
      ? Array.from(
          { length: Math.min(UP_NEXT, playlist.length - 1) },
          (_, k) => (Math.max(playlistIndex, 0) + 1 + k) % playlist.length,
        )
      : [];

  return (
    <WidgetShell onOpen={openPlaylist}>
      <WidgetHeader className="pb-3">
        <div className="flex items-center gap-2 min-w-0">
          {showEQ && <EQBars className="text-green-500" />}
          <WidgetTitle className="truncate">
            {t(locale, isPlaying || isLoading ? "widgetMusic" : "widgetMusicIdle")}
          </WidgetTitle>
        </div>
      </WidgetHeader>

      <WidgetBody
        className={cn(w >= 2 ? "grid grid-cols-2 gap-x-6 pb-5" : "pb-6")}
      >
        <div className="min-w-0">
          <NowPlaying raised={false} />
        </div>
        {w >= 2 && (
          <div className="min-w-0">
            <span
              className={cn(
                "block text-xs text-tertiary-foreground",
                locale === "zh" ? "font-mono" : "italic font-serif",
              )}
            >
              {t(locale, "widgetUpNext")}
            </span>
            {upNext.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {upNext.map((i) => {
                  const entry = playlist[i];
                  return (
                    <li key={entry.videoId}>
                      <button
                        type="button"
                        onClick={() => playAt(i)}
                        className={cn(
                          "pressable -mx-2 flex w-[calc(100%+1rem)] items-center gap-2.5 rounded-md px-2 py-px text-left",
                          "transition-colors duration-150 hover:bg-muted/20 active:bg-muted/35",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN art, as NowPlaying */}
                        <img
                          src={entry.thumbnailUrl}
                          alt=""
                          className="h-6 w-6 shrink-0 rounded object-cover"
                        />
                        <span className={cn("min-w-0 flex-1 truncate", TYPE.rowTitle)}>
                          {entry.title ?? `${t(locale, "musicTrack")} ${i + 1}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className={cn("mt-1", TYPE.meta)}>
                {t(locale, "musicPlaylistEmpty")}
              </div>
            )}
          </div>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}
