"use client";

/**
 * VideoModal
 *
 * Full-screen lightbox that plays a directly-playable video (YouTube / Vimeo /
 * Bilibili) inside a centered iframe. The player is sized to the largest 16:9
 * box that fits within ~80% of the viewport, so it reads big without touching
 * the edges. Autoplay is expected to be baked into the `src` — the iframe is
 * only ever mounted after an explicit user click, so browsers allow it.
 *
 * Dismissal: backdrop click, the close button, or the Escape key. Body scroll
 * is locked while open. Rendered through a portal so the overlay escapes any
 * transformed / overflow-clipped ancestor in the timeline.
 */

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VideoModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** Close handler (backdrop / Escape / close button). */
  onClose: () => void;
  /** Iframe player URL (should already include autoplay params). */
  src: string;
  /** Accessible iframe title. */
  title: string;
  /** Iframe `allow` attribute. */
  allow?: string;
  /** Iframe `sandbox` attribute (Bilibili needs a scoped sandbox). */
  sandbox?: string;
  /** Iframe `scrolling` attribute. */
  scrolling?: "yes" | "no" | "auto";
}

export function VideoModal({
  open,
  onClose,
  src,
  title,
  allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
  sandbox,
  scrolling,
}: VideoModalProps) {
  // Portals need the DOM: false during SSR / first hydration snapshot, true
  // once running on the client. useSyncExternalStore avoids a setState-in-effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // Escape to close + lock body scroll while open.
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
        // z above the draggable command FAB (z 9999) so theater mode truly
        // owns the screen and nothing floats over the video.
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
          {/* Backdrop. On mobile it's a fully-opaque "theater" black that owns
              the whole screen; on sm+ it's a dimmed, blurred overlay behind the
              floating player. */}
          <div className="absolute inset-0 bg-black sm:bg-black/80 sm:backdrop-blur-sm" />

          {/* Close button — sits above the player, top-right of the viewport. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close video"
            className={cn(
              "absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center",
              "rounded-full bg-white/10 text-white/80 backdrop-blur-sm",
              "transition-colors hover:bg-white/20 hover:text-white",
            )}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Player: the largest 16:9 box that fits the allotted screen.
              - Mobile (theater): fills the viewport — min(100vw, 100vh*16/9)
                ≈ min(100vw, 177.78vh), edge-to-edge with no chrome.
              - sm+: floats at ~80% — min(80vw, 80vh*16/9) ≈ min(80vw, 142.22vh).
              The vh term caps width so height never overflows in either mode. */}
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
              allow={allow}
              allowFullScreen
              sandbox={sandbox}
              scrolling={scrolling}
              className="absolute inset-0 h-full w-full border-0"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
