"use client";

import { cn } from "@/lib/utils";
import { useRef } from "react";
import { DockProvider } from "../provider";

// ---------------------------------------------------------------------------
// Dock — the top-of-screen home for Live Activities.
//
// Layout model (per product spec):
//   • Collapsed: pills sit side by side in a horizontal, centered row that
//     becomes horizontally scrollable once it gets crowded.
//   • Expanded: the open activity's panel takes over the same top-center anchor
//     while every pill goes invisible and stops taking pointers.
//
// The row holds pills and nothing else. The panels are Base UI drawers,
// portalled into the shared surface viewport (see live-activity.tsx), so the
// row is free to lay itself out however it likes — the old rule that it must
// carry no transform, so the `fixed` panels inside it stayed anchored to the
// viewport, went with the portal.
//
// There is no scrim. A press outside an open panel is the drawer's own outside
// press now, which is what the transparent scrim was standing in for.
// ---------------------------------------------------------------------------

function DockSurface({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Mouse drag-to-scroll (touch scrolls natively). `moved` gates the click
  // suppression so a drag never also fires a pill's onClick.
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  return (
    /* Pill row. Outer centers; inner scrolls. Splitting the two avoids the
       flexbox `justify-center` + `overflow` clipping bug. */
    <div
      className="system-chrome fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}
    >
      <div
        ref={scrollRef}
        // The dock's collapsed shape. A surface that must not cover the
        // player measures this (see `dockBottom` in the theater playlist).
        data-dock-anchor=""
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") return;
          drag.current = {
            active: true,
            startX: e.clientX,
            startLeft: scrollRef.current?.scrollLeft ?? 0,
            moved: false,
          };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d.active || !scrollRef.current) return;
          const dx = e.clientX - d.startX;
          if (Math.abs(dx) > 4) d.moved = true;
          if (d.moved) scrollRef.current.scrollLeft = d.startLeft - dx;
        }}
        onPointerUp={() => (drag.current.active = false)}
        onPointerLeave={() => (drag.current.active = false)}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
        // `py-3 -my-3` gives the pills' shadow room *inside* the overflow clip
        // (overflow-x forces overflow-y to clip too) without shifting the row.
        // `[&>*]:snap-center` snaps each pill; touch/mouse both scroll.
        className={cn(
          "flex max-w-full items-center gap-2 px-4 py-3 -my-3",
          "overflow-x-auto no-scrollbar overscroll-x-contain",
          "snap-x snap-proximity [&>*]:snap-center",
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
