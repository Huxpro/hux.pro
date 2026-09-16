"use client";

import { appTitle } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { SHEET_DETENTS, SURFACE_TRANSITION_MS, SurfaceSheet } from "@/systems/surface";
import { usePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { WindowInstance } from "../lib/types";
import { useWindows } from "../provider";
import { AppFrame } from "./app-frame";
import { WindowGrip } from "./window-grip";
import { WindowMenuSheet } from "./window-menu";

// =============================================================================
// WindowSheet — an app window on a phone, which is to say: a sheet
//
// A draggable, resizable, free-floating box is a desktop idea. On a phone the
// same app is one sheet from the bottom edge, with the site's detents for its
// size (seven tenths / all the way — a drag is the resize), the shared stack
// for its depth, and its grip (window-grip.tsx) for the whole of its chrome.
// Everything the pill used to offer lives in the menu it opens, which is a
// sheet stacked on this one — iOS presenting a sheet from a sheet.
//
// Put away, not killed. A swipe down is `minimize`, never `close`: the sheet
// closes but `keepMounted` leaves its DOM in place, so the iframe or the Lynx
// view keeps its document (a counter at 5 comes back at 5 — the same promise
// WindowLayer makes for a minimized desktop window, kept by a different
// mechanism). The app comes back from its dock pill. Close is the menu's
// destructive row and nothing else, so no stray flick can lose an app's state.
//
// Closing unmounts this component, which would take a sheet mid-exit with it.
// `usePresence` is how a non-motion child holds AnimatePresence open: we keep
// the sheet's exit and only then say we're safe to remove.
// =============================================================================

export function WindowSheet({ win }: { win: WindowInstance }) {
  const { focus, minimize } = useWindows();
  const { locale } = useLocale();
  const [isPresent, safeToRemove] = usePresence();
  const [menuOpen, setMenuOpen] = useState(false);

  const title = appTitle(win.app, locale);
  const minimized = win.mode === "minimized";
  const open = isPresent && !minimized;
  const id = `window-${win.id}`;

  // Being closed: play the sheet out, then let go. A window closed while it was
  // already in the dock has nothing on screen to animate.
  useEffect(() => {
    if (isPresent) return;
    if (minimized) {
      safeToRemove?.();
      return;
    }
    const t = window.setTimeout(() => safeToRemove?.(), SURFACE_TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [isPresent, minimized, safeToRemove]);

  // The menu belongs to the window: putting the window away puts it away too.
  // Adjusted during render rather than in an effect — it is derived from the
  // window's own state, and a menu that closed one paint later would be a menu
  // sliding down on its own after the window had gone (docs/react-engineering).
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open && menuOpen) setMenuOpen(false);
  }

  return (
    <SurfaceSheet
      id={id}
      open={open}
      onOpenChange={(next) => {
        // The only dismissal a sheet has is a drag (and Escape): put it away.
        if (!next) minimize(win.id);
      }}
      snapPoints={SHEET_DETENTS}
      keepMounted
      grip={<WindowGrip label={title} onMenu={() => setMenuOpen(true)} />}
      label={title}
      className={cn(win.app.runtime === "lynx" && "bg-black")}
    >
      {/* Edge-to-edge app, exactly as in a desktop window. */}
      <div
        className="min-h-0 flex-1 overflow-hidden"
        onPointerDownCapture={() => focus(win.id)}
      >
        <AppFrame app={win.app} />
      </div>

      {/* The menu, stacked on the window: a React child of this sheet, so Base
          UI counts it as nested and sends the window a step back under it. */}
      <WindowMenuSheet
        win={win}
        nestedIn={id}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        // The detent is the size here; three rows that set a rect would do
        // nothing (see window-menu.tsx).
        presets={false}
      />
    </SurfaceSheet>
  );
}
