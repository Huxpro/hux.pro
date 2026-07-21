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
import { useEffect, useRef } from "react";
import { useTheater } from "../provider";
import { AlbumTabs } from "./album-tabs";
import { PlaylistRail } from "./playlist-rail";

// ---------------------------------------------------------------------------
// TheaterOverlay — the immersive desktop modal chrome.
//
// The video is the provider's persistent <Stage /> (z-10002). Every piece of
// system UI (album switcher, window controls, prev/next arrows, title, playlist
// rail) sits in the MARGINS *around* the video — never on top of it — so the
// player surface stays clean. Each chrome layer is a top-level fixed sibling at
// z-10005 (above the stage), positioned relative to the shared stage rect.
// ---------------------------------------------------------------------------

// The theater backdrop is always dark, so its window controls use the shared
// on-media control recipe — dark disc + hairline white ring — matching the
// PlayBadge covers that open the player and the sibling slide modal, instead of
// theme-aware card chrome that would flip to light discs in light mode.
const CHROME_BTN = cn(
  "inline-flex h-9 w-9 items-center justify-center rounded-full",
  "bg-black/55 text-white/90 ring-1 ring-white/25 backdrop-blur-sm",
  "transition-colors hover:bg-black/70 hover:text-white active:scale-95",
);

const FADE = { duration: 0.18, ease: "easeOut" as const };

export function TheaterOverlay() {
  const {
    mode,
    minimized,
    albums,
    albumIndex,
    track,
    rect,
    hasPrev,
    hasNext,
    selectAlbum,
    next,
    previous,
    toPip,
    minimize,
    close,
  } = useTheater();

  const open = mode === "theater" && !minimized;

  const midY = rect.top + rect.height / 2;

  // Focus management: move focus into the modal when it opens (the close
  // button) and restore it to the trigger when it closes, so keyboard / screen
  // reader users aren't stranded on the now-hidden page behind the backdrop.
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    // Wait for the enter animation's first frame so the target is focusable.
    const id = requestAnimationFrame(() => closeRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      returnFocusRef.current?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — below the stage; click to close. Carries the modal
              semantics: the chrome pieces are fixed siblings, so this scrim is
              the single element that represents the theater surface. */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={FADE}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="Video theater"
          />

          {/* Top bar ABOVE the video: album switcher (left) + window controls
              (right), spanning the video's width. */}
          <motion.div
            key="topbar"
            className="fixed z-[10005] flex items-end justify-between gap-2"
            style={{ left: rect.left, width: rect.width, top: rect.top - 44, height: 40 }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={FADE}
          >
            <AlbumTabs
              albums={albums}
              activeIndex={albumIndex}
              onSelect={selectAlbum}
              tone="onDark"
            />
            <div className="flex items-center gap-2">
              {track?.url && (
                <a
                  href={track.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open on source site"
                  className={cn(CHROME_BTN, "mr-1")}
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
              <button
                ref={closeRef}
                aria-label="Close"
                className={CHROME_BTN}
                onClick={close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </motion.div>

          {/* Prev / next arrows in the side gutters, BESIDE the video. */}
          {hasPrev && (
            <motion.button
              key="prev"
              aria-label="Previous video"
              onClick={previous}
              className={cn(CHROME_BTN, "fixed z-[10005] h-11 w-11")}
              style={{ top: midY - 22, left: rect.left - 52 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE}
            >
              <ChevronLeft className="h-6 w-6" />
            </motion.button>
          )}
          {hasNext && (
            <motion.button
              key="next"
              aria-label="Next video"
              onClick={next}
              className={cn(CHROME_BTN, "fixed z-[10005] h-11 w-11")}
              style={{ top: midY - 22, left: rect.left + rect.width + 8 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={FADE}
            >
              <ChevronRight className="h-6 w-6" />
            </motion.button>
          )}

          {/* Title + playlist rail BELOW the video. */}
          <motion.div
            key="bottom"
            className="fixed inset-x-0 z-[10005]"
            style={{ top: rect.top + rect.height + 16 }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ ...FADE, delay: 0.03 }}
          >
            <div
              className="mx-auto px-2"
              style={{ width: Math.min(rect.width + 96, 960) }}
            >
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
              <PlaylistRail tone="onDark" />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
