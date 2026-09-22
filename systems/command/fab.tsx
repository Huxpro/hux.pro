"use client";

import { useLocale, t } from "@/services";
import { useCommand } from "./provider";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Command, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDraggable } from "@/systems/draggable";
import { useDevtool } from "@/systems/devtool";
import { HANDOFF, useHomeEditing } from "@/components/ui/home-edit-store";
import { useCompactViewport } from "./use-compact-viewport";

/**
 * Hold the search button this long and the devtool opens. Undocumented on
 * purpose: a phone has no `D` key, and the palette's own Debug Panel row is the
 * way in that is meant to be found. This is the one for whoever already knows.
 */
const DEVTOOL_HOLD_MS = 1200;

/**
 * Nothing happens visibly before this. A tap is ~100ms and a hesitant one
 * rarely half that again, so no ordinary press ever sees the ring — which is
 * what keeps this hidden while still making the second half of the hold
 * legible. The feedback is also what makes a shorter hold safe: an accidental
 * one announces itself in time to let go.
 */
const DEVTOOL_HOLD_REVEAL_MS = 700;

/** A press that slides this far is a drag or a scroll, not a hold. */
const HOLD_SLOP_PX = 10;

/** How far outside the button the ring starts before closing onto it. */
const HOLD_RING_OUTSET = 10;

/** Both shapes of this button are this round — the bar and the round FAB. */
const FAB_RADIUS = 24;

