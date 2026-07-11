"use client";

/**
 * VideoSpotlight
 *
 * Mobile playback affordance for directly-playable videos. Unlike VideoModal,
 * it does NOT move the video — the iframe keeps playing exactly where it sits
 * in the timeline. This component only dims the *surroundings*: a full-screen
 * scrim with a transparent rectangular "hole" clipped out over the video's
 * current on-screen rect.
 *
 * Because the hole is clipped out of the scrim entirely, taps inside it fall
 * through to the video (native controls keep working) while taps on the dim
 * area close it. The scrim is portalled to <body> and sits above the page, so
 * the effect works regardless of the transformed / clipped ancestors the video
 * lives inside — no z-index lifting of the in-flow player required.
 *
 * Body scroll is locked while active so the video's rect (and thus the hole)
 * stays put; the rect is re-measured on resize / orientation / scroll.
 */

import { useCallback, useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

export interface VideoSpotlightProps {
  /** Whether the spotlight is active. */
  open: boolean;
  /** Element to keep lit (the playing video's wrapper). */
  targetRef: RefObject<HTMLElement | null>;
  /** Close handler (tap on the dim area or Escape). */
  onClose: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function VideoSpotlight({ open, targetRef, onClose }: VideoSpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [targetRef]);

  useEffect(() => {
    // When closed the portal renders nothing (open && rect), so a stale rect is
    // harmless — skip work and let the next open re-measure.
    if (!open) return;

    measure();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    // Capture phase so inner scrollers (e.g. the media rail) are caught too.
    window.addEventListener("scroll", measure, true);

    // Lock body scroll so the video — and the hole clipped over it — stay put.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.removeEventListener("scroll", measure, true);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, measure, onClose]);

  if (typeof document === "undefined") return null;

  // Rectangular hole via a single "keyhole" polygon: trace the viewport, slit
  // in along the left edge to the hole, around it, then back out. The clipped
  // region is removed from both paint and hit-testing.
  const clip = rect
    ? (() => {
        const x1 = rect.left;
        const y1 = rect.top;
        const x2 = rect.left + rect.width;
        const y2 = rect.top + rect.height;
        return (
          `polygon(` +
          `0px 0px, 0px 100%, ${x1}px 100%, ` +
          `${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ` +
          `${x1}px 100%, 100% 100%, 100% 0px)`
        );
      })()
    : undefined;

  return createPortal(
    <AnimatePresence>
      {open && rect && (
        <motion.div
          className="fixed inset-0 z-[10000] bg-black/60"
          style={{ clipPath: clip, WebkitClipPath: clip }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={onClose}
          aria-hidden
        />
      )}
    </AnimatePresence>,
    document.body,
  );
}
