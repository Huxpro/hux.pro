"use client";

import { useEffect, type RefObject } from "react";

// =============================================================================
// useSheetAxisLock — a sideways scroller inside a bottom sheet, with one owner
// per gesture.
//
// A finger on a horizontal track in a sheet is claimed twice: the browser pans
// the track, and Base UI drags the sheet. Base UI arbitrates between them
// (DrawerViewport.js, `shouldYieldTouchMove`), but it waits for 6px on one
// axis before it decides, and until then leaves every touchmove alone. On iOS
// that is too late for a diagonal swipe: the native pan has already begun by
// the time Base UI gives the gesture to the sheet, its `preventDefault()` no
// longer stops the pan, and the track and the sheet move together. On release
// the sheet springs back under a track that is mid-snap, and the snap strands
// between two pages.
//
// So the track decides first, at 3px of travel, by the angle of the drag:
//
//   sideways   the track's. The gesture's touchmoves stop at the window
//              (capture, before Base UI's listener on the document), so the
//              sheet never hears of it and never moves.
//   upright    the sheet's. The touchmove is cancelled from here on, so the
//              browser never starts the track's pan; Base UI sees it as
//              before and drags the sheet. When a vertical scroller holds the
//              track (a sheet taller than its content allows), the drag is left
//              to that scroller, which Base UI already arbitrates on its own.
//
// Only for a sheet — a drawer that travels down. A panel travels sideways,
// and there the track and the drawer share an axis.
// =============================================================================

/** Travel (px) after which the gesture belongs to one axis for good. */
const LOCK_SLOP = 3;

type Owner = "pending" | "track" | "sheet";

/** Nearest vertical scroller between the track and the popup, if any. */
function verticalScroller(from: HTMLElement): HTMLElement | null {
  let node = from.parentElement;
  while (node && !node.hasAttribute("data-surface-popup")) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export function useSheetAxisLock(
  trackRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): void {
  useEffect(() => {
    const track = trackRef.current;
    if (!enabled || !track) return;

    let gesture: { x: number; y: number; owner: Owner; scroller: HTMLElement | null } | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      gesture =
        e.touches.length === 1 && t
          ? { x: t.clientX, y: t.clientY, owner: "pending", scroller: verticalScroller(track) }
          : null;
    };

    const onMove = (e: TouchEvent) => {
      const g = gesture;
      const t = e.touches[0];
      if (!g || !t || e.touches.length !== 1) return;
      if (g.owner === "pending") {
        const dx = Math.abs(t.clientX - g.x);
        const dy = Math.abs(t.clientY - g.y);
        if (Math.hypot(dx, dy) < LOCK_SLOP) return;
        g.owner = dx > dy ? "track" : "sheet";
      }
      if (g.owner === "track") {
        e.stopPropagation();
      } else if (!g.scroller && e.cancelable) {
        e.preventDefault();
      }
    };

    const onEnd = () => {
      gesture = null;
    };

    track.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { capture: true, passive: false });
    window.addEventListener("touchend", onEnd, { capture: true });
    window.addEventListener("touchcancel", onEnd, { capture: true });
    return () => {
      track.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove, { capture: true });
      window.removeEventListener("touchend", onEnd, { capture: true });
      window.removeEventListener("touchcancel", onEnd, { capture: true });
    };
  }, [trackRef, enabled]);
}
