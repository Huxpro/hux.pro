"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { EQBars } from "@/systems/music/components/now-playing";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Minimize2, PictureInPicture2, SquareArrowOutUpRight, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { GLASS_BTN } from "../lib/chrome";
import {
  SIDECAR_HEADER,
  SIDECAR_PAD,
  sidecarBox,
  sidecarRect,
} from "../lib/geometry";
import { useTheater } from "../provider";
import { AlbumTabs } from "./album-tabs";
import { TrackThumb } from "./track-thumb";
import { VideoControls } from "./video-controls";

// ---------------------------------------------------------------------------
// TheaterSidecar: the player docked into a column at the right edge.
//
// On a wide desk a floating tile is always over something, and always has to
// be moved off the next thing. Docked, the player is a place beside the page
// instead: the video at the top, what is playing and its transport under it,
// and the album's queue taking the rest of the column. The page moves over
// for it (`--sidecar-room`, set by the provider and read by globals.css), so
// nothing on the page is ever under it.
//
// It sits between the theater (which takes the screen) and the tile (which
// takes a corner): for watching an album through while the page stays
// usable. The header floats it back into a tile, minimizes it into the dock,
// or closes it. Narrow the window past its room and it floats by itself.
//
// The video is the shared <Stage />, drawn over the space this column leaves
// for it at the same rect (`sidecarRect`).
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

export function TheaterSidecar() {
  const { locale } = useLocale();
  const {
    mode,
    minimized,
    sidecarAvailable,
    viewport,
    track,
    phase,
    albums,
    album,
    albumIndex,
    trackIndex,
    selectAlbum,
    selectTrack,
    toPip,
    minimize,
    close,
    nativeWindowAvailable,
    popOut,
  } = useTheater();
  const reduceMotion = useReducedMotion();

  const open = mode === "sidecar" && sidecarAvailable && !minimized;
  const box = sidecarBox(viewport);
  const video = sidecarRect(viewport);
  const isPlaying = phase === "playing";
  const deck = track?.kind === "slides";
  const tracks = album?.tracks ?? [];

  // Bring the playing track into view when the column opens, and when the
  // album changes under it; not on every track change, so browsing ahead
  // isn't yanked back to "now playing".
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      const active = activeRef.current;
      if (!list || !active) return;
      list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, albumIndex]);

  const floatLabel = t(locale, "theaterFloat");
  const minimizeLabel = t(
    locale,
    deck ? "theaterSurfaceMinimizeHint" : "theaterSurfaceMiniHint",
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          key="sidecar"
          aria-label={t(locale, "theaterSidecar")}
          className={cn(
            "system-chrome fixed z-[10001] flex flex-col overflow-hidden",
            "rounded-2xl border border-border/50 bg-glass shadow-overlay backdrop-blur-xl",
          )}
          style={box}
          initial={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduceMotion ? 0 : 24 }}
          transition={{ duration: reduceMotion ? 0 : 0.34, ease: EASE }}
        >
          <div
            className="flex shrink-0 items-center gap-1"
            style={{
              height: SIDECAR_PAD + SIDECAR_HEADER,
              padding: `${SIDECAR_PAD}px ${SIDECAR_PAD}px 0`,
            }}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 pl-1">
              {isPlaying && <EQBars className="shrink-0 text-red-500" />}
              <span className="truncate font-mono text-xs text-muted-foreground">
                {t(locale, "theaterSidecar")}
              </span>
            </span>
            <button
              type="button"
              onClick={toPip}
              aria-label={floatLabel}
              title={floatLabel}
              className={cn(GLASS_BTN, "h-8 w-8")}
            >
              <PictureInPicture2 className="h-4 w-4" />
            </button>
            {nativeWindowAvailable && (
              <button
                type="button"
                onClick={popOut}
                aria-label={t(locale, "theaterPopOut")}
                title={t(locale, "theaterPopOut")}
                className={cn(GLASS_BTN, "h-8 w-8")}
              >
                <SquareArrowOutUpRight className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={minimize}
              aria-label={minimizeLabel}
              title={minimizeLabel}
              className={cn(GLASS_BTN, "h-8 w-8")}
            >
              <Minimize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={close}
              aria-label={t(locale, "theaterClose")}
              title={t(locale, "theaterClose")}
              className={cn(GLASS_BTN, "h-8 w-8")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* The stage is drawn over this, at `sidecarRect`. */}
          <div
            aria-hidden
            className="shrink-0"
            style={{ height: video.height + SIDECAR_PAD }}
          />

          <div className="shrink-0 px-3 pb-2">
            <div className="truncate text-sm font-medium leading-snug text-foreground">
              {track?.title}
            </div>
            {track?.subtitle && (
              <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                {track.subtitle}
              </div>
            )}
          </div>

          <VideoControls playlist={false} className="shrink-0 px-3 pb-3" />

          {albums.length > 1 && (
            <div className="flex shrink-0 overflow-x-auto no-scrollbar px-3 pb-2">
              <AlbumTabs
                albums={albums}
                activeIndex={albumIndex}
                onSelect={selectAlbum}
                raised={false}
                className="shrink-0"
              />
            </div>
          )}

          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5"
          >
            {tracks.map((item, i) => {
              const active = i === trackIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  ref={active ? activeRef : undefined}
                  onClick={() => selectTrack(i)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "group/thumb pressable flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left transition-colors",
                    active ? "bg-accent/60" : "hover:bg-accent/40 active:bg-accent/60",
                  )}
                >
                  <span className="w-20 shrink-0">
                    <TrackThumb track={item} active={active} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[13px] leading-snug",
                        active ? "font-medium text-foreground" : "text-foreground/90",
                      )}
                    >
                      {active && isPlaying && <EQBars className="shrink-0 text-red-500" />}
                      <span className="line-clamp-2">{item.title}</span>
                    </span>
                    {item.subtitle && (
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                        {item.subtitle}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
