"use client";

import { cn } from "@/lib/utils";
import { useRef } from "react";
import { pillShell, TrafficDots } from "./window-pill";

// =============================================================================
// WindowGrip — the window's pill, doing double duty as the sheet's handle
//
// A phone window is a sheet (window-sheet.tsx), and a sheet already has a
// grabber. Rather than stack a pill on top of one, the two are the same thing:
// the window's chrome — the centred cluster of traffic lights floating over
// edge-to-edge content, with nothing that reads as a title bar — is also what
// you drag the sheet by, and a tap on it opens the window's menu.
//
// It does not change. Not on press, not while the sheet is dragged, not while
// its menu is open: one pill, one ink, always there. The desktop pill wakes up
// (window-chrome.tsx) because a pointer hovers and a window can be inactive;
// a phone has neither, and this control is the only one the window has.
//
// That is the lesson of five rounds of this file, and it is worth keeping
// written down. The dots used to become the sheet's 36×4 grabber while it was
// dragged — first interpolated on the live travel (which a sheet with detents
// zeroes every time it lands on one, so it flickered), then latched by a phase
// machine here (which has to know when the gesture ended, and cannot: Base UI
// captures the pointer for everything but touch, and the release can then
// reach nothing at all — no pointerup, no pointercancel, no lostpointercapture,
// on window, document or the popup, not even for a listener installed before
// the app), then driven by the sheet's own gesture state (better, and still one
// flush of a nested drawer away from being stranded). Every version had the
// same shape: something had to *clear* the interesting state, and whatever
// clears it can be missed. A window whose controls are sometimes missing is
// worse than a handle that never changes shape, so now nothing changes shape.
//
// If it ever comes back it has to be incapable of persisting — an animation
// that always ends where it started, not a state someone has to clear.
//
// The tap is this component's one job, and it is the one thing that can be
// lost harmlessly: no menu opens, nothing sticks, the next tap works. It
// cannot be a click handler (above `Drawer.Content` there are no clicks) and
// it cannot be armPointer (its long-press would fire mid-drag, with no moves
// arriving to cancel it). A press, and a release that comes back to us a few
// pixels away, is a tap — and the menu opens *after* that release rather than
// inside it: the grip listens in the capture phase, ahead of Base UI, and
// flushing a nested drawer into the middle of the sheet's own gesture
// bookkeeping leaves the sheet believing it is still being held.
//
// Base UI also never starts a swipe from `button,a,input,select,textarea,
// label,[role="button"]` (`DEFAULT_IGNORE_SELECTOR` in utils/useSwipeDismiss),
// touch and mouse alike — so the pill is a <div>, its dots are inert (an
// indicator here, not three targets), and the semantics live on the visually
// hidden button beside it.
// =============================================================================

/** How far the finger may wander and still call the press a tap. */
const TAP_SLOP = 6;

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
  const press = useRef<{ id: number; x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY };

    // Capture phase, on the document: for touch the release arrives here, and
    // for a mouse Base UI may swallow it — in which case this press simply was
    // not a tap.
    const finish = (ev: PointerEvent) => {
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", finish, true);
      const from = press.current;
      press.current = null;
      if (!from || ev.pointerId !== from.id || ev.type !== "pointerup") return;
      if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > TAP_SLOP) return;
      // Not from inside the release: see the note at the top of the file.
      setTimeout(onMenu, 0);
    };
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
  };

  return (
    <div className="pointer-events-none flex items-center justify-center">
      <div
        data-window-grip
        aria-hidden
        onPointerDown={onPointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu();
        }}
        className={cn(
          // Lit, always: there is nothing here to wake up for. A thumb target,
          // too — the glass is this big, and ::before takes the hit area wider
          // still (see globals.css).
          pillShell(true, false),
          "pointer-events-auto relative justify-center px-3.5 py-2.5",
        )}
      >
        {/* As wide as the sheet grabber it stands in for, so the pill is a
            proper target rather than a pinch of dots. */}
        <span className="flex w-9 justify-center">
          <TrafficDots focused={focused} interacting />
        </span>
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
