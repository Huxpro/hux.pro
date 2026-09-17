"use client";

import { appTitle } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useInputCapability, useLocale } from "@/services";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { armPointer } from "../lib/pointer";
import type { WindowInstance } from "../lib/types";
import { useWindows } from "../provider";
import { WindowMenuBody, WindowMenuSheet } from "./window-menu";
import { pillShell, TrafficDots, type DotAction } from "./window-pill";

// =============================================================================
// WindowChrome — the window controls
//
// Native per platform:
//   • Desktop (pointer) → a top-LEFT cluster of full-size dots that sit dim &
//     grey on a fully transparent pill at rest, then light up to the red/amber/
//     green traffic lights on a glass pill (glyphs + title) on hover.
//   • Mobile (touch)    → a small, centred, always-grey ••• pill; tap → menu.
//
// The menu takes the shape the device asks for, and only the shape:
//
//   • Desktop → a popover under the pill, a real modal: portaled to <body>
//     with a full-viewport scrim (so a click anywhere — even over an iframe,
//     whose pointer events don't bubble — dismisses it) and clamped into the
//     viewport.
//   • Touch → an action sheet from the bottom edge (window-menu.tsx), which is
//     what iOS answers "long-press an object, get its actions" with. Nothing
//     here computes a position for it.
//
// Both shapes render one WindowMenuBody (window-menu.tsx), so the menu offers
// the same things whatever it is shaped like. Opened by right-click /
// tap-title / long-press.
//
// This is the chrome of a *windowed* window. Where the window is itself a
// sheet (a phone — see window-sheet.tsx), there is no pill: the sheet's grip
// is the whole chrome, and the menu hangs off that instead.
// =============================================================================

const MENU_W = 208; // w-52

/** Where the desktop popover hangs. Touch has nothing to anchor to. */
interface MenuAnchor {
  left: number;
  top: number;
  origin: string;
}

export function WindowChrome({
  win,
  focused,
  gesturing,
  beginDrag,
}: {
  win: WindowInstance;
  focused: boolean;
  /** A drag/resize gesture is in progress. */
  gesturing: boolean;
  beginDrag: (clientX: number, clientY: number) => void;
}) {
  const { close, minimize, toggleMaximize } = useWindows();
  // Canonical hover-capability read (not a raw `(hover: hover)` media query,
  // which is unreliable — e.g. always `hover: none` in headless Chrome).
  const { hasFineHoverPointer } = useInputCapability();
  const { locale } = useLocale();
  const title = appTitle(win.app, locale);
  const pillRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  // A pointer device gets the popover; anything else gets the sheet.
  const shape = hasFineHoverPointer ? "popover" : "sheet";
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  // The pill "wakes up" (glass + full-opacity dots) while interacting — this is
  // what gives the mobile pill its glass look when there's no hover to trigger it.
  const interacting = gesturing || menuOpen;

  const openMenu = () => {
    // The sheet rises from the bottom edge: nothing to anchor, nothing to
    // measure. Only the popover hangs off the pill.
    if (shape === "popover") {
      const r = pillRef.current?.getBoundingClientRect();
      if (!r) return;
      // Left-aligned under the pill, clamped into the viewport.
      const left = Math.min(Math.max(r.left, 8), window.innerWidth - MENU_W - 8);
      setAnchor({ left, top: r.bottom + 6, origin: "top left" });
    }
    setMenuOpen(true);
  };
  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => (menuOpen ? closeMenu() : openMenu());

  // The sheet brings its own Escape (and its own scrim).
  useEffect(() => {
    if (!menuOpen || shape !== "popover") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, shape]);

  /** Pick a row in the popover: it closes, the action lands. (The sheet form
   *  waits for its own exit first — see WindowMenuSheet.) */
  const run = (action?: () => void) => {
    closeMenu();
    action?.();
  };

  const onPillPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    armPointer(e, {
      onDragStart: beginDrag,
      onTap: (target) => {
        if ((target as HTMLElement)?.closest?.("[data-window-control]")) return;
        toggleMenu();
      },
      onLongPress: () => {
        suppressClick.current = true;
        openMenu();
      },
    });
  };

  // Per-window dispatch the traffic lights key into.
  const dotAction: Record<DotAction, (id: string) => void> = {
    close,
    minimize,
    zoom: toggleMaximize,
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-2.5 pt-2 [@media(hover:hover)]:justify-start">
      <div
        ref={pillRef}
        onPointerDown={onPillPointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          toggleMenu();
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        className={cn(pillShell(interacting), "pointer-events-auto")}
      >
        <TrafficDots
          focused={focused}
          interacting={interacting}
          onAction={(action) => dotAction[action](win.id)}
        />

        {/* App title — revealed on hover; brightens on its own hover (clickable). */}
        <span
          className={cn(
            "cursor-pointer overflow-hidden whitespace-nowrap text-[11px] font-medium",
            "text-foreground/70 transition-all duration-200 hover:text-foreground",
            "max-w-0 opacity-0",
            "[@media(hover:hover)]:group-hover/chrome:max-w-40",
            "[@media(hover:hover)]:group-hover/chrome:opacity-100",
            "[@media(hover:hover)]:group-hover/chrome:ml-2",
          )}
        >
          {title}
        </span>
      </div>

      {/* Touch: the menu as an action sheet, content height, from the bottom
          edge. It is portaled, scrimmed and stacked by the surface system
          (z-60, over the window layer and its iframes), which also brings a
          palette or devtool sheet underneath it a step back. */}
      {shape === "sheet" && (
        <WindowMenuSheet win={win} open={menuOpen} onClose={closeMenu} />
      )}

      {/* Desktop: the popover, portaled to <body> so its scrim covers
          everything (incl. iframes) and it's never clipped by the window.
          WindowChrome only ever renders client-side (windows open on
          interaction), so `document` is always present here. */}
      {shape === "popover" &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {menuOpen && anchor && (
              <>
                <div
                  className="fixed inset-0 z-[55]"
                  onPointerDown={closeMenu}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    closeMenu();
                  }}
                />
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                  style={{ left: anchor.left, top: anchor.top, transformOrigin: anchor.origin }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    "fixed z-[56] w-52 select-none p-1",
                    "rounded-2xl border border-black/8 dark:border-white/12",
                    "bg-white/90 shadow-overlay backdrop-blur-xl dark:bg-neutral-900/90",
                  )}
                >
                  <WindowMenuBody win={win} shape="popover" run={run} />
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
