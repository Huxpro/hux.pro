"use client";

import { t, useLocale } from "@/services";
import { useEffect, useRef } from "react";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { NowPlaying } from "./now-playing";
import { TrackList } from "./playlist-sheet";

// =============================================================================
// MusicWindow — the Music app, as a window (unified windows)
//
// What the playlist sheet held, plus what the Live Activity holds: the card
// on top, the list under it. One place for music instead of a card in the
// dock and a list in a sheet — a Music.app window, the list breaking into
// columns once the window is dragged wide (TrackList reads the surface
// context, which the window system answers as a window).
//
// The pill floats over the top-left corner, so the card starts below it.
// =============================================================================

export function MusicWindow() {
  const { locale } = useLocale();
  const { playlist, playlistIndex, playAt, playerState } = useMusic();
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Arrive with the track that is playing in view, once — browsing is not
  // yanked back to it afterwards.
  const centred = useRef(false);
  useEffect(() => {
    if (centred.current || playlist.length === 0) return;
    const list = listRef.current;
    const active = activeRef.current;
    if (!list || !active) return;
    centred.current = true;
    list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
  }, [playlist.length, playlistIndex]);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-3 pt-12">
        <NowPlaying raised={false} />
      </div>
      <div className="mx-4 flex shrink-0 items-baseline justify-between border-t border-border/50 pb-1 pt-3">
        <span className="text-xs font-medium text-muted-foreground">
          {t(locale, "musicPlaylist")}
        </span>
        {PLAYLIST_ID && playlist.length > 0 && (
          <span className="font-mono text-[10px] tabular-nums text-tertiary-foreground">
            {playlist.length}
          </span>
        )}
      </div>
      <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <TrackList
          playlist={playlist}
          playlistIndex={playlistIndex}
          playAt={playAt}
          isPlaying={playerState === "playing"}
          isError={playerState === "error"}
          activeRef={activeRef}
        />
      </div>
    </div>
  );
}
