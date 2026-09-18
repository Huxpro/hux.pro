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

  useEffect(() => {
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
  }, [cursorX, cursorY, recomputeOffset, onPositionChange]);

  // Recompute once the panel mounts/measures so the first frame is already
  // positioned correctly (the panel height is unknown until it renders).
  useEffect(() => {
    if (isHovering) recomputeOffset(cursorX.get(), cursorY.get());
  }, [isHovering, recomputeOffset, cursorX, cursorY]);

  const cursorXSpring = useSpring(cursorX, springConfig || { duration: 0 });
  const cursorYSpring = useSpring(cursorY, springConfig || { duration: 0 });

  const handleMouseEnter = useCallback(() => setIsHovering(true), []);
  const handleMouseLeave = useCallback(() => setIsHovering(false), []);

  useEffect(() => {
    if (!attachToParent || !cursorRef.current) return;

    const parent = cursorRef.current.parentElement;
    if (!parent) return;

    // Check if mouse is already inside the parent (e.g. after re-mount or prop change)
    const isInside = parent.matches(":hover");
    let rafId: number | null = null;
    if (isInside) {
      rafId = window.requestAnimationFrame(() => setIsHovering(true));
    }

    parent.addEventListener("mouseenter", handleMouseEnter);
    parent.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      parent.removeEventListener("mouseenter", handleMouseEnter);
      parent.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [attachToParent, handleMouseEnter, handleMouseLeave]);

  const isVisible = attachToParent ? isHovering : true;

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
