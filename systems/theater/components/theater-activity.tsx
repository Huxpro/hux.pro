"use client";

import { t, useLocale } from "@/services";
import { LiveActivity, useDock } from "@/systems/dock";
import { EQBars } from "@/systems/music/components/now-playing";
import { Maximize2, PictureInPicture2, Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheater } from "../provider";
import { TrackThumb } from "./track-thumb";
import { VideoControls } from "./video-controls";

// ---------------------------------------------------------------------------
// TheaterActivity — the minimized form of the video system.
//
// When PiP is minimized, the video parks off-screen but keeps playing (audio),
// and this Live Activity takes over: a collapsed pill (cover + EQ) that unfolds
// into transport controls plus "return to PiP / theater" — exactly the Music
// widget's minimize-but-keep-listening behavior, reused for video.
// ---------------------------------------------------------------------------

export function TheaterActivity() {
  const { locale } = useLocale();
  const { close: closeDock } = useDock();
  const { minimized, track, phase, restore, toTheater, isCoarse } = useTheater();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted || !minimized || !track) return null;

  const isPlaying = phase === "playing";
  const isLoading = phase === "loading";
  const showEQ = isPlaying || isLoading;

  const returnToPip = () => {
    closeDock();
    restore();
  };
  const returnToTheater = () => {
    closeDock();
    toTheater();
  };

  return (
    <LiveActivity
      id="theater"
      openLabel={t(locale, "theaterOpenControls")}
      collapseLabel={t(locale, "musicCollapse")}
      pill={
        <>
          <span className="relative h-6 w-9 overflow-hidden rounded-[5px] shrink-0">
            {track.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-muted/60">
                <Video className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            )}
          </span>
          {showEQ && <EQBars className="text-red-500" />}
        </>
      }
      title={
        <>
          {showEQ && <EQBars className="text-red-500" />}
          <span className="truncate text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {t(locale, "theaterWatching")}
          </span>
        </>
      }
    >
      <div className="space-y-3 px-5 pb-3">
        <div className="flex gap-3">
          <button
            onClick={returnToPip}
            className="w-24 shrink-0 group/thumb"
            aria-label={t(locale, "theaterReturnPip")}
          >
            <TrackThumb track={track} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {track.title}
            </div>
            {track.subtitle && (
              <div className="truncate text-xs font-mono uppercase tracking-wide text-muted-foreground mt-0.5">
                {track.subtitle}
              </div>
            )}
          </div>
        </div>

        <VideoControls variant="pip" />

        <div className="flex items-center gap-2">
          <button
            onClick={returnToPip}
            aria-label={t(locale, "theaterReturnPip")}
            className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border/60 bg-card/60 py-2 text-xs font-mono uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            <PictureInPicture2 className="h-3.5 w-3.5 shrink-0" />
            {t(locale, "theaterPip")}
          </button>
          {!isCoarse && (
            <button
              onClick={returnToTheater}
              aria-label={t(locale, "theaterExpand")}
              className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-border/60 bg-card/60 py-2 text-xs font-mono uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
            >
              <Maximize2 className="h-3.5 w-3.5 shrink-0" />
              {t(locale, "theaterExpand")}
            </button>
          )}
        </div>
      </div>
    </LiveActivity>
  );
}
