"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { ListMusic, Music } from "lucide-react";
import { useEffect, useRef } from "react";
import {
  ADAPTIVE_PRESENTATION,
  AdaptiveSurface,
  useSurfaceContext,
} from "@/systems/surface";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { EQBars } from "./now-playing";

// ---------------------------------------------------------------------------
// MusicPlaylistSheet — the global playlist browser.
//
// One system-wide surface (mounted once in the root layout) that any trigger
// can summon via `openPlaylist()`: the homepage MusicWidget, the music Live
// Activity, the command palette.
//
// Its shape is delegated to <AdaptiveSurface> (systems/surface): bottom sheet on
// a phone, side panel on a tablet, a draggable centred window on a desktop. This
// file only decides what goes inside it.
//
// The desktop window is sized like a real macOS window rather than a wide
// drawer, and fills it the way Music.app fills one: the track list breaks into
// columns instead of running one long ribbon down the middle of a 980px pane.
// ---------------------------------------------------------------------------

/** A macOS window, not a drawer stretched wide. */
const WINDOW_WIDTH = "min(94vw, 980px)";
const WINDOW_HEIGHT = "min(78vh, 620px)";

export function MusicPlaylistSheet() {
  const { locale } = useLocale();
  const {
    playlist,
    playlistIndex,
    playAt,
    playerState,
    isPlaylistOpen,
    openPlaylist,
    closePlaylist,
  } = useMusic();

  // Center the active track when the sheet opens (not on every track change,
  // so browsing isn't yanked back to "now playing").
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isPlaylistOpen) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const active = activeRef.current;
      if (!list || !active) return;
      list.scrollTop =
        active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [isPlaylistOpen]);

  if (!PLAYLIST_ID) return null;

  const isPlaying = playerState === "playing";
  const isError = playerState === "error";

  return (
    <AdaptiveSurface
      id="surface-playlist"
      // Non-modal: a playlist stays open while the page goes on; nothing about it is a decision.
      modal={false}
      open={isPlaylistOpen}
      onOpenChange={(open) => (open ? openPlaylist() : closePlaylist())}
      presentation={ADAPTIVE_PRESENTATION}
      closeLabel={t(locale, "musicClosePlaylist")}
      windowWidth={WINDOW_WIDTH}
      maxHeight={WINDOW_HEIGHT}
      contentClassName="px-2 pb-3"
      scrollRef={listRef}
      title={
        <span className="flex items-center gap-2">
          {isPlaying && <EQBars className="text-green-500" />}
          <span className="truncate">{t(locale, "musicPlaylist")}</span>
          {playlist.length > 0 && (
            <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/60">
              {playlist.length}
            </span>
          )}
        </span>
      }
      actions={
        <a
          href={`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t(locale, "musicOpenOnYouTube")}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground active:bg-accent/60"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12c0 1.9.2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.9.5-5.8 0-1.9-.2-3.9-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
          </svg>
        </a>
      }
    >
      <TrackList
        playlist={playlist}
        playlistIndex={playlistIndex}
        playAt={playAt}
        isPlaying={isPlaying}
        isError={isError}
        activeRef={activeRef}
      />
    </AdaptiveSurface>
  );
}

/**
 * The track list. One column in a sheet or panel; in a desktop window it breaks
 * into columns like Music.app's "Latest Songs", so a 980px pane reads as a
 * board rather than one thin ribbon down the middle.
 */
function TrackList({
  playlist,
  playlistIndex,
  playAt,
  isPlaying,
  isError,
  activeRef,
}: {
  playlist: ReturnType<typeof useMusic>["playlist"];
  playlistIndex: number;
  playAt: (index: number) => void;
  isPlaying: boolean;
  isError: boolean;
  activeRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const { locale } = useLocale();
  const { isWindow } = useSurfaceContext();

  // Row-major rather than Music.app's column-major: the surface scrolls
  // vertically, and column-major would ask you to read up and back down again.
  const grid = isWindow
    ? "grid grid-cols-1 min-[720px]:grid-cols-2 min-[980px]:grid-cols-3 gap-x-2"
    : "";

  return (
    <div className={grid}>
      {playlist.length === 0 ? (
              isError ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Music className="h-4 w-4 shrink-0" />
                  <span>{t(locale, "musicPlaylistEmpty")}</span>
                </div>
              ) : (
                // Loading skeleton — playlist IDs haven't landed yet.
                <div aria-hidden>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-5" />
                      <span className="size-10 rounded-md bg-muted animate-pulse shrink-0" />
                      <span className="flex-1 space-y-1.5">
                        <span className="block h-3.5 w-3/4 rounded bg-muted animate-pulse" />
                        <span className="block h-2.5 w-1/3 rounded bg-muted animate-pulse" />
                      </span>
                    </div>
                  ))}
                </div>
              )
      ) : (
        playlist.map((entry, i) => {
                const active = i === playlistIndex;
                return (
                  <button
                    key={entry.videoId}
                    ref={active ? activeRef : undefined}
                    onClick={() => playAt(i)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                      active
                        ? "bg-accent/60"
                        : "hover:bg-accent/40 active:bg-accent/60",
                    )}
                  >
                    {/* Position — index number, or EQ bars on the live row */}
                    <span className="w-5 shrink-0 flex justify-center text-[10px] font-mono text-muted-foreground tabular-nums">
                      {active && isPlaying ? (
                        <EQBars className="text-green-500" />
                      ) : (
                        i + 1
                      )}
                    </span>

                    {/* Album art — square, like every other music surface.
                        YouTube serves 16:9; object-cover crops it. */}
                    <span className="relative size-10 rounded-md overflow-hidden bg-muted/40 shrink-0">
                      <span className="absolute inset-0 flex items-center justify-center">
                        <ListMusic className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-sm truncate leading-snug",
                          active
                            ? "text-foreground font-medium"
                            : "text-foreground/90",
                        )}
                      >
                        {entry.title ?? `${t(locale, "musicTrack")} ${i + 1}`}
                      </span>
                      {entry.author && (
                        <span className="block text-xs font-mono text-muted-foreground truncate mt-0.5">
                          {entry.author}
                        </span>
                      )}
                    </span>
                  </button>
                );
        })
      )}
    </div>
  );
}
