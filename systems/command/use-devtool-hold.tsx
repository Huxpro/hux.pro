"use client";

import { useDevtool } from "@/systems/devtool";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// The hold that opens the devtool.
//
// It belongs to the *search button*, whichever shape that button is wearing —
// the homepage search bar, the round FAB, or the tab bar's search tab. One
// hook rather than one copy per shape, so a fourth shape cannot quietly arrive
// without the entrance, and the timings stay one number each.
//
// Undocumented on purpose: a phone has no `D` key, and the palette's own Debug
// Panel row is the way in that is meant to be found. This is the one for
// whoever already knows. See docs/system-devtool.md.
// =============================================================================

/** Hold the search button this long and the devtool opens. */
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

export interface DevtoolHold {
  /** Spread onto the button the hold lives on. */
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
    onPointerLeave: () => void;
  };
  /**
   * Did the hold already fire for this press? The click that ends a hold must
   * not also open the palette — ask this first, and it clears itself.
   */
  consume: () => boolean;
  /** Render beside the button; it draws itself `fixed`, over everything. */
  ring: React.ReactNode;
}

/**
 * @param ref The button the hold lives on. The caller owns it and puts it on
 *   its own element; this only reads its box when the ring appears.
 * @param radius That button's corner radius. The ring sits outside the button,
 *   so it takes the same curve plus its own outset — which, along with the
 *   box, is all a shape has to tell this hook.
 */
export function useDevtoolHold(
  ref: React.RefObject<HTMLButtonElement | null>,
  radius: number
): DevtoolHold {
  const { summon } = useDevtool();

  // Timers and the press live in refs — a state update mid-press would only
  // fight the drag wrapper — but the ring is state, because it has to render.
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdOrigin = useRef<{ x: number; y: number } | null>(null);
  const heldRef = useRef(false);
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
        setHoldRing(ref.current?.getBoundingClientRect() ?? null);
      }, DEVTOOL_HOLD_REVEAL_MS);
      holdTimer.current = setTimeout(() => {
        heldRef.current = true;
        setHoldRing(null);
        summon();
      }, DEVTOOL_HOLD_MS);
    },
    [ref, summon]
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

  const consume = useCallback(() => {
    if (!heldRef.current) return false;
    heldRef.current = false;
    return true;
  }, []);

  useEffect(() => cancelHold, [cancelHold]);

  // The charge, drawn OUTSIDE the button, because a finger is on the button.
  // A ring that starts wide and closes onto the button's own edge exactly as
  // the hold completes: visible past a thumb from any direction, legible as
  // "something is filling up" without a progress readout, and shape-agnostic —
  // every shape only has to say how round it is.
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
            borderRadius: radius + HOLD_RING_OUTSET,
            zIndex: 9998,
          }}
          className="pointer-events-none border-2 border-foreground/35"
        />
      )}
    </AnimatePresence>
  );

  return {
    handlers: {
      onPointerDown: startHold,
      onPointerMove: trackHold,
      onPointerUp: cancelHold,
      onPointerCancel: cancelHold,
      onPointerLeave: cancelHold,
    },
    consume,
    ring,
  };
}
