"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { withDraggable } from "@/systems/draggable";
import {
  SHEET_DETENTS,
  SurfaceBody,
  SurfaceSheet,
  SurfaceWindow,
  useBreakpointValue,
} from "@/systems/surface";
import { motion } from "framer-motion";
import { Bug, PanelBottom } from "lucide-react";
import { useEffect, useRef } from "react";
import { DevtoolFooter, DevtoolModules, DevtoolTitle } from "./panel";
import { useDevtool } from "./provider";

// =============================================================================
// Devtool dock — where the devtool is, and the gesture that moves it.
//
// The devtool is ONE object with two dockings, not a button that opens a panel.
// It is either docked to the bottom edge, or floating free; and it is either
// showing its modules or collapsed. Two booleans in the provider, and the
// viewport turns them into a shell:
//
//                 │ docked (an edge to hug)     │ floating
//   ──────────────┼─────────────────────────────┼──────────────────────────
//   open          │ SurfaceSheet, bottom edge   │ SurfaceWindow, top right
//   closed        │ nothing — `D` or ⌘K summons │ the pill
//
// A desktop has no bottom edge worth docking to — a full-height devtool against
// an edge would cover the page it is about — so it reads as floating whatever
// the setting says. That is the pill ⇄ window pair it has always had; the phone
// is what gains a second docking.
//
// Between the two: a GESTURE. Pull the sheet up past its top edge and let go,
// and the devtool lifts off the bottom edge and lands as the pill — the
// developer saying "I want this with me everywhere", which is what floating
// means. The way back is the dock button in the window's header, offered only
// where there is an edge to go back to.
//
// This is why the surface system has a primitive layer. <AdaptiveSurface> is
// the rule that the viewport picks the shape; here the shape is something the
// developer chose, so the shells are composed directly instead. The chrome is
// still the shared one (<SurfaceBody>), so the devtool looks like every other
// surface in all three states.
// =============================================================================

/**
 * Whether this viewport has a bottom edge worth docking to. Tailwind's `sm`,
 * the same width at which every other surface stops being a bottom sheet.
 */
const CAN_DOCK = { base: true, sm: false };

/** Width of the floating window. The pill shares its top-right anchor. */
const WINDOW_WIDTH = "min(calc(100vw - 2rem), 420px)";

function DevtoolPillInner() {
  const { locale } = useLocale();
  const { isEnabled, open, signalDragReset } = useDevtool();

  // Reset drag position when devtool is toggled on (not fold/unfold)
  const prevEnabledRef = useRef(isEnabled);
  useEffect(() => {
    if (isEnabled && !prevEnabledRef.current) {
      signalDragReset("devtool");
    }
    prevEnabledRef.current = isEnabled;
  }, [isEnabled, signalDragReset]);

  return (
    // The box is not the button: only the pill itself takes pointers, so the
    // top-right corner belongs to whatever surface is up there — a full-height
    // picker's close button sits exactly here.
    //
    // It springs in from its own corner on the same curve the window opens on,
    // because that is what it is: the window collapsed, or the sheet just
    // pulled off the edge. Scale lives on the box so the button keeps its own
    // hover and press transforms.
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
      className="pointer-events-none fixed top-4 right-4 z-50 origin-top-right"
    >
      <button
        onClick={open}
        data-drag-handle
        className={cn(
          "pointer-events-auto flex h-10 items-center gap-2 px-4",
          "rounded-full touch-none",
          "bg-foreground text-background",
          "shadow-raised",
          "transition-transform duration-300 hover:scale-105 active:scale-95"
        )}
        aria-label="Open devtool panel"
      >
        <Bug className="h-4 w-4" />
        <span className="text-xs font-mono uppercase tracking-wider">
          {locale === "zh" ? "调试" : "Debug"}
        </span>
        <kbd className="text-[10px] font-mono opacity-60 ml-1">D</kbd>
      </button>
    </motion.div>
  );
}

const DevtoolPill = withDraggable(DevtoolPillInner, {
  id: "devtool",
  // The pill is its own handle. It shares the instance with the window, so the
  // two sizes of the one object stay anchored by the same corner: the pill
  // mounts fresh each time the window closes and reads back where it was left.
  dragHandle: "[data-drag-handle]",
});

export function DevtoolFAB() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const { isEnabled, isOpen, isDetached, close, detach, dock } = useDevtool();
  const canDock = useBreakpointValue(CAN_DOCK);

  if (!isEnabled) return null;

  // A viewport with no edge to dock to is floating whatever the setting says.
  const floating = isDetached || !canDock;

  const body = (
    <SurfaceBody
      title={<DevtoolTitle />}
      closeLabel={zh ? "关闭调试面板" : "Close devtool panel"}
      onClose={close}
      // The modules bring their own padding and full-bleed section rules.
      contentClassName="pb-0"
      footer={<DevtoolFooter />}
      actions={
        floating && canDock ? (
          <button
            onClick={dock}
            aria-label={zh ? "停靠到底部" : "Dock to the bottom edge"}
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground active:scale-[0.92] active:bg-accent/60"
          >
            <PanelBottom className="h-4 w-4" />
          </button>
        ) : undefined
      }
    >
      <DevtoolModules />
    </SurfaceBody>
  );

  if (floating) {
    return (
      <>
        {/* Rendered rather than hidden, so it remounts when the window closes
            and picks up wherever the window was dragged to. */}
        {!isOpen && <DevtoolPill />}
        <SurfaceWindow
          id="devtool"
          open={isOpen}
          onOpenChange={(next) => !next && close()}
          width={WINDOW_WIDTH}
          maxHeight="min(70vh, 720px)"
          // Where the devtool has always lived, and where it must stay:
          // centred, it would cover the page it is there to watch.
          placement="top-right"
        >
          {body}
        </SurfaceWindow>
      </>
    );
  }

  return (
    <SurfaceSheet
      id="devtool"
      open={isOpen}
      onOpenChange={(next) => !next && close()}
      // The site's detents, so a picker opened from here arrives level with it.
      snapPoints={SHEET_DETENTS}
      // Past the top edge and let go: the devtool comes off the bottom edge.
      onPullPastTop={detach}
    >
      {body}
    </SurfaceSheet>
  );
}
