"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
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

  // What the pills cover, published as `--dock-clear` on <html>: the
  // distance from the top of the viewport to their bottom edge, 0 when there
  // are none. Anything that pins itself to the top of the page (the /works
  // bar) clears the dock by it instead of guessing whether a Live Activity
  // is up here right now.
  useEffect(() => {
    const row = scrollRef.current;
    const bar = row?.parentElement;
    if (!row || !bar) return;
    const root = document.documentElement;
    const publish = () => {
      // Layout boxes, not rects: a pill arrives scaled (`dock-pop-in`), and
      // its rect would report the frame of the animation it was caught in.
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
    /* Pill row. Outer centers; inner scrolls. Splitting the two avoids the
       flexbox `justify-center` + `overflow` clipping bug. */
    <div
      className="system-chrome fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}
    >
      <div
        ref={scrollRef}
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
