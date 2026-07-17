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
import { useRef } from "react";
import { Link } from "next-view-transitions";
import { useTheater } from "../provider";
import { AlbumTabs } from "./album-tabs";
import { PlaylistRail } from "./playlist-rail";

// ---------------------------------------------------------------------------
// TheaterOverlay — the immersive desktop modal chrome.
//
// The video itself is the provider's persistent <Stage />; this draws the
// backdrop, the album switcher + window controls (top), edge track arrows, and
// the playlist rail (bottom), all aligned to the same stage rect so the whole
// thing reads as one "app window" — like opening a system app on iPad.
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
    track,
    rect,
    selectAlbum,
    next,
    previous,
    toPip,
    minimize,
    close,
    trackIndex,
    album,
  } = useTheater();

  const wheelLock = useRef(0);
  const open = mode === "theater" && !minimized;

  const hasPrev = albumIndex > 0 || trackIndex > 0;
  const hasNext =
    trackIndex < (album?.tracks.length ?? 0) - 1 || albumIndex < albums.length - 1;

  const onWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - wheelLock.current < 400) return;
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) < 12) return;
    wheelLock.current = now;
    if (delta > 0) next();
    else previous();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[10000]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-label={track?.title ?? "Video player"}
        >
          {/* Backdrop — click to close; wheel to browse tracks. */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={close}
            onWheel={onWheel}
          />

          {/* Chrome container aligned to the stage rect. pointer-events-none so
              the video (native YouTube controls) stays clickable; children opt
              back in. */}
          <div
            className="pointer-events-none fixed z-[10004]"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          >
            {/* Top gradient bar: album tabs + window controls. */}
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

            {/* Edge track arrows. */}
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
          </div>

          {/* Title + playlist rail beneath the video. */}
          <div
            className="pointer-events-none fixed inset-x-0 z-[10004]"
            style={{ top: rect.top + rect.height + 16 }}
            onWheel={onWheel}
          >
            <div className="mx-auto w-[min(92vw,900px)] px-2">
              {track && (
                <div className="pointer-events-auto mb-2 flex items-baseline justify-between gap-3">
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
              <div className="pointer-events-auto">
                <PlaylistRail />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
