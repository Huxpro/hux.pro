"use client";

import { cn } from "@/lib/utils";
import { useHostWindow } from "@/systems/windows";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";
import { GLASS_BTN, GLASS_CLUSTER, GLASS_ORB } from "../lib/chrome";
import { useTheater } from "../provider";
import { AlbumTabs } from "./album-tabs";
import { PlaylistRail } from "./playlist-rail";
import { SurfaceSwitch } from "./surface-switch";

// =============================================================================
// TheaterWindow — the theater modal, as a window (unified windows)
//
// The same player, not a second one. The stage is the provider's singleton —
// the element the YouTube player lives in, which is why playback survives
// every change of mode — and a window cannot hold it: moving it into the
// window's DOM would reload the video. So the window keeps a *slot* and hands
// it to the provider (`setWindowSlot`), and the stage stands over the slot at
// the window's own z-index: above this window, below any window in front of
// it (systems/windows/components/window-layer.tsx). Window ⇄ PiP ⇄ the Live
// Activity are then what they always were — the one player moving — and the
// switch that moves it is the modal's switch.
//
// Everything around the stage is the modal's, arranged in a window: the title
// and the cluster (source link, the surface switch) above; the orbs either
// side; the album tabs and the rail below. The close is the window's own.
// =============================================================================

export function TheaterWindow() {
  const host = useHostWindow();
  const {
    albums,
    albumIndex,
    trackIndex,
    album,
    track,
    selectAlbum,
    next,
    previous,
    toPip,
    minimize,
    setWindowSlot,
  } = useTheater();
  const slotRef = useRef<HTMLDivElement>(null);

  // Hold the stage while the window is on the desktop. In the dock (or as a
  // phone's sheet, which never holds it: a phone keeps its PiP) it is let go.
  const holding = !!host && host.shape === "window" && host.win.mode === "normal";
  const zIndex = host?.zIndex ?? 0;
  useEffect(() => {
    const el = slotRef.current;
    if (!holding || !el) return;
    setWindowSlot({ el, zIndex });
    return () => setWindowSlot(null);
  }, [holding, zIndex, setWindowSlot]);

  const hasPrev = albumIndex > 0 || trackIndex > 0;
  const hasNext =
    trackIndex < (album?.tracks.length ?? 0) - 1 || albumIndex < albums.length - 1;

  return (
    <div className="flex h-full flex-col">
      {/* The pill keeps the corner; the title and the cluster share its row. */}
      <div className="flex h-14 shrink-0 items-center gap-4 pl-24 pr-3">
        <div className="min-w-0 flex-1">
          {track && (
            <>
              <div className="truncate text-sm font-medium text-foreground">{track.title}</div>
              {track.subtitle && (
                <div className="mt-0.5 truncate font-mono text-xs uppercase tracking-wide text-muted-foreground">
                  {track.subtitle}
                </div>
              )}
            </>
          )}
        </div>
        <div className={cn(GLASS_CLUSTER, "shrink-0")}>
          {track?.url && (
            <a
              href={track.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open on source site"
              className={cn(GLASS_BTN, "h-8 w-8")}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          <SurfaceSwitch
            current="theater"
            framed={false}
            onSelect={(surface) => {
              if (surface === "pip") toPip();
              if (surface === "mini") minimize();
            }}
          />
        </div>
      </div>

      {/* The stage's slot — the largest 16:9 between the orbs' gutters. */}
      <div className="grid min-h-0 flex-1 grid-cols-[3.5rem_1fr_3.5rem] items-center">
        <div className="flex justify-center">
          {hasPrev && (
            <button
              type="button"
              aria-label="Previous video"
              onClick={previous}
              className={cn(GLASS_ORB, "h-10 w-10")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="relative h-full min-w-0 [container-type:size]">
          <div
            ref={slotRef}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black"
            style={{
              width: "min(100cqw, 100cqh * 16 / 9)",
              height: "min(100cqh, 100cqw * 9 / 16)",
            }}
          />
        </div>
        <div className="flex justify-center">
          {hasNext && (
            <button
              type="button"
              aria-label="Next video"
              onClick={next}
              className={cn(GLASS_ORB, "h-10 w-10")}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div className="system-chrome shrink-0 px-14 pb-4 pt-4">
        {albums.length > 1 && (
          <AlbumTabs
            albums={albums}
            activeIndex={albumIndex}
            onSelect={selectAlbum}
            className="mb-3"
          />
        )}
        <PlaylistRail className="gap-4 px-0" />
      </div>
    </div>
  );
}
