"use client";

import { AnimatePresence, motion } from "framer-motion";
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

      {/* Pill row. Outer element centers; inner element scrolls. Splitting the
          two avoids the flexbox `justify-center` + `overflow` clipping bug. */}
      <div
        className="fixed left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ top: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <div className="flex items-center gap-2 px-4 max-w-full overflow-x-auto no-scrollbar pointer-events-none">
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