export function FloatingActionButton() {
  const { toggle } = useCommand();
  const { summon: summonDevtool, liquidTabBar } = useDevtool();
  const pathname = usePathname();
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(false);
  const drag = useDraggable("command-fab");
  // While the home grid is in jiggle edit mode, the bar fades out on phones
  // so the grid's edit controls can take the bottom of the screen (on wider
  // screens they float above it and the bar stays put). The fade is
  // sequenced with the controls' entrance/exit (HANDOFF), so each direction
  // is a hand-off rather than a crossfade.
  const homeEditing = useHomeEditing();
  // Below `md` the bar and the grid's edit controls share the bottom of the
  // screen; above it the controls float over the bar.
  const compact = useCompactViewport();

  // The hold that opens the devtool. Timers and the press live in refs — a
  // state update mid-press would only fight the drag below — but the ring is
  // state, because it has to render.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
  const heldRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Measured once when the ring appears: a finger covers the button, so the
  // feedback has to live outside it, and the button is not moving by then.
  const [holdRing, setHoldRing] = useState<DOMRect | null>(null);

  const cancelHold = useCallback(() => {
    // `clearTimeout` on an expired or absent id is a no-op, so nothing here
    // needs to track which timers are still live.
    clearTimeout(holdTimer.current ?? undefined);
    clearTimeout(revealTimer.current ?? undefined);
    holdOrigin.current = null;
    setHoldRing(null);
  }, []);

  const startHold = useCallback(
    (e: React.PointerEvent) => {
      heldRef.current = false;
      holdOrigin.current = { x: e.clientX, y: e.clientY };
      revealTimer.current = setTimeout(() => {
        // The live box, so the ring wraps the button as it is drawn — which
        // during a press includes its own `active:scale-95`.
        setHoldRing(buttonRef.current?.getBoundingClientRect() ?? null);
      }, DEVTOOL_HOLD_REVEAL_MS);
      holdTimer.current = setTimeout(() => {
        heldRef.current = true;
        setHoldRing(null);
        summonDevtool();
      }, DEVTOOL_HOLD_MS);
    },
    [summonDevtool]
  );

  const trackHold = useCallback(
    (e: React.PointerEvent) => {
      const origin = holdOrigin.current;
      if (!origin) return;
      if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > HOLD_SLOP_PX) {
        cancelHold();
      }
    },
    [cancelHold]
  );

  useEffect(() => cancelHold, [cancelHold]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Phone + DevTool switch: the liquid tab bar owns this slot. Desktop keeps
  // the Search FAB either way.
  if (!mounted || (liquidTabBar && compact)) return null;

  const isHomepage = pathname === "/";
  const isDraggable = drag.isEnabled && !isHomepage;
  const yielding = isHomepage && homeEditing && compact;

  const fab = (
    <div
      className={cn(
        "system-chrome fixed bottom-6 left-0 right-0 z-50 px-6",
        "flex pointer-events-none",
        isHomepage ? "justify-center" : "justify-end"
      )}
    >
      <motion.button
        ref={buttonRef}
        layout
        // The hold has already done something by the time the finger lifts,
        // so the press that carried it must not also open the palette.
        onClick={() => {
          if (heldRef.current) {
            heldRef.current = false;
            return;
          }
          toggle();
        }}
        onPointerDown={startHold}
        onPointerMove={trackHold}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onPointerLeave={cancelHold}
        className={cn(
          "pressable pointer-events-auto select-none",
          "transition-[background-color,border-color,color,transform] duration-200",
          yielding && "pointer-events-none",
          "flex items-center gap-2",
          "bg-glass backdrop-blur-xl",
          "border border-border/50",
          "shadow-raised",
          isHomepage ? "text-muted-foreground" : "text-foreground",
          "hover:bg-glass-hover hover:border-border",
          // Touch-down: the bar darkens on the same frame as the press, the
          // way an iOS search field does, and eases back on release.
          "active:bg-glass-strong-hover active:border-border active:text-foreground",
          "h-12",
          "overflow-hidden",
          isHomepage
            // No press scale on the homepage bar: it is a backdrop-blur
            // surface, and a transform makes the compositor re-blur every
            // frame of the press. The colour wash above is the feedback.
            ? "rounded-2xl pl-4 pr-6 md:px-4 w-auto md:w-full md:max-w-md focus:outline-none focus:ring-2 focus:ring-ring/20"
            : "rounded-[24px] w-12 md:w-auto md:px-4 justify-center active:scale-95"
        )}
        style={{ borderRadius: FAB_RADIUS }}
        animate={{ opacity: yielding ? 0 : 1 }}
        transition={{
          layout: { duration: 0.4, ease: [0.32, 0.72, 0, 1] },
          borderRadius: { duration: 0.4 },
          opacity: yielding
            ? { duration: HANDOFF.out }
            : { duration: HANDOFF.in, delay: HANDOFF.delay },
        }}
        aria-label="Open command palette"
      >
        <motion.div
          layout
          className="flex items-center justify-center shrink-0"
        >
          {isHomepage ? (
            <Search className="h-4 w-4" />
          ) : (
            <Command className="h-5 w-5 md:h-4 md:w-4" />
          )}
        </motion.div>

        <AnimatePresence mode="popLayout">
          {isHomepage && (
            <motion.span
              key="prompt-text"
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: 1,
                x: 0,
                width: "auto",
                transition: { duration: 0.3, delay: 0.1 },
              }}
              exit={{
                opacity: 0,
                x: -10,
                transition: { duration: 0.2 },
              }}
              className="flex-1 text-left text-sm whitespace-nowrap overflow-hidden"
            >
              <span className="md:hidden">{t(locale, "searchMobile")}</span>
              <span className="hidden md:inline">
                {t(locale, "searchDesktop")}
              </span>
            </motion.span>
          )}

          {!isHomepage && (
            <motion.div
              key="fab-text"
              initial={{ opacity: 0, x: 10 }}
              animate={{
                opacity: 1,
                x: 0,
                width: "auto",
                transition: { duration: 0.3, delay: 0.1 },
              }}
              exit={{
                opacity: 0,
                x: 10,
                transition: { duration: 0.2 },
              }}
              className="hidden md:block overflow-hidden"
            >
              <span className="text-sm font-medium whitespace-nowrap">K</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isHomepage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: 0.2 } }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.1 } }}
              className="hidden sm:flex"
            >
              <kbd className="items-center gap-0.5 px-2 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded flex">
                <span>⌘</span>
                <span>K</span>
              </kbd>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );

  // The charge, drawn OUTSIDE the button, because a finger is on the button.
  // A ring that starts wide and closes onto the button's own edge exactly as
  // the hold completes: visible past a thumb from any direction, legible as
  // "something is filling up" without a progress readout, and shape-agnostic —
  // both shapes of this button share a radius.
  const ring = (
    <AnimatePresence>
      {holdRing && (
        <motion.span
          aria-hidden
          data-hold-ring
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.08, opacity: 0, transition: { duration: 0.18 } }}
          transition={{
            duration: (DEVTOOL_HOLD_MS - DEVTOOL_HOLD_REVEAL_MS) / 1000,
            ease: "linear",
          }}
          style={{
            position: "fixed",
            left: holdRing.x - HOLD_RING_OUTSET,
            top: holdRing.y - HOLD_RING_OUTSET,
            width: holdRing.width + HOLD_RING_OUTSET * 2,
            height: holdRing.height + HOLD_RING_OUTSET * 2,
            // Both shapes of this button share FAB_RADIUS; the ring sits
            // outside them, so it takes the same curve plus its own outset.
            borderRadius: FAB_RADIUS + HOLD_RING_OUTSET,
            zIndex: 9998,
          }}
          className="pointer-events-none border-2 border-foreground/35"
        />
      )}
    </AnimatePresence>
  );

  if (!isDraggable)
    return (
      <>
        {fab}
        {ring}
      </>
    );

  return (
    <>
      <motion.div
      style={{
        ...drag.motionStyle,
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
      drag
      dragControls={drag.dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={drag.onDragStart}
      onDragEnd={drag.onDragEnd}
    >
      <div
        ref={drag.contentRef as React.RefObject<HTMLDivElement>}
        style={{ pointerEvents: "auto", touchAction: "none" }}
        onPointerDown={(e) => drag.startDrag(e)}
        onClickCapture={drag.preventClickAfterDrag}
      >
        {fab}
      </div>
    </motion.div>
    {ring}
    </>
  );
}
