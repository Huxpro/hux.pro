"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
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
// ---------------------------------------------------------------------------

export function MusicWidget() {
  const { locale } = useLocale();
  const { track, playerState, openPlaylist } = useMusic();

  if (!PLAYLIST_ID) return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";

  // EQ bars visible when actively playing or buffering (stable across transitions)
  const showEQ = !!track && (isPlaying || isLoading);

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

      <WidgetBody className="pb-6">
        <NowPlaying raised={false} />
      </WidgetBody>
    </WidgetShell>
  );
}
