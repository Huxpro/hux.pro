"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { ListMusic, Music, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { EQBars } from "./now-playing";

// ---------------------------------------------------------------------------
// MusicPlaylistSheet — the global playlist browser.
//
// One system-wide surface (mounted once in the root layout) that any trigger
// can summon via `openPlaylist()`: the homepage MusicWidget, the music Live
// Activity, the command palette. Built on vaul (the drawer under shadcn/ui)
// rather than hand-rolled gesture code.
//
// Presentation adapts to the viewport, but both variants share the floating-
// panel language of the Live Activity (rounded-3xl, translucent card, a ring
// of padding against the screen edges — the recent Apple "floating sheet"
// idiom):
//   • Mobile  — action sheet climbing from the bottom, resting at ~70% of the
//     screen (the iOS action-sheet position). Drag down to dismiss.
//   • Desktop — panel sliding in from the right edge. Drag right to dismiss.
// ---------------------------------------------------------------------------

/** Ring of padding between the floating panel and the screen edges. */
const EDGE_GAP = "0.75rem";

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

  // Bottom sheet on narrow viewports, right-side panel otherwise. Tracked
  // via matchMedia so a resize (or rotation) picks the right edge next open.
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const sync = () => setIsWide(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

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
  const direction = isWide ? "right" : "bottom";

  return (
    <Drawer.Root
      open={isPlaylistOpen}
      onOpenChange={(open) => (open ? openPlaylist() : closePlaylist())}
      direction={direction}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/25 dark:bg-black/45" />
        <Drawer.Content
          aria-describedby={undefined}
          style={
            {
              // vaul's enter/exit transform must clear the edge gap too,
              // otherwise the panel "pops" for the last few pixels.
              "--initial-transform": `calc(100% + ${EDGE_GAP})`,
              // Keep the bottom sheet clear of the home indicator.
              ...(!isWide && {
                bottom: `max(env(safe-area-inset-bottom), ${EDGE_GAP})`,
              }),
            } as React.CSSProperties
          }
          className={cn(
            "fixed z-[61] flex flex-col overflow-hidden outline-none",
            "rounded-3xl bg-card/85 backdrop-blur-xl",
            "border border-border/50 shadow-overlay",
            isWide
              ? // Right-side floating panel — full height minus the gap ring.
                "top-3 bottom-3 right-3 w-[min(92vw,380px)]"
              : // Bottom action sheet — rests at ~70% of the screen.
                "inset-x-3 h-[70dvh]",
          )}
        >
          {/* Grabber — mobile affordance for the drag-to-dismiss gesture */}
          {!isWide && (
            <div className="flex justify-center pt-2">
              <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
            </div>
          )}

          {/* Header — mirrors the Live Activity panel header */}
          <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              {isPlaying && <EQBars className="text-green-500" />}
              <Drawer.Title className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">
                {t(locale, "musicPlaylist")}
              </Drawer.Title>
              {playlist.length > 0 && (
                <span className="text-xs font-mono text-muted-foreground/60 tabular-nums shrink-0">
                  {playlist.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a
                href={`https://www.youtube.com/playlist?list=${PLAYLIST_ID}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t(locale, "musicOpenOnYouTube")}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
                  <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12c0 1.9.2 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1c.3-1.9.5-3.9.5-5.8 0-1.9-.2-3.9-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
                </svg>
              </a>
              <button
                onClick={closePlaylist}
                aria-label={t(locale, "musicClosePlaylist")}
                className="-mr-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 transition-colors active:scale-[0.92]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Track list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto overscroll-contain px-2 pb-3"
          >
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
                      <span className="h-9 w-16 rounded-md bg-muted animate-pulse shrink-0" />
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

                    {/* Thumbnail — 16:9 like YouTube, with icon fallback */}
                    <span className="relative h-9 w-16 rounded-md overflow-hidden bg-muted/40 shrink-0">
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
