"use client";

import { t, useLocale } from "@/services";
import { LiveActivity } from "@/systems/dock";
import { Music } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { EQBars, NowPlaying } from "./now-playing";

// ---------------------------------------------------------------------------
// Music Activity — the global "now playing" Live Activity.
//
// The homepage already shows the full MusicWidget in its grid, so this activity
// only appears elsewhere. It plugs the music player into the shared Dock: a
// collapsed pill (album art + EQ) that unfolds into the same <NowPlaying /> card
// used by the homepage widget. All the pill/panel/scrim/drag mechanics live in
// <LiveActivity /> — this file only supplies music-specific content.
// ---------------------------------------------------------------------------

export function MusicActivity() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const { track, playerState, isEnabled } = useMusic();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;
  // Homepage renders the widget inline; no playlist / disabled → nothing to dock.
  if (!PLAYLIST_ID || !isEnabled || pathname === "/") return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const showEQ = !!track && (isPlaying || isLoading);

  return (
    <LiveActivity
      id="music"
      openLabel={t(locale, "musicOpenControls")}
      collapseLabel={t(locale, "musicCollapse")}
      pill={
        <>
          {track ? (
            <span className="relative h-6 w-6 rounded-full overflow-hidden shrink-0">
              <img
                src={track.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <span className="h-6 w-6 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
              <Music className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
          {showEQ && <EQBars className="text-green-500" />}
        </>
      }
      title={
        <>
          {showEQ && <EQBars className="text-green-500" />}
          <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">
            {t(locale, isPlaying || isLoading ? "widgetMusic" : "widgetMusicIdle")}
          </span>
        </>
      }
    >
      <div className="px-5 pb-3">
        <NowPlaying />
      </div>
    </LiveActivity>
  );
}
