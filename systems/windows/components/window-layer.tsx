"use client";

import { AnimatePresence } from "framer-motion";
import { useWindows } from "../provider";
import { Window } from "./window";

// =============================================================================
// WindowLayer — the "desktop" surface every window floats on
//
// A single fixed, full-viewport layer mounted once at the app root. It's
// `pointer-events: none` so it never intercepts clicks meant for the page;
// each window re-enables pointer events for itself. Minimized windows drop out
// of the render (AnimatePresence plays their exit) but stay in the manager, so
// tapping their icon brings them back.
// =============================================================================

export function WindowLayer() {
  const { windows, lastExit } = useWindows();
  const visible = windows.filter((w) => w.mode !== "minimized");

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden={visible.length === 0}
    >
      {/* `custom` carries the last exit reason so each leaving window animates
          the right way: minimize genies up toward the dock, close shrinks. */}
      <AnimatePresence custom={lastExit}>
        {visible.map((win) => (
          <Window key={win.id} win={win} />
        ))}
      </AnimatePresence>
    </div>
  );
}
