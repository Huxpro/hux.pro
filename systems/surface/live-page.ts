"use client";

import { useEffect } from "react";

// =============================================================================
// The page stays live under a drawer.
//
// Every Radix dialog, modal or not, turns the page's pointer events off while
// its content is mounted (`body { pointer-events: none }`), and vaul turns
// them back on for a non-modal drawer — but only from the open it triggers
// itself. A drawer opened by its `open` prop, which is every surface here,
// gets neither, and the page under it goes dead. This puts it back, the way
// vaul does: on the next frame, after Radix has had its turn.
//
// A surface that wants the page taken away renders a scrim above it instead;
// the body itself is always live.
// =============================================================================

export function useLivePage(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      document.body.style.pointerEvents = "auto";
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);
}
