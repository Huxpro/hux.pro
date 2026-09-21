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

export type CursorProps = {
  children: React.ReactNode;
  className?: string;
  springConfig?: SpringOptions;
  /** Pixel offset from pointer to avoid covering hovered text/content */
  offset?: { x: number; y: number };
  attachToParent?: boolean;
  /**
   * Host whose hover shows the panel. Required when the cursor is portaled
   * away from the trigger; otherwise the idle span's parent is used.
   */
  attachHost?: React.RefObject<HTMLElement | null>;
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
  attachHost,
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
  // gutter and never covers the reading column — with one exception: a panel
  // that would leave the screen on the right flips to the pointer's left
  // instead. A mark at the trailing edge of the column (a `<handle>` under
  // the date) would otherwise peek into the void. The vertical offset is
  // recomputed to keep the panel on screen near the bottom edge.
  const translateX = useMotionValue(offset.x);
  const translateY = useMotionValue(offset.y);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  // Vertical edge avoidance only: flip the panel above the pointer when it
  // would spill off the bottom, then clamp against the top edge (panels taller
  // than the viewport). The panel keeps its horizontal gutter position, so
  // shifting it up never drops it over the reading column.
  const recomputeOffset = useCallback(
    (px: number, py: number) => {
      if (typeof window === "undefined") return;
      const margin = 8;
      const h = cursorRef.current?.offsetHeight ?? 0;
      const w = cursorRef.current?.offsetWidth ?? 0;
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      let ty = offset.y;
      if (py + ty + h + margin > vh) ty = -offset.y - h;
      if (py + ty < margin) ty = margin - py;

      let tx = offset.x;
      if (px + tx + w + margin > vw) tx = -offset.x - w;
      if (px + tx < margin) tx = margin - px;

      translateX.set(tx);
      translateY.set(ty);
    },
    [offset.x, offset.y, translateX, translateY]
  );

  // Only while the panel can show. A page of covers and handles mounts a
  // hundred of these; a hundred document listeners doing four motion-value
  // writes per pointer event, for panels that are not on screen, is not a
  // hover system. The enter event seeds the position, so the first frame is
  // already under the pointer.
  const listening = !attachToParent || isHovering;
  useEffect(() => {
    if (!listening) return;
    const updatePosition = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      recomputeOffset(e.clientX, e.clientY);
      onPositionChange?.(e.clientX, e.clientY);
    };

    document.addEventListener("mousemove", updatePosition);
    return () => {
      document.removeEventListener("mousemove", updatePosition);
    };
  }, [listening, cursorX, cursorY, recomputeOffset, onPositionChange]);

  // Recompute once the panel mounts/measures so the first frame is already
  // positioned correctly (the panel height is unknown until it renders).
  useEffect(() => {
    if (isHovering) recomputeOffset(cursorX.get(), cursorY.get());
  }, [isHovering, recomputeOffset, cursorX, cursorY]);

  const cursorXSpring = useSpring(cursorX, springConfig || { duration: 0 });
  const cursorYSpring = useSpring(cursorY, springConfig || { duration: 0 });

  const handleMouseEnter = useCallback(
    (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
      setIsHovering(true);
    },
    [cursorX, cursorY],
  );
  const handleMouseLeave = useCallback(() => setIsHovering(false), []);

  useEffect(() => {
    if (!attachToParent) return;

    const host = attachHost?.current ?? cursorRef.current?.parentElement;
    if (!host) return;

    // Check if mouse is already inside the host (e.g. after re-mount or prop change)
    const isInside = host.matches(":hover");
    let rafId: number | null = null;
    if (isInside) {
      rafId = window.requestAnimationFrame(() => setIsHovering(true));
    }

    host.addEventListener("mouseenter", handleMouseEnter);
    host.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      host.removeEventListener("mouseenter", handleMouseEnter);
      host.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [attachToParent, attachHost, handleMouseEnter, handleMouseLeave]);

  const isVisible = attachToParent ? isHovering : true;

  // The panel exists only while it peeks. A fixed, transformed element is a
  // compositing layer, and one per row of /works was fifty layers on a desk
  // before anyone hovered; idle, this is a hidden span — enough for the
  // parent-attach effect above to find the parent. `present` outlives
  // `isVisible` by the exit animation, so the panel can leave the way it
  // came. (React's "adjusting state during render" pattern, so the panel
  // is in the same commit as the hover that asked for it.)
  const [present, setPresent] = useState(isVisible);
  if (isVisible && !present) setPresent(true);
  if (!present) {
    return (
      <span
        ref={cursorRef as unknown as React.RefObject<HTMLSpanElement>}
        hidden
      />
    );
  }

  return (
    <motion.div
      ref={cursorRef}
      className={cn("pointer-events-none fixed left-0 top-0 z-50", className)}
      style={{
        x: cursorXSpring,
        y: cursorYSpring,
        translateX,
        translateY,
      }}
    >
      <AnimatePresence onExitComplete={() => setPresent(false)}>
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
