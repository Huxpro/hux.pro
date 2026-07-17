"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Minimize2,
  PictureInPicture2,
  X,
} from "lucide-react";
import { Link } from "next-view-transitions";
import { useTheater } from "../provider";
import { AlbumTabs } from "./album-tabs";
import { PlaylistRail } from "./playlist-rail";

// ---------------------------------------------------------------------------
// TheaterOverlay — the immersive desktop modal chrome.
//
// The video itself is the provider's persistent <Stage /> (z-10002). This draws
// the backdrop (z-10000, below the stage) and the chrome (z-10005, above it):
// album switcher + window controls, edge track arrows, and the playlist rail.
// Crucially every chrome layer is a top-level fixed sibling — NOT nested inside
// the backdrop — so its z-index actually sits above the stage rather than being
// trapped in the backdrop's (lower) stacking context.
// ---------------------------------------------------------------------------

const CHROME_BTN = cn(
  "inline-flex h-9 w-9 items-center justify-center rounded-full",
  "bg-black/55 text-white/90 ring-1 ring-white/25 backdrop-blur-sm",
  "transition-colors hover:bg-black/70 hover:text-white active:scale-95",
);

export function TheaterOverlay() {
  const {
    mode,
    minimized,
    albums,
    albumIndex,
    trackIndex,
    album,
    track,
    rect,
    selectAlbum,
    next,
    previous,
    toPip,
    minimize,
    close,
  } = useTheater();

  const open = mode === "theater" && !minimized;

  const hasPrev = albumIndex > 0 || trackIndex > 0;
  const hasNext =
    trackIndex < (album?.tracks.length ?? 0) - 1 || albumIndex < albums.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — below the stage; click to close. */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={close}
            role="presentation"
          />

          {/* Chrome over the video — album tabs + window controls + arrows. */}
          <motion.div
            key="chrome-top"
            className="pointer-events-none fixed z-[10005]"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut", delay: 0.02 }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 rounded-t-xl bg-gradient-to-b from-black/60 to-transparent p-3">
              <div className="pointer-events-auto">
                <AlbumTabs
                  albums={albums}
                  activeIndex={albumIndex}
                  onSelect={selectAlbum}
                />
              </div>
              <div className="pointer-events-auto flex items-center gap-1.5">
                {track?.url && (
                  <a
                    href={track.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open on source site"
                    className={CHROME_BTN}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                <button aria-label="Picture in picture" className={CHROME_BTN} onClick={toPip}>
                  <PictureInPicture2 className="h-4 w-4" />
                </button>
                <button aria-label="Minimize" className={CHROME_BTN} onClick={minimize}>
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button aria-label="Close" className={CHROME_BTN} onClick={close}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <button
              aria-label="Previous video"
              onClick={previous}
              disabled={!hasPrev}
              className={cn(
                CHROME_BTN,
                "pointer-events-auto absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 disabled:opacity-0",
              )}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              aria-label="Next video"
              onClick={next}
              disabled={!hasNext}
              className={cn(
                CHROME_BTN,
                "pointer-events-auto absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 disabled:opacity-0",
              )}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </motion.div>

          {/* Title + playlist rail beneath the video. */}
          <motion.div
            key="chrome-bottom"
            className="fixed inset-x-0 z-[10005]"
            style={{ top: rect.top + rect.height + 16 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut", delay: 0.04 }}
          >
            <div className="mx-auto w-[min(90vw,900px)] px-2">
              {track && (
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">
                      {track.title}
                    </div>
                    {track.subtitle && (
                      <div className="truncate text-xs font-mono uppercase tracking-wide text-white/50">
                        {track.subtitle}
                      </div>
                    )}
                  </div>
                  {track.href && (
                    <Link
                      href={track.href}
                      onClick={close}
                      className="shrink-0 text-xs font-mono uppercase tracking-wide text-white/50 hover:text-white transition-colors"
                    >
                      /works →
                    </Link>
                  )}
                </div>
              )}
              <PlaylistRail />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
