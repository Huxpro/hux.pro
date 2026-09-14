"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { PRESS_CARD } from "../lib/chrome";
import { useTheater } from "../provider";
import { TrackThumb } from "./track-thumb";

// ---------------------------------------------------------------------------
// PlaylistRail — the "tracks" strip for the active album. Horizontally
// scrollable (browse every video), with the current track highlighted and
// auto-scrolled into view. Click a card to jump to it — the mini-YouTube
// playlist experience the spec calls for.
// ---------------------------------------------------------------------------

export function PlaylistRail({
  className,
  tone = "default",
}: {
  className?: string;
  /** `onDark` forces light labels (editor mocks / forced-dark stages). */
  tone?: "default" | "onDark";
}) {
  const { album, trackIndex, selectTrack } = useTheater();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const titleColor = tone === "onDark" ? "text-white/90" : "text-foreground/90";
  const subColor = tone === "onDark" ? "text-white/50" : "text-muted-foreground";

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [trackIndex, album?.id]);

  if (!album) return null;

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex gap-3 overflow-x-auto no-scrollbar px-1 py-1",
        className,
      )}
    >
      {album.tracks.map((track, i) => {
        const active = i === trackIndex;
        return (
          <button
            key={track.id}
            ref={active ? activeRef : undefined}
            onClick={() => selectTrack(i)}
            className={cn(
              "group/thumb w-40 shrink-0 text-left outline-none",
              PRESS_CARD,
              "focus-visible:opacity-100 active:opacity-100",
              active ? "opacity-100" : "opacity-70 hover:opacity-100",
            )}
          >
            <TrackThumb track={track} active={active} showBadge={!active} />
            <div className={cn("mt-1.5 truncate text-xs", titleColor)}>
              {track.title}
            </div>
            {track.subtitle && (
              <div
                className={cn(
                  "truncate text-[10px] font-mono uppercase tracking-wide",
                  subColor,
                )}
              >
                {track.subtitle}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
