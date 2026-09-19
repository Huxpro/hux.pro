"use client";

import { useArmed } from "@/lib/deferred";
import { AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { useWindows } from "../provider";

const Window = dynamic(
  () => import("./window").then((m) => ({ default: m.Window })),
  { ssr: false },
);

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
  const armed = useArmed(windows.length > 0);

  if (!armed) return null;

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
