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
// TheaterActivity — Audio view of the video system.
//
// Exclusive with Theater and PiP. The video parks off-screen; only sound
// keeps playing. A Live Activity pill unfolds into transport + a
// SurfaceSwitch whose lifted pill is Audio (current), not an action.
// ---------------------------------------------------------------------------

export function TheaterActivity() {
  const { locale } = useLocale();
  const { close: closeDock } = useDock();
  const { minimized, track, phase, toPip, toTheater, theaterAvailable } =
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
    if (surface === "pip") toPip();
    else toTheater();
  };

  return (
    <LiveActivity
      id="theater"
      openLabel={t(locale, "theaterOpenControls")}
      collapseLabel={t(locale, "musicCollapse")}
      // Square, not the 16:9 the thumbnail wants to be: `lead` has to work in
      // the minimal form too, and a 36px circle has no room for a widescreen
      // crop without it touching the border on both sides.
      lead={
        <span className="relative h-6 w-6 shrink-0 overflow-hidden rounded-[7px]">
          {track.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-muted/60">
              <Video className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
        </span>
      }
      trail={showEQ ? <EQBars className="text-red-500" /> : undefined}
      title={
        <>
          {showEQ && <EQBars className="text-red-500" />}
          <span className="truncate text-xs font-mono uppercase tracking-wider text-muted-foreground">
            {t(locale, "theaterWatching")}
          </span>
        </>
      }
    >
      <div className="space-y-3.5 px-5 pb-4">
        <div className="flex items-start gap-3.5">
          <div className="w-24 shrink-0">
            <TrackThumb track={track} showBadge={false} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium leading-snug text-foreground">
              {track.title}
            </div>
            {track.subtitle && (
              <div className="mt-1 truncate text-xs font-mono uppercase leading-relaxed tracking-wide text-muted-foreground">
                {track.subtitle}
              </div>
            )}
          </div>
        </div>

        <VideoControls />

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
