"use client";

/**
 * SlideModal
 *
 * Full-viewport lightbox that plays an HTML slide deck (reveal.js / Yanshuo)
 * inside a centered iframe. Sized to ~80% of the viewport on sm+ so the deck
 * reads big without leaving the site; on phones it takes over as a theater
 * mode (edge-to-edge), matching the video modal.
 *
 * Dismissal: backdrop click, the close button, or Escape. Body scroll is
 * locked while open. Portalled so the overlay escapes any transformed /
 * overflow-clipped ancestor in the timeline.
 */

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { holdScrollGestures } from "@/lib/overlay-scroll";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * On-media control recipe — the same dark disc + hairline white ring as
 * PlayBadge, so the player's chrome reads as one system with the covers that
 * open it. `h-10` sizes both the round close button and the pill.
 */
const CHROME_BTN = cn(
  "inline-flex h-10 items-center rounded-full",
  "bg-black/55 text-white/90 ring-1 ring-white/25 backdrop-blur-sm",
  "transition-colors hover:bg-black/70 hover:text-white",
);

export interface SlideModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Close handler (backdrop / Escape / close button). */
  onClose: () => void;
  /** Playable deck URL (direct reveal.js page, not a wrapping blog post). */
  src: string;
  /** Accessible iframe title. */
  title: string;
}

export function SlideModal({ open, onClose, src, title }: SlideModalProps) {
  // Portals need the DOM: false during SSR / first hydration snapshot, true
  // once running on the client. useSyncExternalStore avoids a setState-in-effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);

    // Hold the page still by cancelling gestures, not by locking the body:
    // an unscrollable document is what leaves iOS 26 Safari's toolbars with
    // nothing to composite (see lib/overlay-scroll.ts).
    const releaseGestures = holdScrollGestures();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      releaseGestures();
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        // z above the draggable command FAB (z 9999) so theater mode owns
        // the screen and nothing floats over the deck.
        <motion.div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop. Mobile theater = opaque black; sm+ = dimmed blur. It
              bleeds past the visual viewport so iOS 26 Safari's toolbars
              sample real pixels instead of the page behind. */}
          <div className="overlay-bleed bg-black sm:bg-black/80 sm:backdrop-blur-md" />

          {/* Chrome — close + optional fullscreen escape hatch. Shares the
              on-media control recipe with PlayBadge (dark disc, hairline
              white ring) so covers and the player read as one system. */}
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Open slides fullscreen"
              className={cn(CHROME_BTN, "gap-1.5 px-3")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden font-mono text-[11px] uppercase tracking-wider sm:inline">
                Fullscreen
              </span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close slides"
              className={cn(CHROME_BTN, "w-10 justify-center")}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Player: largest 16:9 box that fits the allotted screen.
              - Mobile (theater): min(100vw, 100vh*16/9) ≈ edge-to-edge.
              - sm+: floats at ~80% — min(80vw, 80vh*16/9).
              Reveal scales inside; 16:9 matches the video modal budget. */}
          <motion.div
            className={cn(
              "relative aspect-video overflow-hidden bg-black",
              "w-[min(100vw,177.78vh)] sm:w-[min(80vw,142.22vh)]",
              // shadow-overlay = app elevation token for modal surfaces; the
              // white ring does the separating in dark mode (shadow barely
              // reads on a dark backdrop), per the elevation spec.
              "rounded-none sm:rounded-xl sm:shadow-overlay sm:ring-1 sm:ring-white/15",
            )}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={src}
              title={title}
              allow="fullscreen; clipboard-write"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
