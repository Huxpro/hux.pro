"use client";

import { t, useLocale } from "@/services";
import { LiveActivity, useDock } from "@/systems/dock";
import { EQBars } from "@/systems/music/components/now-playing";
import { Video } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheater } from "../provider";
import { SurfaceSwitch } from "./surface-switch";
import { TrackThumb } from "./track-thumb";
import { VideoControls } from "./video-controls";

// ---------------------------------------------------------------------------
// TheaterActivity — Mini view of the video system.
//
// Exclusive with Theater and PiP. The video parks off-screen but keeps
// playing (audio). A Live Activity pill unfolds into transport + a
// SurfaceSwitch whose lifted pill is Mini (current), not an action.
// ---------------------------------------------------------------------------

export function TheaterActivity() {
  const { locale } = useLocale();
  const { close: closeDock } = useDock();
  const { minimized, track, phase, restore, toTheater, theaterAvailable } =
    useTheater();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted || !minimized || !track) return null;

  const isPlaying = phase === "playing";
  const isLoading = phase === "loading";
  const showEQ = isPlaying || isLoading;

  const go = (surface: "theater" | "pip") => {
    closeDock();
    if (surface === "pip") restore();
    else toTheater();
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
          <div className="w-24 shrink-0">
            <TrackThumb track={track} showBadge={false} />
          </div>
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

        <SurfaceSwitch
          current="mini"
          theaterAvailable={theaterAvailable}
          labels
          onSelect={(surface) => {
            if (surface === "pip") go("pip");
            if (surface === "theater") go("theater");
          }}
        />
      </div>
    </LiveActivity>
  );
}
