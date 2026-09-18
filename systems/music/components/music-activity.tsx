"use client";

import { t, useLocale } from "@/services";
import { LiveActivity } from "@/systems/dock";
import { Music } from "lucide-react";
import { useEffect, useState } from "react";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { EQBars, NowPlaying } from "./now-playing";

// ---------------------------------------------------------------------------
// Music Activity — the global "now playing" Live Activity.
//
// Plugs the music player into the shared Dock: a collapsed pill (album art +
// EQ) that unfolds into the same <NowPlaying /> card used by the homepage
// widget. Appears only after the user has started playback at least once
// (`hasPlayed`) — including on the homepage alongside MusicWidget — then stays
// for the session (playing, paused, or ended). Cueing the playlist alone does
// not show it. Pill/panel/scrim/drag mechanics live in <LiveActivity />; this
// file only supplies music-specific content.
// ---------------------------------------------------------------------------

export function MusicActivity() {
  const { locale } = useLocale();
  const { track, playerState, isEnabled, hasPlayed } = useMusic();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;
  // No playlist / disabled / never played → nothing to dock.
  if (!PLAYLIST_ID || !isEnabled || !hasPlayed) return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const showEQ = !!track && (isPlaying || isLoading);

  return (
    <LiveActivity
      id="music"
      openLabel={t(locale, "musicOpenControls")}
      collapseLabel={t(locale, "musicCollapse")}
      // Apple's compact split. The art identifies the activity and is all the
      // minimal form gets; the EQ is the live bit and rides the island only.
      lead={
        track ? (
          <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full">
            <img
              src={track.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </span>
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted/60">
            <Music className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        )
      }
      trail={showEQ ? <EQBars className="text-green-500" /> : undefined}
      title={
        <>
          {showEQ && <EQBars className="text-green-500" />}
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">
            {t(locale, isPlaying || isLoading ? "widgetMusic" : "widgetMusicIdle")}
          </span>
        </>
      }
    >
      <div className="px-5 pb-4">
        <NowPlaying />
      </div>
    </LiveActivity>
  );
}
