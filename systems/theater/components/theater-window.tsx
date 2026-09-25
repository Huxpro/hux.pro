"use client";

import { cn } from "@/lib/utils";
import { useOptionalMusic } from "@/systems/music";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useEffect, useMemo } from "react";
import { embedUrlFor } from "../lib/player";
import type { Track } from "../lib/types";
import { useTheater } from "../provider";
import { AlbumTabs } from "./album-tabs";
import { PlaylistRail } from "./playlist-rail";

// =============================================================================
// TheaterWindow — the theater, as an app window (unified windows)
//
// The stage is a singleton positioned over the page (stage.tsx): it can morph
// between the modal and PiP because it never moves in the DOM, which is also
// why it cannot live *inside* a window — a window has a z-order among others,
// and an element parked above all of them would paint over whichever window
// was in front. So a window is its own player: the track in a frame of its
// own, a window body like any other. Persistence is the window system's
// promise instead of the stage's: minimizing keeps the window mounted, so a
// talk keeps talking from the dock.
//
// What the modal draws around the stage comes along — the albums above, the
// rail below, prev / next — at a window's scale, on a stage's black.
// =============================================================================

/** A round control on the stage's black, in either theme. */
const STAGE_BTN = cn(
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
  "pressable text-white/70 transition-colors",
  "hover:bg-white/10 hover:text-white active:bg-white/15",
  "outline-none focus-visible:bg-white/10 focus-visible:text-white",
  "disabled:pointer-events-none disabled:opacity-30",
);

/** The frame URL for a track, playing: a deck as it is, a video embedded. */
function frameUrl(track: Track): string | null {
  if (track.kind === "slides") return track.url;
  if (track.platform === "youtube" && track.videoId) {
    return `https://www.youtube.com/embed/${track.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  }
  return embedUrlFor(track.url, track.platform);
}

export function TheaterWindow() {
  const { albums, albumIndex, trackIndex, album, track, selectAlbum, next, previous } =
    useTheater();
  const music = useOptionalMusic();
  const src = useMemo(() => (track ? frameUrl(track) : null), [track]);

  // A video and the music never play over each other (the stage's rule too).
  useEffect(() => {
    if (track?.kind === "video") music?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  const hasPrev = albumIndex > 0 || trackIndex > 0;
  const hasNext =
    trackIndex < (album?.tracks.length ?? 0) - 1 || albumIndex < albums.length - 1;

  return (
    <div className="flex h-full flex-col bg-black text-white">
      {/* The albums sit on the pill's row, centred so the pill keeps its corner. */}
      <div className="flex h-12 shrink-0 items-center justify-center px-24">
        {albums.length > 1 && (
          <AlbumTabs
            albums={albums}
            activeIndex={albumIndex}
            onSelect={selectAlbum}
            tone="onDark"
          />
        )}
      </div>

      {/* The largest 16:9 the window has room for. */}
      <div className="relative min-h-0 flex-1 px-3 [container-type:size]">
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-neutral-900"
          style={{
            width: "min(100cqw, 100cqh * 16 / 9)",
            height: "min(100cqh, 100cqw * 9 / 16)",
          }}
        >
          {track && src ? (
            <iframe
              key={track.id}
              src={src}
              title={track.title}
              allow={
                track.kind === "slides"
                  ? "fullscreen; clipboard-write"
                  : "autoplay; fullscreen; picture-in-picture; encrypted-media"
              }
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-white/60">
              {track
                ? track.kind === "slides"
                  ? "Unable to open this deck"
                  : "Unable to play this video"
                : "Nothing on the stage"}
            </div>
          )}
        </div>
      </div>

      {track && (
        <div className="flex shrink-0 items-center gap-2 px-3 pt-3">
          <button
            type="button"
            onClick={previous}
            disabled={!hasPrev}
            aria-label="Previous"
            className={STAGE_BTN}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="truncate text-sm font-medium text-white/90">{track.title}</div>
            {track.subtitle && (
              <div className="truncate font-mono text-[10px] uppercase tracking-wide text-white/50">
                {track.subtitle}
              </div>
            )}
          </div>
          <a
            href={track.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open externally"
            className={STAGE_BTN}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={next}
            disabled={!hasNext}
            aria-label="Next"
            className={STAGE_BTN}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      <PlaylistRail tone="onDark" className="shrink-0 px-3 pb-3 pt-2" />
    </div>
  );
}
