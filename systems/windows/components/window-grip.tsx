"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
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
//   • being dragged  → the dots *become* the site's grabber: the middle one
//                      stretches into the 36×4 bar as the other two collapse
//                      into it. You are moving a sheet.
//   • released       → the bar contracts and the three dots come back out of
//                      it, the same motion in reverse.
//   • receded        → dimmed with the shell while the menu stands over it.
//
// One object changing shape, not two crossfading: a bar fading in over dots
// fading out reads as a blink in both directions, and at the halfway point it
// is neither thing. Here there is nothing to cross — the middle dot is the
// bar — so the hand-off is reversible and has no midpoint to get wrong. The
// box the dots sit in is a fixed 36px either way, so the pill itself never
// changes size. All of it is CSS ("Window grip" in globals.css), keyed off one
// attribute this component sets twice a gesture.
//
// What it deliberately does NOT try to say: "you are at the top detent" and
// "let go now and it goes away". The first is what the surface's own position
// already shows; the second can't be read while detents are in play (see the
// numbered list at the top of systems/surface/sheet.tsx), and a pill that
// tries to say four things says none of them.
//
// -----------------------------------------------------------------------------
// The gesture, and what Base UI leaves us (drawer/popup, utils/useSwipeDismiss):
//
// 1. A swipe never starts from `button,a,input,select,textarea,label,
//    [role="button"]` (`DEFAULT_IGNORE_SELECTOR`), for touch and mouse alike.
//    So the pill is a <div>, its dots are inert (an indicator here, not three
//    targets), and the semantics live on the visually hidden button beside it,
//    which keyboards and screen readers get and no finger lands on.
// 2. Base UI captures the pointer on the popup and stops the event reaching
//    `window` — but not `document` in the capture phase, which still sees the
//    whole gesture. So the grip listens there: it knows the finger's own
//    movement, frame by frame, without polling anything and without asking the
//    surface how far *it* has travelled (which is not the same question: a
//    sheet with detents stands still until the swipe is recognised, and zeroes
//    its travel every time it lands on a detent mid-gesture).
//
// Which makes the whole thing one story: press → the pill wakes; the finger
// moves past a few pixels → the dots become the handle; the finger lifts
// without having moved → that was a tap, so open the menu.
// -----------------------------------------------------------------------------
// =============================================================================

/** How far the finger may wander and still call the press a tap. */
const TAP_SLOP = 4;

/** …and how far it must go before the pill becomes a handle. */
const DRAG_SLOP = 6;

/** Idle · a finger on it · moving the sheet. */
type Phase = "idle" | "pressed" | "dragging";

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
  const [phase, setPhase] = useState<Phase>("idle");

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const id = e.pointerId;
    const startY = e.clientY;
    const startX = e.clientX;
    let dragged = false;

    const moved = (ev: PointerEvent) =>
      Math.hypot(ev.clientX - startX, ev.clientY - startY);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id || dragged) return;
      if (moved(ev) > DRAG_SLOP) {
        dragged = true;
        setPhase("dragging");
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const tapped = ev.type === "pointerup" && !dragged && moved(ev) <= TAP_SLOP;
      stop();
      setPhase("idle");
      if (tapped) onMenu();
    };
    // Capture phase, on the document: Base UI takes the pointer the moment it
    // reads the press as a swipe, and from then on nothing reaches `window`.
    function stop() {
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    }

    setPhase("pressed");
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
  };

  return (
    <div className="pointer-events-none flex items-center justify-center">
      <div
        data-window-grip
        data-phase={phase}
        aria-hidden
        onPointerDown={onPointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onMenu();
        }}
        className={cn(
          // A thumb target, not a pinch of dots: the glass is this big, and
          // ::before takes the hit area wider still (see globals.css).
          pillShell(phase !== "idle", false),
          "pointer-events-auto relative justify-center px-3.5 py-2.5",
        )}
      >
        <span data-window-grip-dots>
          <TrafficDots focused={focused} interacting={phase !== "idle"} />
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
