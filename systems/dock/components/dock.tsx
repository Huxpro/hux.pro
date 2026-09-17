"use client";

import { cn } from "@/lib/utils";
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
//   dot      every other activity, the minimal presentation: a bare circle,
//            detached from the island by a wider gap, as iOS detaches the
//            second of two Live Activities
//   window   minimized app windows, further out and a step down in glass —
//            they are parked apps, not ongoing activity, and the island is
//            not their home
//
// Nothing scrolls. An island that scrolls is a row again; if this ever gets
// genuinely crowded the answer is fewer things in it, not a scrollbar. The
// drag-to-scroll handlers went with it.
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
  return (
    /* Outer centers; inner is the island and its satellites. Splitting the two
       is what it always was — and now also means the inner box can be as wide
       as it likes without the outer one moving. */
    <div
      className="system-chrome fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}
    >
      <div
        data-dock-row
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
