"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  AnimatePresence,
  type SpringOptions,
  type Transition,
  type Variant,
} from "motion/react";
import { cn } from "@/lib/utils";
import { getPreviewTuning } from "./preview-tuning";

// --- Shared dwell "warmth" across every cursor preview on the page ----------
// The first preview to open waits out the dwell (openDelay); once one is open,
// moving to another item shows its preview immediately. Warmth lingers for a
// short grace window after a preview closes, so sweeping between adjacent rows
// stays instant — leaving the list long enough lets it cool down again. Both
// timings are tunable at runtime via the devtool (see preview-tuning).
let previewWarm = false;
let warmthCoolTimer: number | null = null;

function isPreviewWarm() {
  return previewWarm;
}

function markPreviewOpen() {
  previewWarm = true;
  if (warmthCoolTimer !== null) {
    window.clearTimeout(warmthCoolTimer);
    warmthCoolTimer = null;
  }
}

function markPreviewClosed() {
  if (typeof window === "undefined") return;
  // Re-entering within the grace window cancels this and keeps things warm.
  if (warmthCoolTimer !== null) window.clearTimeout(warmthCoolTimer);
  warmthCoolTimer = window.setTimeout(() => {
    previewWarm = false;
    warmthCoolTimer = null;
  }, getPreviewTuning().graceMs);
}

export type CursorProps = {
  children: React.ReactNode;
  className?: string;
  springConfig?: SpringOptions;
  /** Pixel offset from pointer to avoid covering hovered text/content */
  offset?: { x: number; y: number };
  attachToParent?: boolean;
  transition?: Transition;
  variants?: {
    initial: Variant;
    animate: Variant;
    exit: Variant;
  };
  onPositionChange?: (x: number, y: number) => void;
};

export function Cursor({
  children,
  className,
  springConfig,
  offset = { x: 16, y: 16 },
  attachToParent,
  variants,
  transition,
  onPositionChange,
}: CursorProps) {
  const cursorX = useMotionValue(
    typeof window !== "undefined" ? window.innerWidth / 2 : 0
  );
  const cursorY = useMotionValue(
    typeof window !== "undefined" ? window.innerHeight / 2 : 0
  );
  // Horizontal offset stays fixed so the panel always sits in the same side
  // gutter and never covers the reading column. Only the vertical offset is
  // recomputed, to keep the panel on screen near the bottom edge.
  const translateY = useMotionValue(offset.y);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Vertical edge avoidance only: flip the panel above the pointer when it
  // would spill off the bottom, then clamp against the top edge (panels taller
  // than the viewport). The panel keeps its horizontal gutter position, so
  // shifting it up never drops it over the reading column.
  const recomputeOffsetY = useCallback(
    (py: number) => {
      if (typeof window === "undefined") return;
      const margin = 8;
      const h = cursorRef.current?.offsetHeight ?? 0;
      const vh = window.innerHeight;

      let ty = offset.y;
      if (py + ty + h + margin > vh) ty = -offset.y - h;
      if (py + ty < margin) ty = margin - py;

      translateY.set(ty);
    },
    [offset.y, translateY]
  );

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      recomputeOffsetY(e.clientY);
      onPositionChange?.(e.clientX, e.clientY);
    };

    document.addEventListener("mousemove", updatePosition);
    return () => {
      document.removeEventListener("mousemove", updatePosition);
    };
  }, [cursorX, cursorY, recomputeOffsetY, onPositionChange]);

  // Recompute once the panel mounts/measures so the first frame is already
  // positioned correctly (the panel height is unknown until it renders).
  useEffect(() => {
    if (isHovering) recomputeOffsetY(cursorY.get());
  }, [isHovering, recomputeOffsetY, cursorY]);

  const cursorXSpring = useSpring(cursorX, springConfig || { duration: 0 });
  const cursorYSpring = useSpring(cursorY, springConfig || { duration: 0 });

  // Dwell timer: open only after the pointer rests for the tuned dwell, so the
  // panel doesn't flash while the pointer is just sweeping across rows. Once any
  // preview is warm (see the shared singleton above) the dwell is skipped, so
  // moving between items is instant. Closing is always immediate. The dwell only
  // ever runs for attachToParent (preview) cursors, so reading it from the
  // shared tuning store here doesn't affect plain cursor-followers.
  const openTimer = useRef<number | null>(null);
  const cancelOpen = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  }, []);
  const open = useCallback(() => {
    markPreviewOpen();
    setIsHovering(true);
  }, []);
  const scheduleOpen = useCallback(() => {
    if (openTimer.current !== null) return;
    // Warm? skip the dwell. Cold? wait it out — only the first item pays it.
    const delay = isPreviewWarm() ? 0 : getPreviewTuning().openDelay;
    if (delay <= 0) {
      open();
      return;
    }
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      open();
    }, delay);
  }, [open]);

  const handleMouseEnter = useCallback(() => scheduleOpen(), [scheduleOpen]);
  const handleMouseLeave = useCallback(() => {
    cancelOpen();
    markPreviewClosed();
    setIsHovering(false);
  }, [cancelOpen]);

  useEffect(() => {
    if (!attachToParent || !cursorRef.current) return;

    const parent = cursorRef.current.parentElement;
    if (!parent) return;

    // Check if mouse is already inside the parent (e.g. after re-mount or prop change)
    const isInside = parent.matches(":hover");
    let rafId: number | null = null;
    if (isInside) {
      rafId = window.requestAnimationFrame(() => scheduleOpen());
    }

    parent.addEventListener("mouseenter", handleMouseEnter);
    parent.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      cancelOpen();
      parent.removeEventListener("mouseenter", handleMouseEnter);
      parent.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [attachToParent, handleMouseEnter, handleMouseLeave, scheduleOpen, cancelOpen]);

  const isVisible = attachToParent ? isHovering : true;

  return (
    <motion.div
      ref={cursorRef}
      className={cn("pointer-events-none fixed left-0 top-0 z-50", className)}
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
        translateX: `${offset.x}px`,
        translateY,
      }}
    >
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={variants}
            transition={transition}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
