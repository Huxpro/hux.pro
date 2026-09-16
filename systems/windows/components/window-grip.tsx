"use client";

import { cn } from "@/lib/utils";

// =============================================================================
// WindowGrip — the three dots and the sheet's handle, as one object
//
// A phone window is a sheet (window-sheet.tsx), and a sheet already has a
// grabber. Rather than stack a ••• pill on top of one, the two are the same
// object: one control at the top of the surface whose form, at every moment,
// answers "what happens if I touch this".
//
//   • at rest        → three dots. A target, the way a ••• is: tap for the menu.
//   • under a finger → the dots take full ink. "Got you."
//   • being dragged  → the three dots fuse into one bar — and not any bar: the
//                      exact 36×4 grabber every other sheet on the site wears,
//                      so the moment it starts moving it reads as a sheet.
//   • receded        → the shell dims it with everything else while the menu
//                      (or another sheet) stands over it: not yours right now.
//
// The morph is three spans growing into each other (widths, gaps, corners), and
// it is written in CSS — "Window grip" in globals.css — keyed off the state
// Base UI publishes on the popup (`data-swiping`), and the press state is a
// data attribute set on the node itself. Nothing here re-renders while a finger
// is down, which is the same reason window.tsx writes geometry straight to the
// DOM during a desktop drag: an iframe or a Lynx view repaints badly.
//
// What it deliberately does NOT try to say: "you are at the top detent" and
// "let go now and it goes away". The first is what the surface's own position
// already shows; the second can't be read in CSS with detents in play (see the
// numbered list at the top of systems/surface/sheet.tsx: with snap points
// `--drawer-swipe-progress` is the position *between* detents, not the way
// out), and a 36px object that tries to say four things says none of them.
//
// -----------------------------------------------------------------------------
// Two things Base UI's source decides for us here (drawer/popup, and
// utils/useSwipeDismiss.js), both found the hard way:
//
// 1. A swipe never starts from `button,a,input,select,textarea,label,
//    [role="button"]` (`DEFAULT_IGNORE_SELECTOR`), for touch and mouse alike.
//    A control that has to be draggable cannot wear those roles — so what you
//    touch is a <div>, and the semantics live on the visually hidden button
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

export function WindowGrip({
  label,
  onMenu,
}: {
  /** Accessible name — the app whose menu this opens. */
  label: string;
  onMenu: () => void;
}) {
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const grip = e.currentTarget;
    const popup = grip.closest("[data-surface-popup]");
    const id = e.pointerId;
    let timer = 0;

    const stop = () => {
      window.clearTimeout(timer);
      grip.removeAttribute("data-pressed");
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", stop, true);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const travelled = swipeTravel(popup);
      stop();
      if (travelled <= TAP_SLOP) onMenu();
    };

    grip.setAttribute("data-pressed", "");
    timer = window.setTimeout(stop, PRESS_WINDOW_MS);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", stop, true);
  };

  return (
    <div className="flex items-center justify-center">
      <div
        data-window-grip
        aria-hidden
        onPointerDown={onPointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu();
        }}
        className={cn(
          "flex cursor-default items-center justify-center px-8 py-3",
          "-my-1 select-none text-tertiary-foreground transition-colors",
        )}
      >
        <span data-window-grip-dots>
          <span />
          <span />
          <span />
        </span>
      </div>
      {/* The same control, for anyone not using a finger. */}
      <button type="button" aria-haspopup="menu" onClick={onMenu} className="sr-only">
        {label}
      </button>
    </div>
  );
}
