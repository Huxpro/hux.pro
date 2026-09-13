"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// =============================================================================
// usePressHold
//
// The visual half of a touch long-press. dnd-kit's TouchSensor decides *when*
// a press becomes a drag (its `delay` / `tolerance`), but says nothing while
// the finger is still down. iOS fills that silence: the pressed widget / icon
// grows slowly for the whole hold, so the visitor can see the pickup coming
// and abort it by lifting or scrolling. This hook tracks that window —
// `holding` is true from touch-down until release, a scroll, or the finger
// drifting past `tolerance` — and the element paints the grow via
// `.press-hold[data-holding]` (globals.css).
//
// Mouse presses are ignored on purpose: on a pointer the drag starts on
// movement, not on a wait, so there is nothing to foreshadow.
// =============================================================================

export interface PressHold {
  /** True while a touch/pen press is being held in place. */
  holding: boolean;
  /** Attach to the pressable element. */
  onPointerDown: (e: React.PointerEvent) => void;
  /** Props that paint the grow — spread onto the element that should scale. */
  holdProps: {
    className: string;
    "data-holding": "" | undefined;
    style: React.CSSProperties;
  };
}

export function usePressHold({
  delay,
  tolerance,
  scale = 1.03,
  enabled = true,
}: {
  /** The sensor's activation delay: the grow lasts exactly this long. */
  delay: number;
  /** Finger drift (px) that counts as a scroll and cancels the hold. */
  tolerance: number;
  /** Target scale at the end of the hold. */
  scale?: number;
  enabled?: boolean;
}): PressHold {
  const [holding, setHolding] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !e.isPrimary || e.pointerType === "mouse") return;
      cancelRef.current?.();

      const startX = e.clientX;
      const startY = e.clientY;
      const end = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", end);
        window.removeEventListener("pointercancel", end);
        window.removeEventListener("scroll", end, true);
        cancelRef.current = null;
        setHolding(false);
      };
      const onMove = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > tolerance) {
          end();
        }
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      // A scroll that starts elsewhere (momentum, another finger) also ends it.
      window.addEventListener("scroll", end, { capture: true, passive: true });
      cancelRef.current = end;
      setHolding(true);
    },
    [enabled, tolerance],
  );

  useEffect(() => () => cancelRef.current?.(), []);

  return {
    holding,
    onPointerDown,
    holdProps: {
      className: "press-hold",
      "data-holding": holding ? "" : undefined,
      style: {
        "--press-hold-duration": `${delay}ms`,
        "--press-hold-scale": scale,
      } as React.CSSProperties,
    },
  };
}
