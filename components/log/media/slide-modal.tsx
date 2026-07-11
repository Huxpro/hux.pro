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
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";

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

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
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
          {/* Backdrop. Mobile theater = opaque black; sm+ = dimmed blur. */}
          <div className="absolute inset-0 bg-black sm:bg-black/80 sm:backdrop-blur-sm" />

          {/* Chrome — close + optional fullscreen escape hatch. */}
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Open slides fullscreen"
              className={cn(
                "inline-flex h-10 items-center gap-1.5 rounded-full px-3",
                "bg-white/10 text-sm text-white/80 backdrop-blur-sm",
                "transition-colors hover:bg-white/20 hover:text-white",
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Fullscreen</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close slides"
              className={cn(
                "inline-flex h-10 w-10 items-center justify-center",
                "rounded-full bg-white/10 text-white/80 backdrop-blur-sm",
                "transition-colors hover:bg-white/20 hover:text-white",
              )}
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
              "rounded-none sm:rounded-xl sm:shadow-2xl sm:ring-1 sm:ring-white/10",
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
