"use client";

import { cn } from "@/lib/utils";
import { useBreakpointValue } from "@/systems/surface";
import { useEffect, useRef, useState } from "react";
import { DockProvider } from "../provider";

// ---------------------------------------------------------------------------
// Dock — the top-of-screen home for Live Activities.
//
// ONE island, not a row of pills. This used to be a horizontally scrollable
// strip of identical capsules — one per activity, one per minimized window,
// all `h-9 rounded-full`, with drag-to-scroll when it got crowded. That is a
// notification tray. Apple's first sentence about the Dynamic Island is that
// it "serves as a unified home for alerts and indicators of ongoing activity",
// and what makes it read that way is that several activities MERGE into one
// object rather than queueing beside each other.
//
// So the row lays out three classes of thing, in this order, and the gaps
// between them do the talking (the rules are in globals.css, keyed on
// `data-dock-slot` — a sibling selector, because the children come from four
// different systems and none of them knows what the others rendered):
//
//   island   one activity, the compact presentation: lead + trail + chevron
//   dot      every other activity — lead and its live bit, detached from the
//            island as iOS detaches the second of two Live Activities
//   window   minimized app windows, further out and a step down in glass —
//            they are parked apps, not ongoing activity, and the island is
//            not their home
//
// A SATELLITE COLLAPSES TO A BARE CIRCLE ONLY WHEN THE ROW IS CROWDED. That is
// what iOS's minimal presentation is for: it exists because the Dynamic Island
// has one status bar's worth of room to share, and a 1280px row does not have
// that problem. So a satellite keeps the shape it had before the island
// existed — lead and its live bit, or an app icon and its title — while there
// is room, and gives it up when there is not.
//
// Room is COUNTED, not measured. Every satellite's label is width-capped, so
// the count is a sound proxy for the width, and counting costs one integer
// where measuring costs a second layout pass and a hysteresis rule to keep it
// from oscillating. The budget is one satellite on a phone and four above it:
// at 390px the row has ~358px, an island is ~80 and a capped satellite ~130,
// so one fits with room to spare and two leave none.
//
// Nothing scrolls. An island that scrolls is a row again; the drag-to-scroll
// handlers went with it, and the collapse above is what replaces them.
//
// The panels are Base UI drawers, portalled into the shared surface viewport
// (see live-activity.tsx), so the row is free to lay itself out however it
// likes — the old rule that it must carry no transform, so the `fixed` panels
// inside it stayed anchored to the viewport, went with the portal.
//
// There is no scrim. A press outside an open panel is the drawer's own outside
// press now, which is what the transparent scrim was standing in for.
// ---------------------------------------------------------------------------

function DockSurface({ children }: { children: React.ReactNode }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [satellites, setSatellites] = useState(0);
  const budget = useBreakpointValue({ base: 1, sm: 4 });

  // The children come from four different systems and each decides its own
  // slot at render time, so the only place the count exists is the DOM. An
  // observer rather than a render-time count for the same reason: a window
  // minimizing does not re-render the dock.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const count = () =>
      setSatellites(
        row.querySelectorAll('[data-dock-slot]:not([data-dock-slot="island"])')
          .length
      );
    count();
    const observer = new MutationObserver(count);
    observer.observe(row, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-dock-slot"],
    });
    return () => observer.disconnect();
  }, []);

  // What the pills cover, published as `--dock-clear` on <html>: the
  // distance from the top of the viewport to their bottom edge, 0 when there
  // are none. Anything that pins itself to the top of the page (the /works
  // bar) clears the dock by it instead of guessing whether a Live Activity
  // is up here right now.
  useEffect(() => {
    const row = rowRef.current;
    const bar = row?.parentElement;
    if (!row || !bar) return;
    const root = document.documentElement;
    const publish = () => {
      // Layout boxes, not rects: a satellite arrives on framer-motion's
      // `scale: 0.8 -> 1`, and its rect would report the frame of the
      // entrance it was caught in — 0.8 of its real width, and its edges
      // pulled 8px inward. (That exact reading is what made the dock's own
      // walkthrough report a 16px gap where the row has 8.)
      // The pills' offsets are from the fixed bar; the row's own `py-3` is
      // shadow room, not something to clear.
      let bottom = 0;
      for (const pill of Array.from(row.children) as HTMLElement[]) {
        if (pill.offsetHeight > 0) {
          bottom = Math.max(bottom, pill.offsetTop + pill.offsetHeight);
        }
      }
      root.style.setProperty(
        "--dock-clear",
        bottom > 0 ? `${Math.ceil(bar.getBoundingClientRect().top + bottom)}px` : "0px",
      );
    };
    publish();
    // A pill arriving or leaving, and a pill changing size (a panel
    // collapsing back into it).
    const ro = new ResizeObserver(publish);
    ro.observe(row);
    const mo = new MutationObserver(() => {
      ro.disconnect();
      ro.observe(row);
      for (const pill of Array.from(row.children)) ro.observe(pill);
      publish();
    });
    mo.observe(row, { childList: true });
    for (const pill of Array.from(row.children)) ro.observe(pill);
    window.addEventListener("resize", publish);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty("--dock-clear");
    };
  }, []);

  return (
    /* Outer centers; inner is the island and its satellites. Splitting the two
       is what it always was — and now also means the inner box can be as wide
       as it likes without the outer one moving. */
    <div
      className="system-chrome fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}
    >
      <div
        ref={rowRef}
        data-dock-row
        data-dock-satellites={satellites}
        data-dock-dense={satellites > budget ? "" : undefined}
        // `py-3 -my-3` gives the shadows room without shifting the row.
        // `max-w-full` + `min-w-0` keep a long island from pushing the
        // satellites off the screen; the island's own content truncates.
        className={cn(
          "flex max-w-full min-w-0 items-center px-4 py-3 -my-3",
          "pointer-events-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Dock({ children }: { children: React.ReactNode }) {
  return (
    <DockProvider>
      <DockSurface>{children}</DockSurface>
    </DockProvider>
  );
}
