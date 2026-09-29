"use client";

import { appTitle } from "@/lib/app-icon-core";
import { GLASS_CAPSULE } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useDock } from "@/systems/dock";
import { AnimatePresence, motion } from "framer-motion";
import { useWindows } from "../provider";
import { AppIconPlate } from "./app-icon-plate";
import type { WindowInstance } from "../lib/types";
import { AppBadgeFor } from "./app-badge";

// =============================================================================
// MinimizedWindows — minimized app windows, parked in the dock
//
// Minimizing a window genies it up toward the top-center "live activity" band
// (the Dock). It lands here as a pill — styled to match the music / ambient
// Live Activity pills — that sits in the same row. Tapping the pill restores
// (and focuses) the window, the iOS Dynamic-Island / minimized-app metaphor.
//
// Rendered as a child of <Dock>, so its pills become flex items in the dock's
// pill row alongside the other activities.
// =============================================================================

function PillIcon({ win }: { win: WindowInstance }) {
  return (
    <span className="relative block h-6 w-6 shrink-0">
      <AppIconPlate app={win.app} className="h-6 w-6" textClassName="text-[10px]" />
      {/* The runtime marker rides along, so a minimized Lynx app still reads as
          one at a glance in the dock. */}
      <AppBadgeFor
        app={win.app}
        size={11}
        className="pointer-events-none absolute -bottom-1 -right-1"
      />
    </span>
  );
}

export function MinimizedWindows() {
  const { windows, restore } = useWindows();
  const { locale } = useLocale();
  const minimized = windows.filter((w) => w.mode === "minimized");
  // Stand aside with the Live Activity pills while a panel or a notice holds
  // the dock's anchor (systems/dock, "Layout & coexistence rules").
  const { isAnyOpen, noticeUp } = useDock();
  const away = isAnyOpen || noticeUp;

  return (
    <AnimatePresence>
      {minimized.map((win) => (
        <motion.button
          key={win.id}
          type="button"
          onClick={() => restore(win.id)}
          initial={{ opacity: 0, scale: 0.8, y: -6 }}
          animate={away ? { opacity: 0, scale: 0.9, y: -6 } : { opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -6 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          style={{ transformOrigin: "top center" }}
          className={cn(
            "flex shrink-0 items-center gap-2",
            away ? "pointer-events-none" : "pointer-events-auto",
            // The Live Activity pill's capsule: it stands in the same row.
            GLASS_CAPSULE,
            "h-9 pl-1.5 pr-3",
            "transition-colors hover:border-border hover:bg-glass-hover active:scale-95",
          )}
          aria-label={`Restore ${appTitle(win.app, locale)}`}
          title={`Restore ${appTitle(win.app, locale)}`}
        >
          <PillIcon win={win} />
          <span className="max-w-32 truncate text-xs font-medium text-foreground/80">
            {appTitle(win.app, locale)}
          </span>
        </motion.button>
      ))}
    </AnimatePresence>
  );
}
