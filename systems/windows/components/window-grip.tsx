"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { pillShell, TrafficDots } from "./window-pill";

// =============================================================================
// WindowGrip — the ••• pill and the sheet's handle, as one object
//
// A phone window is a sheet (window-sheet.tsx), and a sheet already has a
// grabber. Rather than stack a pill on top of one, the two are the same thing:
// the window's own chrome — the centred, chromeless pill of traffic lights,
// floating over edge-to-edge content exactly as it does on a desktop window,
// with nothing that reads as a title bar — doing double duty as the handle.
//
// Its form at every moment answers "what happens if I touch this":
//
//   • at rest        → three dim dots on nothing at all. A target: tap for the
//                      menu, and an indicator of a window, as on the desktop.
//   • under a finger → the pill lights into glass and the dots take full ink,
//                      the same "waking up" a dragged desktop window does.
//   • being dragged  → the dots step aside and a grabber comes out in their
//                      place, the site's own 36×4 bar: you are moving a sheet.
//   • released       → the bar goes, the dots come back.
//   • receded        → dimmed with the shell while the menu stands over it.
//
// The hand-off is the drag itself, not a switch: the dots fade as the bar grows
// in proportion to how far the surface has actually travelled, the bar landing
// full at 40px, which is Base UI's own swipe threshold — so the pill finishes
// becoming a handle exactly when the press becomes a swipe. That part is CSS
// ("Window grip" in globals.css) reading `--drawer-swipe-movement-y`, so
// nothing re-renders under the finger; only the glass is React state, twice a
// gesture, and it comes from the popup's own `data-swiping`.
//
// What it deliberately does NOT try to say: "you are at the top detent" and
// "let go now and it goes away". The first is what the surface's own position
// already shows; the second can't be read in CSS with detents in play (see the
// numbered list at the top of systems/surface/sheet.tsx: with snap points
// `--drawer-swipe-progress` is the position *between* detents, not the way
// out), and a pill that tries to say four things says none of them.
//
// -----------------------------------------------------------------------------
// Two things Base UI's source decides for us here (drawer/popup, and
// utils/useSwipeDismiss.js), both found the hard way:
//
// 1. A swipe never starts from `button,a,input,select,textarea,label,
//    [role="button"]` (`DEFAULT_IGNORE_SELECTOR`), for touch and mouse alike.
//    So the pill is a <div>, its dots are inert (they are an indicator here,
//    not three targets), and the semantics live on the visually hidden button
//    beside it, which keyboards and screen readers get and no finger lands on.
// 2. Once it decides a press is a swipe, it captures the pointer and the rest
//    of the stream never reaches us — no move, no up, and no click at all out
//    here above `Drawer.Content`. So "tap" cannot be a click handler, and it
//    cannot be armPointer either: with no moves to promote on, armPointer's
//    long-press would fire mid-drag and open the menu under the finger.
//
// What remains is exactly enough: a press we hear about, and a release we only
// hear about when the surface did not take the gesture. A release that comes
// back to us, with the popup reporting no travel, is a tap.
// -----------------------------------------------------------------------------
// =============================================================================

/** How far the surface may have travelled and still call the press a tap. */
const TAP_SLOP = 3;

/**
 * How long a press may last before we stop waiting for its release. A drag
 * Base UI swallowed never sends one, and a listener left on the window would
 * eventually catch somebody else's — a hold this long simply does nothing,
 * which is what a grabber does.
 */
const PRESS_WINDOW_MS = 1200;

/** How far the sheet has been dragged, as the popup itself reports it. */
function swipeTravel(popup: Element | null): number {
  if (!popup) return 0;
  const y = getComputedStyle(popup).getPropertyValue("--drawer-swipe-movement-y");
  return Math.abs(Number.parseFloat(y) || 0);
}

/**
 * Whether the sheet this grip belongs to is under a finger. Base UI publishes
 * it on the popup from the press onwards (before anything has moved), which is
 * exactly when the pill should light up — so the pill reads the library's state
 * rather than keeping a second one of its own.
 */
function useSwiping(ref: React.RefObject<HTMLElement | null>): boolean {
  const [swiping, setSwiping] = useState(false);

  useEffect(() => {
    const popup = ref.current?.closest("[data-surface-popup]");
    if (!popup) return;
    const sync = () => setSwiping(popup.hasAttribute("data-swiping"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(popup, { attributes: true, attributeFilter: ["data-swiping"] });
    return () => observer.disconnect();
  }, [ref]);

  return swiping;
}

export function WindowGrip({
  label,
  focused,
  onMenu,
}: {
  /** Accessible name — the app whose menu this opens. */
  label: string;
  /** Front-most window: the dots are the window's own indicator. */
  focused: boolean;
  onMenu: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const swiping = useSwiping(ref);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const grip = e.currentTarget;
    const popup = grip.closest("[data-surface-popup]");
    const id = e.pointerId;
    let timer = 0;

    const stop = () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", stop, true);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const travelled = swipeTravel(popup);
      stop();
      if (travelled <= TAP_SLOP) onMenu();
    };

    timer = window.setTimeout(stop, PRESS_WINDOW_MS);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", stop, true);
  };

  return (
    <div className="pointer-events-none flex items-center justify-center">
      <div
        ref={ref}
        data-window-grip
        aria-hidden
        onPointerDown={onPointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu();
        }}
        className={cn(
          pillShell(swiping, false),
          "pointer-events-auto relative justify-center",
        )}
      >
        <span data-window-grip-dots>
          <TrafficDots focused={focused} interacting={swiping} />
        </span>
        {/* The grabber, in the dots' place. Absolute so it costs no width
            until it is there; the dots' box is what widens the pill. */}
        <span data-window-grip-bar />
      </div>
      {/* The same control, for anyone not using a finger. */}
      <button
        type="button"
        aria-haspopup="menu"
        onClick={onMenu}
        className="pointer-events-auto sr-only"
      >
        {label}
      </button>
    </div>
  );
}
