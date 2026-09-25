"use client";

import { AnimatePresence } from "framer-motion";
import { useWindows } from "../provider";
import { WatchDock } from "./watch-dock";
import { Window } from "./window";

// =============================================================================
// WindowLayer — the "desktop" surface every window floats on
//
// A single fixed, full-viewport layer mounted once at the app root. It's
// `pointer-events: none` so it never intercepts clicks meant for the page;
// each window re-enables pointer events for itself.
//
// Every open window is rendered here — *including minimized ones*. A minimized
// window isn't unmounted; it genies down to opacity 0 but stays in the DOM so
// its iframe / <lynx-view> keeps running and its state survives (a counter at 5
// comes back at 5). AnimatePresence is only for open ⇄ close (mount/unmount).
// =============================================================================

export function WindowLayer() {
  const { windows } = useWindows();

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden={windows.length === 0}
    >
      <WatchDock />
      <AnimatePresence>
        {windows.map((win) => (
          <Window key={win.id} win={win} />
        ))}
      </AnimatePresence>
    </div>
  );
}
