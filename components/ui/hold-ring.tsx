"use client";

import { motion } from "motion/react";

// =============================================================================
// HoldRing: the charge of a hidden long-press, drawn where a finger isn't.
//
// A finger on a button hides the button, so the feedback for holding it
// lives outside: a ring that appears a little way out and closes onto the
// button's own edge exactly as the hold completes. Visible past a thumb from
// any direction, legible as "something is filling up" without a progress
// readout, and shape-agnostic. The site's one word for "keep holding": the
// search button's devtool hold (systems/command/fab.tsx) and the λhux mark's
// way into the About (components/home/scramble-identifier.tsx).
//
// It appears late on purpose. A tap never sees it; a deliberate hold does,
// in time to let go. Render it inside <AnimatePresence> while the hold is in
// its second half; take it away when the hold completes or is abandoned.
// =============================================================================

/** How far outside the target the ring starts before closing onto it. */
const OUTSET = 10;

export function HoldRing({
  rect,
  radius,
  durationMs,
}: {
  /** The target as it is drawn, measured when the ring appears. */
  rect: DOMRect;
  /** The target's own corner radius; the ring adds its outset to it. */
  radius: number;
  /** From the ring's appearance to the hold completing. */
  durationMs: number;
}) {
  return (
    <motion.span
      aria-hidden
      data-hold-ring
      initial={{ scale: 1.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.08, opacity: 0, transition: { duration: 0.18 } }}
      transition={{ duration: durationMs / 1000, ease: "linear" }}
      style={{
        position: "fixed",
        left: rect.x - OUTSET,
        top: rect.y - OUTSET,
        width: rect.width + OUTSET * 2,
        height: rect.height + OUTSET * 2,
        borderRadius: radius + OUTSET,
        zIndex: 9998,
      }}
      className="pointer-events-none border-2 border-foreground/35"
    />
  );
}
