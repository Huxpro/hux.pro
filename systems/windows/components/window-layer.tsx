"use client";

import { useInputCapability } from "@/services";
import { AnimatePresence } from "framer-motion";
import { useEffect } from "react";
import { guardTouchPageScroll } from "../lib/touch-scroll-guard";
import { useWindows } from "../provider";
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
//
// The layer also arbitrates the page scroll for *touch*, which a window can't
// do for itself (there's no hover, and a finger inside a cross-origin iframe
// fires no event here at all) — see lib/touch-scroll-guard.ts.
// =============================================================================

export function WindowLayer() {
  const { windows } = useWindows();
  const { primaryInput } = useInputCapability();
  const hasLiveWindow = windows.some((win) => win.mode !== "minimized");

  useEffect(() => {
    if (primaryInput !== "touch" || !hasLiveWindow) return;
    return guardTouchPageScroll();
  }, [primaryInput, hasLiveWindow]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden={windows.length === 0}
    >
      <AnimatePresence>
        {windows.map((win) => (
          <Window key={win.id} win={win} />
        ))}
      </AnimatePresence>
    </div>
  );
}
