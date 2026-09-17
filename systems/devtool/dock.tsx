"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useDraggable } from "@/systems/draggable";
import {
  SHEET_DETENTS,
  SurfaceBody,
  SurfaceSheet,
  SurfaceWindow,
  useBreakpointValue,
} from "@/systems/surface";
import { AnimatePresence, motion } from "framer-motion";
import { Bug, PanelBottom } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { DevtoolFooter, DevtoolModules, DevtoolTitle } from "./panel";
import { useDevtool } from "./provider";

// =============================================================================
// Devtool dock — where the devtool is, and the gestures that move it.
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
// Between the two, a gesture each way, and they are mirror images:
//
//   off   pull the sheet up past its top edge and let go. It comes off the
//         edge and lands as the pill (`onPullPastTop`, sheet.tsx).
//   on    drag the pill down onto the bottom edge and let go. A landing pad
//         rises to meet it, and the release puts the sheet back.
//
// Both say the same thing in the same language — where this belongs is
// something you move it to — so neither has to be learnt separately, and the
// pad appearing under a dragged pill is what teaches the pair. The window's
// header keeps a dock button too, because a window is not draggable to an edge
// on a touch screen without covering the screen in the process.
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

/** The landing pad's ring off the screen edges — the surface system's gap. */
const PAD_INSET = 12;
/** How tall it stands, and so how deep the catch is. */
const PAD_HEIGHT = 160;

/**
 * The pill's z. Kept at what `withDraggable`'s wrapper used to give it, so the
 * pill still rides over the secondary surfaces (z 60/61) it can sit beside —
 * a picker opened from the palette while the devtool is collapsed.
 */
const PILL_Z = 9999;

/** Where a release would put the sheet back. Only up while a pill is in hand. */
function DockPad({ over }: { over: boolean }) {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 420, damping: 36, mass: 0.7 }}
      style={{ height: PAD_HEIGHT, zIndex: PILL_Z - 1 }}
      className={cn(
        "pointer-events-none fixed inset-x-3 bottom-3 flex justify-center rounded-3xl pt-2",
        "border border-dashed transition-colors duration-200",
        over
          ? "border-foreground/40 bg-glass-sheet backdrop-blur-xl"
          : "border-border/60 bg-muted/20"
      )}
    >
      {/* The sheet's own grabber, waiting where the sheet would be. */}
      <span
        className={cn(
          "h-1 w-9 rounded-full transition-colors duration-200",
          over ? "bg-muted-foreground/50" : "bg-muted-foreground/20"
        )}
      />
    </motion.div>
  );
}

function DevtoolPill({
  canDock,
  onDockDrop,
  onDragStateChange,
}: {
  canDock: boolean;
  onDockDrop: () => void;
  onDragStateChange: (state: { dragging: boolean; over: boolean }) => void;
}) {
  const { locale } = useLocale();
  const { isEnabled, open, signalDragReset } = useDevtool();
  // Destructured up front: reading `drag.*` inside the JSX trips the
  // react-hooks/refs rule, since the same object also carries `contentRef`.
  const {
    isEnabled: isDraggable,
    contentRef,
    dragControls,
    motionStyle,
    onDragStart,
    onDragEnd,
    preventClickAfterDrag,
    forgetPosition,
  } = useDraggable("devtool");
  const overRef = useRef(false);

  // Reset drag position when devtool is toggled on (not fold/unfold)
  const prevEnabledRef = useRef(isEnabled);
  useEffect(() => {
    if (isEnabled && !prevEnabledRef.current) {
      signalDragReset("devtool");
    }
    prevEnabledRef.current = isEnabled;
  }, [isEnabled, signalDragReset]);

  /** Is the pill low enough that letting go would drop it on the pad? */
  const readOver = useCallback(() => {
    const el = contentRef.current;
    if (!el || !canDock) return false;
    const rect = el.getBoundingClientRect();
    return rect.top + rect.height / 2 > window.innerHeight - PAD_INSET - PAD_HEIGHT;
  }, [canDock, contentRef]);

  const handleDragStart = useCallback(() => {
    onDragStart();
    overRef.current = false;
    onDragStateChange({ dragging: true, over: false });
  }, [onDragStart, onDragStateChange]);

  const handleDrag = useCallback(() => {
    const over = readOver();
    if (over === overRef.current) return;
    overRef.current = over;
    onDragStateChange({ dragging: true, over });
  }, [readOver, onDragStateChange]);

  const handleDragEnd = useCallback(() => {
    const over = overRef.current;
    // Let the hook clamp and remember first, then take it back: a drop onto
    // the pad is not somewhere the pill came to rest, so it must not be where
    // the pill comes back next time. It comes back to its corner.
    onDragEnd();
    overRef.current = false;
    onDragStateChange({ dragging: false, over: false });
    if (over) {
      forgetPosition();
      onDockDrop();
    }
  }, [onDragEnd, onDragStateChange, forgetPosition, onDockDrop]);

  return (
    // The box is not the button: only the pill itself takes pointers, so the
    // top-right corner belongs to whatever surface is up there — a full-height
    // picker's close button sits exactly here.
    //
    // It springs in from its own corner on the same curve the window opens on,
    // because that is what it is: the window collapsed, or the sheet just
    // pulled off the edge. Scale lives here so the button keeps its own hover
    // and press transforms.
    <motion.div
      ref={contentRef as React.RefObject<HTMLDivElement>}
      drag={isDraggable ? true : undefined}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClickCapture={preventClickAfterDrag}
      onPointerDown={
        isDraggable
          ? (e: React.PointerEvent) => {
              const target = e.target as HTMLElement;
              if (!target.closest("[data-drag-handle]")) return;
              dragControls.start(e);
            }
          : undefined
      }
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.7 }}
      style={{ ...(isDraggable ? motionStyle : {}), zIndex: PILL_Z }}
      className="pointer-events-none fixed top-4 right-4 origin-top-right"
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

export function DevtoolFAB() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const { isEnabled, isOpen, isDetached, close, detach, dock } = useDevtool();
  const canDock = useBreakpointValue(CAN_DOCK);
  const [pillDrag, setPillDrag] = useState({ dragging: false, over: false });

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
        {!isOpen && (
          <DevtoolPill
            canDock={canDock}
            onDockDrop={dock}
            onDragStateChange={setPillDrag}
          />
        )}
        <AnimatePresence>
          {canDock && pillDrag.dragging && <DockPad over={pillDrag.over} />}
        </AnimatePresence>
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
