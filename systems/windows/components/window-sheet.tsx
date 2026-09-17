"use client";

import { appTitle } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { SHEET_DETENTS, SURFACE_TRANSITION_MS, SurfaceSheet } from "@/systems/surface";
import { usePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DOCK_BAND, getViewport } from "../lib/geometry";
import type { WindowInstance } from "../lib/types";
import { useWindows } from "../provider";
import { AppFrame } from "./app-frame";
import { WindowGrip } from "./window-grip";
import { WindowMenuSheet } from "./window-menu";

// =============================================================================
// WindowSheet — an app window on a phone, which is to say: a sheet
//
// A draggable, resizable, free-floating box is a desktop idea. On a phone the
// same app is one sheet from the bottom edge, with detents for its size, the
// shared stack for its depth, and its grip (window-grip.tsx) — the window's own
// pill, floating over edge-to-edge content — for the whole of its chrome. There
// is no title bar, here as there. Everything the pill used to offer lives in
// the menu it opens, which is a sheet stacked on this one: iOS presenting a
// sheet from a sheet.
//
// Three detents, not the site's two. A window opens where a desktop window's
// top edge sits — just clear of the live-activity dock band — because that is
// the size an app wants; from there a drag takes it to the very top, or down
// to seven tenths to see the page behind it. (The site's shared pair,
// SHEET_DETENTS, is for surfaces that stack level with one another; a window
// stacks with nothing, and the menu over it is content-height.)
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

/** Where the sheet rests: the page, the dock band, the top. */
type Level = "page" | "dock" | "top";

/**
 * The site's own pair — seven tenths (far enough down to see the page behind
 * the window) and the top — with the window's own middle detent between them.
 * Shared, because a sheet stacked on this one arrives level by matching values.
 */
const [PAGE_DETENT, TOP_DETENT] = SHEET_DETENTS;

/**
 * The detent whose top edge lands where a desktop window's does: below the
 * live-activity dock band, so the music / ambient / minimized pills stay in
 * view above the app. A fraction of the viewport, since that is what Base UI
 * takes, recomputed when the viewport changes.
 */
function dockDetent(): number {
  const { height } = getViewport();
  return Math.round(Math.min(0.97, Math.max(0.8, 1 - DOCK_BAND / height)) * 1000) / 1000;
}

export function WindowSheet({ win }: { win: WindowInstance }) {
  const { focus, focusedId, minimize } = useWindows();
  const { locale } = useLocale();
  const [isPresent, safeToRemove] = usePresence();
  const [menuOpen, setMenuOpen] = useState(false);
  const [level, setLevel] = useState<Level>("dock");
  const [dock, setDock] = useState(dockDetent);

  const title = appTitle(win.app, locale);
  const minimized = win.mode === "minimized";
  const open = isPresent && !minimized;
  const id = `window-${win.id}`;

  // The dock detent is a fraction of a viewport that can change under it.
  // Coalesced to one read per frame: on iOS this fires all the way through a
  // rotation and every time the URL bar moves, once per open window.
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setDock(dockDetent());
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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
  // A window put away comes back the size it lives at, not the size the drag
  // that dismissed it left behind — a flick down ends at the lowest detent by
  // definition, and an app restored from the dock should not arrive shrunk.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      if (menuOpen) setMenuOpen(false);
      if (level !== "dock") setLevel("dock");
    }
  }

  // Detents by name, resolved late: the dock one moves with the viewport, and
  // a controlled snap point that went stale would jump the sheet on a rotate.
  // Memoised because Base UI re-reads the list by identity: a fresh array on
  // every render (and a drag renders) had it recomputing mid-gesture.
  const detents = useMemo(() => [PAGE_DETENT, dock, TOP_DETENT], [dock]);
  const snap = { page: PAGE_DETENT, dock, top: TOP_DETENT }[level];

  return (
    <SurfaceSheet
      id={id}
      open={open}
      onOpenChange={(next) => {
        // The only dismissal a sheet has is a drag (and Escape): put it away.
        if (!next) minimize(win.id);
      }}
      snapPoints={detents}
      activeSnapPoint={snap}
      onActiveSnapPointChange={(point) =>
        setLevel(
          point === TOP_DETENT ? "top" : point === PAGE_DETENT ? "page" : "dock",
        )
      }
      keepMounted
      grip={
        <WindowGrip
          label={title}
          focused={focusedId === win.id}
          onMenu={() => setMenuOpen(true)}
        />
      }
      gripOverlay
      label={title}
      // The app's own ground, as in a desktop window: a window is opaque, and
      // the glass is the pill floating on it.
      className={cn(win.app.runtime === "lynx" ? "bg-black" : "bg-background")}
    >
      {/* Edge-to-edge app, with the chrome floating over it. */}
      <div
        className="min-h-0 flex-1 overflow-hidden"
        onPointerDownCapture={() => focus(win.id)}
      >
        <AppFrame key={win.generation} app={win.app} />
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
