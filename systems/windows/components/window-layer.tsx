"use client";

import { AnimatePresence } from "framer-motion";
import { useMemo } from "react";
import { windowZIndex } from "../lib/geometry";
import { useWindows } from "../provider";
import { Window } from "./window";

// =============================================================================
// WindowLayer — the "desktop" every window floats on
//
// Mounted once at the app root. It draws no box of its own: each window is
// `position: fixed` in the root stacking context, at a z-index from its rank
// in the window order (`windowZIndex` — the band between the page and the
// dock). That is what lets something that is not a window stand *at a
// window's level*: the theater's persistent stage, which cannot move into a
// window's DOM without reloading its video, is painted at the Theater
// window's z-index instead, above that window and below any window in front
// of it. A single fixed layer would be one stacking context, and nothing
// outside it could stand between two windows.
//
// Every open window is rendered here — *including minimized ones*. A minimized
// window isn't unmounted; it genies down to opacity 0 but stays in the DOM so
// its iframe / <lynx-view> keeps running and its state survives (a counter at 5
// comes back at 5). AnimatePresence is only for open ⇄ close (mount/unmount).
// =============================================================================

export function WindowLayer() {
  const { windows } = useWindows();

  // Rank, not the raw counter: `z` grows with every focus, and the band a
  // window may paint in is ten levels wide.
  const zIndex = useMemo(() => {
    const byZ = [...windows].sort((a, b) => a.z - b.z);
    return new Map(byZ.map((w, rank) => [w.id, windowZIndex(rank)]));
  }, [windows]);

  return (
    <AnimatePresence>
      {windows.map((win) => (
        <Window key={win.id} win={win} zIndex={zIndex.get(win.id) ?? windowZIndex(0)} />
      ))}
    </AnimatePresence>
  );
}
