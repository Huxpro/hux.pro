"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { useRef } from "react";
import { DockProvider, useDock } from "../provider";

// ---------------------------------------------------------------------------
// Dock — the top-of-screen home for Live Activities.
//
// Layout model (per product spec):
//   • Collapsed: pills sit side by side in a horizontal, centered row that
//     becomes horizontally scrollable once it gets crowded.
//   • Expanded: the open activity's panel takes over the same top-center anchor
//     while every pill is hidden; the shared scrim dims the page behind it.
//
// The row deliberately carries NO transform so the `fixed` panels rendered by
// <LiveActivity /> stay anchored to the viewport instead of to the row.
// ---------------------------------------------------------------------------

function DockSurface({ children }: { children: React.ReactNode }) {
  const { isAnyOpen, close } = useDock();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Mouse drag-to-scroll (touch scrolls natively). `moved` gates the click
  // suppression so a drag never also fires a pill's onClick.
  const drag = useRef({ active: false, startX: 0, startLeft: 0, moved: false });

  return (
    <>
      {/* Transparent scrim — tap anywhere to collapse (matches command palette). */}
      <AnimatePresence>
        {isAnyOpen && (
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
        )}
      </AnimatePresence>

      {/* Pill row. Outer centers; inner scrolls. Splitting the two avoids the
          flexbox `justify-center` + `overflow` clipping bug. */}
      <div
        className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
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
    </>
  );
}

export function Dock({ children }: { children: React.ReactNode }) {
  return (
    <DockProvider>
      <DockSurface>{children}</DockSurface>
    </DockProvider>
  );
}
