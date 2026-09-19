"use client";

import { useEffect, useState } from "react";

/**
 * Latch a one-way "has been needed" flag.
 *
 * Idle chrome (command palette, sheets, theater overlays, windows) should stay
 * out of the first paint, then stay mounted after the first open so close
 * animations and player hosts survive. Returning `signal || armed` means the
 * first open mounts children in the same commit the signal flips — refs are
 * attached before parent effects run.
 */
export function useArmed(signal: boolean): boolean {
  const [armed, setArmed] = useState(signal);
  if (signal && !armed) {
    setArmed(true);
  }
  return armed || signal;
}

/**
 * Run `fn` after the first paint, then (when the browser allows) on idle.
 * Used to keep WebGL / prefetch / auto-rotation off the TTI critical path.
 */
export function afterFirstPaint(fn: () => void, idleTimeout = 1500): () => void {
  let cancelled = false;
  let idleHandle: number | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let innerRaf = 0;

  const outerRaf = requestAnimationFrame(() => {
    innerRaf = requestAnimationFrame(() => {
      if (cancelled) return;
      const run = () => {
        if (!cancelled) fn();
      };
      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(run, { timeout: idleTimeout });
      } else {
        timeoutHandle = setTimeout(run, 200);
      }
    });
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(outerRaf);
    cancelAnimationFrame(innerRaf);
    if (
      idleHandle !== undefined &&
      typeof window.cancelIdleCallback === "function"
    ) {
      window.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  };
}

/** `true` once `afterFirstPaint` has fired, or immediately when `enabled` is false. */
export function useAfterFirstPaint(enabled = true): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled || ready) return;
    return afterFirstPaint(() => {
      setReady(true);
    });
  }, [enabled, ready]);

  return !enabled || ready;
}
