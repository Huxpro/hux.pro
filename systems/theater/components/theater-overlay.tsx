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
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GLASS_ON_DARK_BTN,
  GLASS_ON_DARK_CLUSTER,
  GLASS_ON_DARK_ORB,
} from "../lib/chrome";
import { useTheater } from "../provider";
import { AlbumTabs } from "./album-tabs";
import { PlaylistRail } from "./playlist-rail";

// ---------------------------------------------------------------------------
// TheaterOverlay — the immersive desktop modal chrome.
//
// Default is immersive: chrome hidden. Reveal only on clear intent —
// hovering a margin hit-zone (toolbar / arrows / playlist bands) or a
// keyboard shortcut — never on ambient pointer jitter. Auto-hides quickly
// after the pointer leaves chrome, whether playing or paused.
// ---------------------------------------------------------------------------

/** Hit target inside the clustered toolbar (~44pt). */
const CLUSTER_BTN = cn(GLASS_ON_DARK_BTN, "h-10 w-10");

const FADE = { duration: 0.18, ease: "easeOut" as const };
/** Idle before chrome tucks away once the pointer leaves a chrome zone. */
const HIDE_AFTER_MS = 1100;
/** Ignore edge-hovers right after open so the opening click doesn't flash chrome. */
const OPEN_GRACE_MS = 450;

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

  const midY = rect.top + rect.height / 2;

  const [chromeVisible, setChromeVisible] = useState(false);
  const pinnedRef = useRef(false);
  const openedAtRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (pinnedRef.current) return;
    hideTimerRef.current = setTimeout(() => {
      if (!pinnedRef.current) setChromeVisible(false);
    }, HIDE_AFTER_MS);
  }, [clearHideTimer]);

  // Reset to immersive whenever theater opens.
  useEffect(() => {
    if (!open) {
      setChromeVisible(false);
      pinnedRef.current = false;
      clearHideTimer();
      return;
    }
    setChromeVisible(false);
    pinnedRef.current = false;
    openedAtRef.current = Date.now();
    clearHideTimer();
  }, [open, clearHideTimer]);

  // Keyboard is an intentional reveal (←/→ also useful once chrome is up).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") return;
      pinnedRef.current = false;
      setChromeVisible(true);
      scheduleHide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearHideTimer();
    };
  }, [open, scheduleHide, clearHideTimer]);

  const pinChrome = useCallback(() => {
    // Opening click / cursor still in the margin for a beat — don't flash.
    if (Date.now() - openedAtRef.current < OPEN_GRACE_MS) return;
    pinnedRef.current = true;
    clearHideTimer();
    setChromeVisible(true);
  }, [clearHideTimer]);

  const unpinChrome = useCallback(() => {
    pinnedRef.current = false;
    scheduleHide();
  }, [scheduleHide]);

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
            transition={FADE}
            onClick={close}
            role="presentation"
          />

          {/* Margin hit-zones — the only pointer path to reveal chrome.
              Hovering the video itself (iframe) does not show UI. */}
          <div
            aria-hidden
            className="fixed z-[10004]"
            style={{ left: rect.left, width: rect.width, top: rect.top - 64, height: 64 }}
            onPointerEnter={pinChrome}
            onPointerLeave={unpinChrome}
          />
          <div
            aria-hidden
            className="fixed z-[10004]"
            style={{
              left: rect.left,
              width: rect.width,
              top: rect.top + rect.height,
              height: 200,
            }}
            onPointerEnter={pinChrome}
            onPointerLeave={unpinChrome}
          />
          <div
            aria-hidden
            className="fixed z-[10004]"
            style={{
              left: rect.left - 72,
              width: 72,
              top: rect.top,
              height: rect.height,
            }}
            onPointerEnter={pinChrome}
            onPointerLeave={unpinChrome}
          />
          <div
            aria-hidden
            className="fixed z-[10004]"
            style={{
              left: rect.left + rect.width,
              width: 72,
              top: rect.top,
              height: rect.height,
            }}
            onPointerEnter={pinChrome}
            onPointerLeave={unpinChrome}
          />

          <AnimatePresence>
            {chromeVisible && (
              <>
                <motion.div
                  key="topbar"
                  className="fixed z-[10005] flex items-end justify-between gap-4"
                  style={{
                    left: rect.left,
                    width: rect.width,
                    top: rect.top - 56,
                    height: 44,
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={FADE}
                  onPointerEnter={pinChrome}
                  onPointerLeave={unpinChrome}
                >
                  <AlbumTabs
                    albums={albums}
                    activeIndex={albumIndex}
                    onSelect={selectAlbum}
                    tone="onDark"
                  />
                  <div className={GLASS_ON_DARK_CLUSTER}>
                    {track?.url && (
                      <a
                        href={track.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open on source site"
                        className={CLUSTER_BTN}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      aria-label="Picture in picture"
                      className={CLUSTER_BTN}
                      onClick={toPip}
                    >
                      <PictureInPicture2 className="h-4 w-4" />
                    </button>
                    <button
                      aria-label="Minimize"
                      className={CLUSTER_BTN}
                      onClick={minimize}
                    >
                      <Minimize2 className="h-4 w-4" />
                    </button>
                    <button aria-label="Close" className={CLUSTER_BTN} onClick={close}>
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>

                {hasPrev && (
                  <motion.button
                    key="prev"
                    aria-label="Previous video"
                    onClick={previous}
                    className={cn(GLASS_ON_DARK_ORB, "fixed z-[10005] h-11 w-11")}
                    style={{ top: midY - 22, left: rect.left - 64 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={FADE}
                    onPointerEnter={pinChrome}
                    onPointerLeave={unpinChrome}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </motion.button>
                )}
                {hasNext && (
                  <motion.button
                    key="next"
                    aria-label="Next video"
                    onClick={next}
                    className={cn(GLASS_ON_DARK_ORB, "fixed z-[10005] h-11 w-11")}
                    style={{ top: midY - 22, left: rect.left + rect.width + 20 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={FADE}
                    onPointerEnter={pinChrome}
                    onPointerLeave={unpinChrome}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </motion.button>
                )}

                <motion.div
                  key="bottom"
                  className="fixed z-[10005]"
                  style={{
                    left: rect.left,
                    width: rect.width,
                    top: rect.top + rect.height + 24,
                  }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ ...FADE, delay: 0.03 }}
                  onPointerEnter={pinChrome}
                  onPointerLeave={unpinChrome}
                >
                  {track && (
                    <div className="mb-3 flex items-baseline justify-between gap-3">
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
                  <PlaylistRail tone="onDark" className="gap-4 px-0" />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
