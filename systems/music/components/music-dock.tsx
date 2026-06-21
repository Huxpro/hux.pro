"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Music } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PLAYLIST_ID } from "../lib/settings";
import { useMusic } from "../provider";
import { EQBars, NowPlaying } from "./now-playing";

// ---------------------------------------------------------------------------
// Music Dock — global, collapsible music control for non-home pages.
//
// The homepage already shows the full MusicWidget in its grid, so this dock
// only appears elsewhere. It's collapsed by default (the Dynamic Island Live
// Activity already surfaces "now playing", so we stay understated on mobile)
// and expands — iOS Notification Center style — into a panel with the full
// transport controls. Tap the scrim, the chevron, swipe up, or press Esc to
// collapse. The card body is shared with the homepage via <NowPlaying />.
// ---------------------------------------------------------------------------

const EASE = [0.32, 0.72, 0, 1] as const;

export function MusicDock() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const { track, playerState, isEnabled } = useMusic();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Collapse whenever the route changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Esc collapses the expanded panel.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!mounted) return null;
  // Homepage renders the widget inline; no playlist / disabled → nothing to dock.
  if (!PLAYLIST_ID || !isEnabled || pathname === "/") return null;

  const isPlaying = playerState === "playing";
  const isLoading = playerState === "loading";
  const showEQ = !!track && (isPlaying || isLoading);

  return (
    <>
      {/* Transparent scrim — tap anywhere to collapse (matches command palette) */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <div
        className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pointer-events-none"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        {/* Collapsed pill */}
        <AnimatePresence>
          {!open && (
            <motion.button
              key="pill"
              onClick={() => setOpen(true)}
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: EASE }}
              className={cn(
                "pointer-events-auto flex items-center gap-2",
                "h-9 pl-1.5 pr-2.5 rounded-full",
                "bg-card/60 backdrop-blur-xl border border-border/50",
                "shadow-lg shadow-black/5",
                "hover:bg-card/80 hover:border-border transition-colors",
                "active:scale-95"
              )}
              aria-label={t(locale, "musicOpenControls")}
            >
              {track ? (
                <span className="relative h-6 w-6 rounded-full overflow-hidden shrink-0">
                  <img
                    src={track.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  {showEQ && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <EQBars className="text-white h-1.5" />
                    </span>
                  )}
                </span>
              ) : (
                <span className="h-6 w-6 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
                  <Music className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              )}
              {showEQ && <EQBars className="text-green-500" />}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Expanded panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              key="panel"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.4, bottom: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.y < -40) setOpen(false);
              }}
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={cn(
                "pointer-events-auto w-[min(92vw,360px)] overflow-hidden",
                "rounded-3xl bg-card/70 backdrop-blur-xl",
                "border border-border/50 shadow-2xl shadow-black/20"
              )}
            >
              <div className="flex items-center justify-between px-5 pt-4 pb-3">
                <div className="flex items-center gap-2 min-w-0">
                  {showEQ && <EQBars className="text-green-500" />}
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">
                    {t(
                      locale,
                      isPlaying || isLoading ? "widgetMusic" : "widgetMusicIdle"
                    )}
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="-mr-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 active:bg-accent/60 transition-colors active:scale-[0.92]"
                  aria-label={t(locale, "musicCollapse")}
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 pb-3">
                <NowPlaying />
              </div>

              {/* Grabber — swipe up to collapse */}
              <div className="flex justify-center pb-2">
                <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
