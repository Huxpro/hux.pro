"use client";

/**
 * VideoSpotlight
 *
 * Mobile playback affordance for directly-playable videos. Unlike VideoModal,
 * it does NOT move the video — the iframe keeps playing exactly where it sits
 * in the timeline. This component only dims the *surroundings*: a full-screen
 * scrim with a transparent rectangular "hole" clipped out over the video's rect.
 *
 * Because the hole is clipped out of the scrim entirely, taps inside it fall
 * through to the video (native controls keep working) while taps on the dim
 * area close it.
 *
 * Two strategies (see MobileVideoMode), both dodging the one-frame lag a naive
 * fixed scrim gets when it chases a scrolling element through `scroll` events:
 *
 *   · lock   — a `fixed` viewport scrim plus a real, iOS-safe scroll lock (body
 *              `position: fixed`). Nothing scrolls, so the hole can't drift.
 *   · follow — an `absolute`, document-space scrim covering the whole page. It
 *              rides the same compositor scroll as the video, so the hole stays
 *              glued frame-perfectly while the page stays scrollable — no scroll
 *              listener, no lock.
 */

import { useCallback, useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";
import type { MobileVideoMode } from "./video-settings";

export interface VideoSpotlightProps {
  /** Whether the spotlight is active. */
  open: boolean;
  /** Element to keep lit (the playing video's wrapper). */
  targetRef: RefObject<HTMLElement | null>;
  /** Close handler (tap on the dim area or Escape). */
  onClose: () => void;
  /** Dimming strategy. */
  mode: MobileVideoMode;
}

interface Rect {
  /** In `lock` mode: viewport coords. In `follow` mode: document coords. */
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Full-document height, for the absolute (follow) scrim to cover. */
function documentHeight(): number {
  return Math.max(
    document.documentElement.scrollHeight,
    document.documentElement.clientHeight,
  );
}

/** Freeze the page (iOS-safe) and return an undo. */
function lockScroll(): () => void {
  const { body } = document;
  const scrollY = window.scrollY;
  const prev = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    overflow: body.style.overflow,
  };
  // position:fixed is the one lock iOS Safari actually honours (overflow:hidden
  // on <body> doesn't stop touch scrolling there). top:-scrollY keeps the page
  // visually put.
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  return () => {
    Object.assign(body.style, prev);
    window.scrollTo(0, scrollY);
  };
}

export function VideoSpotlight({
  open,
  targetRef,
  onClose,
  mode,
}: VideoSpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [docHeight, setDocHeight] = useState(0);
  const follow = mode === "follow";

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (follow) {
      // Document-space: add scroll offset so the rect stays valid as the page
      // scrolls under the absolute scrim.
      setRect({
        top: r.top + window.scrollY,
        left: r.left + window.scrollX,
        width: r.width,
        height: r.height,
      });
      setDocHeight(documentHeight());
    } else {
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
  }, [targetRef, follow]);

  useEffect(() => {
    // When closed the portal renders nothing (open && rect), so a stale rect is
    // harmless — skip work and let the next open re-measure.
    if (!open) return;

    // lock: freeze the page. follow: leave scrolling alone (the scrim rides it).
    const unlock = follow ? undefined : lockScroll();

    measure();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    // follow needs no scroll listener (absolute scrim tracks natively). lock
    // freezes the window, but inner scrollers (the media rail) can still move
    // the video — catch those in the capture phase.
    if (!follow) window.addEventListener("scroll", measure, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      if (!follow) window.removeEventListener("scroll", measure, true);
      unlock?.();
    };
  }, [open, follow, measure, onClose]);

  if (typeof document === "undefined") return null;

  // Rectangular hole via a single "keyhole" polygon: trace the box, slit in
  // along the left edge to the hole, around it, then back out. The clipped
  // region is removed from both paint and hit-testing. Coordinates are in the
  // scrim's own box — which equals viewport space (fixed) or document space
  // (absolute, top/left 0), matching how `rect` was measured.
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
          className={cn(
            "z-[10000] bg-black/60",
            follow ? "absolute left-0 top-0 w-full" : "fixed inset-0",
          )}
          style={{
            clipPath: clip,
            WebkitClipPath: clip,
            height: follow ? docHeight : undefined,
          }}
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
