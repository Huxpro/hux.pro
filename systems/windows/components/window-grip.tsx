"use client";

import { cn } from "@/lib/utils";
import { useSheetDragging } from "@/systems/surface";
import { useRef, useState } from "react";
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
// Its form answers "what happens if I touch this":
//
//   • at rest     → three dim dots on nothing at all. A target: tap for the
//                   menu, and an indicator of a window, as on the desktop.
//   • under a finger → the pill lights into glass, the dots take full ink, and
//                   a moment later they *become* the site's grabber: the middle
//                   one stretches into the 36×4 bar as the other two fold into
//                   it. You are holding a sheet.
//   • let go      → the bar contracts and the three dots come back out of it,
//                   the same motion in reverse.
//   • receded     → dimmed with the shell while the menu stands over it.
//
// One object changing shape, not two crossfading: a bar fading in over dots
// fading out reads as a blink in both directions, and halfway through it is
// neither thing. Here the middle dot *is* the bar, and the outer two only
// narrow — nothing ever fades, so there is no moment with nothing in the pill.
//
// The one thing this component does not decide is *when*: "a finger is on the
// sheet" belongs to the sheet, which publishes it (`useSheetHeld`) from the
// same attribute Base UI drives the surface's own motion with. Tracking the
// gesture here instead — which this did, through pointer listeners, a
// MutationObserver, a rAF watchdog and five ways to end — meant guessing when
// it was over, and a wrong guess left the pill stuck as a handle long after
// the sheet had settled: the dots "disappearing", sometimes until the next
// press, sometimes carried by `keepMounted` into the next time the app opened.
// A press we can see; an end we cannot (Base UI captures the pointer for
// everything but touch, and the release then reaches nothing at all, not even
// a listener installed before the app). So the shape follows the sheet, and
// the only thing left here is the tap.
//
// The tap has to be ours, and it is the one thing that can be lost harmlessly:
// no menu opens, nothing sticks, the next tap works. It cannot be a click
// handler (above `Drawer.Content` there are no clicks) and it cannot be
// armPointer (its long-press would fire mid-drag, with no moves arriving to
// cancel it). A press and the release that comes back to us, a few pixels
// apart, is a tap.
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
  // Is the sheet moving? That is the sheet's own answer (see useSheetDragging),
  // ended early by our release: Base UI keeps its flag through the settle that
  // follows a finger, which is a beat too long for something the size of a
  // pill. Whichever ends first wins, so neither can strand the shape — if our
  // release is lost (Base UI captures the pointer for everything but touch,
  // and then the up can reach nothing at all) the sheet still ends it.
  const sheetDragging = useSheetDragging();
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const [released, setReleased] = useState(false);
  const [wasDragging, setWasDragging] = useState(sheetDragging);
  if (wasDragging !== sheetDragging) {
    setWasDragging(sheetDragging);
    if (!sheetDragging && released) setReleased(false);
  }
  const dragging = sheetDragging && !released;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setReleased(false);

    // Capture phase, on the document: for touch the release arrives here, and
    // for a mouse Base UI may swallow it — in which case this press simply was
    // not a tap.
    const finish = (ev: PointerEvent) => {
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", finish, true);
      const from = press.current;
      press.current = null;
      if (from && ev.pointerId === from.id) setReleased(true);
      if (!from || ev.pointerId !== from.id || ev.type !== "pointerup") return;
      if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > TAP_SLOP) return;
      // Not in this event. We are ahead of Base UI here (capture phase), and
      // opening the menu from inside the release flushes a nested drawer into
      // the middle of the sheet's own gesture bookkeeping — which then never
      // finishes: the sheet stays "held" for good, and the pill stays a handle
      // with the dots gone. Let the release play out first.
      setTimeout(onMenu, 0);
    };
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
  };

  return (
    <div className="pointer-events-none flex items-center justify-center">
      <div
        data-window-grip
        data-phase={dragging ? "dragging" : "idle"}
        aria-hidden
        onPointerDown={onPointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu();
        }}
        className={cn(
          // A thumb target, not a pinch of dots: the glass is this big, and
          // ::before takes the hit area wider still (see globals.css).
          pillShell(dragging, false),
          "pointer-events-auto relative justify-center px-3.5 py-2.5",
        )}
      >
        <TrafficDots focused={focused} interacting={dragging} />
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
