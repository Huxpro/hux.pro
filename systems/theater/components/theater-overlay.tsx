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
  const chromeRootRef = useRef<HTMLDivElement | null>(null);

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
    // This is an intentional session reset when the external theater mode
    // changes; keeping the previous session's visible chrome causes a flash.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChromeVisible(false);
    pinnedRef.current = false;
    clearHideTimer();
    if (open) openedAtRef.current = Date.now();
  }, [open, clearHideTimer]);

  // Return keyboard users to the element that launched the theater.
  useEffect(() => {
    if (!open) return;
    const trigger =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      });
    };
  }, [open]);

  const chromeFocusables = useCallback(() => {
    const root = chromeRootRef.current;
    if (!root) return [];
    const chrome = Array.from(
      root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => !element.hasAttribute("disabled"));
    const stageFrames = Array.from(
      document.querySelectorAll<HTMLIFrameElement>(".theater-stage iframe"),
    ).filter((frame) => !frame.closest(".opacity-0"));
    return [...chrome, ...stageFrames];
  }, []);

  // If focus exits a cross-origin player frame, redirect it back into the
  // theater rather than allowing it to fall through to the obscured page.
  useEffect(() => {
    if (!open || !chromeVisible) return;
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const inChrome = chromeRootRef.current?.contains(target);
      const inStage = document.querySelector(".theater-stage")?.contains(target);
      if (inChrome || inStage) return;
      requestAnimationFrame(() => chromeFocusables()[0]?.focus());
    };
    document.addEventListener("focusin", onFocusIn);
    return () => document.removeEventListener("focusin", onFocusIn);
  }, [open, chromeVisible, chromeFocusables]);

  // Keyboard is an intentional reveal. Trap Tab inside the modal chrome so
  // focus never falls through to the page hidden behind the theater.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") return;

      if (e.key === "Tab") {
        const focusables = chromeFocusables();

        if (!chromeVisible || focusables.length === 0) {
          e.preventDefault();
          pinnedRef.current = true;
          clearHideTimer();
          setChromeVisible(true);
          requestAnimationFrame(() => {
            const next = chromeFocusables();
            (e.shiftKey ? next.at(-1) : next[0])?.focus();
          });
          return;
        }

        const first = focusables[0];
        const active = document.activeElement;
        const current = focusables.indexOf(active as HTMLElement);
        const next = e.shiftKey
          ? (current <= 0 ? focusables.length : current) - 1
          : (current + 1) % focusables.length;
        e.preventDefault();
        (current === -1
          ? e.shiftKey
            ? focusables.at(-1)
            : first
          : focusables[next]
        )?.focus();
        pinnedRef.current = true;
        clearHideTimer();
        return;
      }

      pinnedRef.current = false;
      setChromeVisible(true);
      scheduleHide();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearHideTimer();
    };
  }, [
    open,
    chromeVisible,
    chromeFocusables,
    scheduleHide,
    clearHideTimer,
  ]);

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
          {/* Backdrop — below the stage; click to close.

              The fixed element itself stays transparent: iOS 26 Safari samples
              fixed elements to tint its Liquid Glass status bar and bottom
              toolbar, so a coloured `fixed inset-0` backdrop bleeds into the
              chrome. The glass is painted by the absolute child, which bleeds
              past the top and bottom of the visual viewport so the toolbars
              sample real backdrop rather than the scrim's cut-off edge. */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-[10000]"
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={close}
            onPointerEnter={unpinChrome}
            role="presentation"
          >
            {/* Opacity animates here, not on the fixed parent: an
                opacity-animated ancestor forms a backdrop root and the blur
                would sample nothing but its own empty group. */}
            <motion.div
              aria-hidden
              className="absolute inset-x-0 -top-32 -bottom-32 bg-black/80 backdrop-blur-md"
              variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
              transition={FADE}
            />
          </motion.div>

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
              <div
                ref={chromeRootRef}
                className="contents"
                role="toolbar"
                aria-label="Video theater controls"
                onFocusCapture={pinChrome}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    unpinChrome();
                  }
                }}
              >
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
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}
