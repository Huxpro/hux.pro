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
// The video is the provider's persistent <Stage /> (z-10002). Every piece of
// system UI (album switcher, window controls, prev/next arrows, title, playlist
// rail) sits in the MARGINS *around* the video — never on top of it — so the
// player surface stays clean. Each chrome layer is a top-level fixed sibling at
// z-10005 (above the stage), positioned relative to the shared stage rect.
//
// Glass language matches AlbumTabs / Featured Talks (frosted track + pill):
// window controls share one iPadOS-style cluster; gutters are airier so the
// stage reads as the hero rather than a ring of tight circles.
// ---------------------------------------------------------------------------

/** Hit target inside the clustered toolbar (~44pt). */
const CLUSTER_BTN = cn(GLASS_ON_DARK_BTN, "h-10 w-10");

const FADE = { duration: 0.18, ease: "easeOut" as const };

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

          {/* Top bar ABOVE the video: album switcher (left) + clustered
              window controls (right). Extra air vs the old 44/40 hug. */}
          <motion.div
            key="topbar"
            className="fixed z-[10005] flex items-end justify-between gap-4"
            style={{ left: rect.left, width: rect.width, top: rect.top - 56, height: 44 }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={FADE}
          >
            <AlbumTabs
              albums={albums}
              activeIndex={albumIndex}
              onSelect={selectAlbum}
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
              <button aria-label="Picture in picture" className={CLUSTER_BTN} onClick={toPip}>
                <PictureInPicture2 className="h-4 w-4" />
              </button>
              <button aria-label="Minimize" className={CLUSTER_BTN} onClick={minimize}>
                <Minimize2 className="h-4 w-4" />
              </button>
              <button aria-label="Close" className={CLUSTER_BTN} onClick={close}>
                <X className="h-5 w-5" />
              </button>
            </div>
          </motion.div>

          {/* Prev / next — frosted orbs with wider gutters. */}
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
            >
              <ChevronRight className="h-5 w-5" />
            </motion.button>
          )}

          {/* Title + playlist rail BELOW the video — same left/width as the
              stage (and top bar), so adaptive video width never drifts from
              the chrome beneath it. */}
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
            {/* px-0: rail must share the stage edge; thumbs scroll inside. */}
            <PlaylistRail tone="onDark" className="gap-4 px-0" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
