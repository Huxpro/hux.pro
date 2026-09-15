"use client";

import { APP_ICONS, iconFillsTile } from "@/lib/apps";
import { appTitle, resolveAppIconSrc } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { AnimatePresence, motion } from "framer-motion";
import { useWindows } from "../provider";
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
  const { locale } = useLocale();
  const title = appTitle(win.app, locale);
  const entry = APP_ICONS[win.app.id];
  const src = resolveAppIconSrc(win.app, APP_ICONS);
  const fills = iconFillsTile(entry);
  return (
    <span className="relative block h-6 w-6 shrink-0">
      <span
        className={cn(
          "block h-6 w-6 overflow-hidden rounded-[7px]",
          // Glyph icons need a plate so dark marks stay visible; full-bleed
          // icons bring their own background — no border, no plate.
          !fills && "bg-white",
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny local static asset
          <img
            src={src}
            alt=""
            className={cn(
              "h-full w-full",
              fills ? "object-cover" : "object-contain p-0.5",
            )}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-[10px] text-neutral-400">
            {title.charAt(0)}
          </span>
        )}
      </span>
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

  return (
    <AnimatePresence>
      {minimized.map((win) => (
        <motion.button
          key={win.id}
          type="button"
          onClick={() => restore(win.id)}
          initial={{ opacity: 0, scale: 0.8, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -6 }}
          transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          style={{ transformOrigin: "top center" }}
          className={cn(
            "pointer-events-auto flex shrink-0 items-center gap-2",
            "h-9 rounded-full pl-1.5 pr-3",
            "border border-border/50 bg-glass-strong shadow-raised backdrop-blur-xl",
            "transition-colors hover:border-border hover:bg-glass-strong-hover active:scale-95",
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
