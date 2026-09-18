"use client";

import { cn } from "@/lib/utils";
import { useRef, useState } from "react";
import { PillTitle, pillShell, TrafficDots } from "./window-pill";

// =============================================================================
// WindowGrip — the window's pill, doing double duty as the sheet's handle
//
// A phone window is a sheet (window-sheet.tsx), and a sheet already has a
// grabber. Rather than stack a pill on top of one, the two are the same thing:
// the window's chrome — the centred cluster of traffic lights floating over
// edge-to-edge content, with nothing that reads as a title bar — is also what
// you drag the sheet by, and a tap on it opens the window's menu.
//
// It looks exactly like the pill always has (window-pill.tsx): chromeless at
// rest with three dim dots, lighting into glass under a thumb and while its
// menu stands open. That light *is* the tap feedback, and always was; CSS has
// no way to give it here, measured both ways — a touch never sets `:active`
// (the grip is `touch-none` and the press is preventDefaulted out from under
// it), and a mouse press sets it and then never clears it, because the popup
// captures the pointer and Chrome never sees the release.
//
// So the lit state is ours, and it is built to be *safe when stranded*, which
// is the whole lesson of this file. Neither of its two states can hide the
// window's controls: lit is glass with bright dots, rest is the pill the
// desktop wears, and a press that never reports its release leaves the pill
// looking pressed — which is merely wrong, never missing. That is the bar
// anything here has to clear.
//
// What used to fail it: the dots became the sheet's 36×4 grabber while it was
// dragged — first interpolated on the live travel (which a sheet with detents
// zeroes every time it lands on one, so it flickered), then latched by a phase
// machine here (which has to know when the gesture ended, and cannot: Base UI
// captures the pointer for everything but touch, and the release can then
// reach nothing at all — no pointerup, no pointercancel, no lostpointercapture,
// on window, document or the popup, not even for a listener installed before
// the app), then driven by the sheet's own gesture state (better, and still one
// flush of a nested drawer away from being stranded). Every version had the
// same shape: something had to *clear* the interesting state, and whatever
// clears it can be missed — and what it cleared was the controls themselves.
//
// If the morph comes back it has to be incapable of persisting: an animation
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
// indicator here, not three targets, which also keeps a press landing on a
// 6px dot from being refused as a swipe), and the semantics live on the
// visually hidden button beside it.
//
// The one thing the phone pill does not share with the desktop's is its target:
// `::before` (globals.css) takes the hit area well past the glass, because this
// pill is also a handle and the glass is small. That is a target, not a look —
// nothing about it is visible.
// =============================================================================

/** How far the finger may wander and still call the press a tap. */
const TAP_SLOP = 6;

/**
 * How long the pill stays lit when the release never comes back. Touch always
 * reports one; a captured mouse may not, and a pill lit a moment too long is
 * the harmless end of being wrong.
 */
const PRESS_TIMEOUT = 4000;

export function WindowGrip({
  label,
  focused,
  menuOpen,
  onMenu,
}: {
  /** Accessible name — the app whose menu this opens. */
  label: string;
  /** Front-most window: the dots are the window's own indicator. */
  focused: boolean;
  /** Its menu is open — the pill stays lit under it, as the desktop's does. */
  menuOpen: boolean;
  onMenu: () => void;
}) {
  const press = useRef<{ id: number; x: number; y: number } | null>(null);
  const [pressed, setPressed] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setPressed(true);
    const done = () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", finish, true);
      setPressed(false);
    };
    const timer = window.setTimeout(done, PRESS_TIMEOUT);

    // Capture phase, on the document: for touch the release arrives here, and
    // for a mouse Base UI may swallow it — in which case this press simply was
    // not a tap, and the timer above takes the light back.
    const finish = (ev: PointerEvent) => {
      const from = press.current;
      press.current = null;
      done();
      if (!from || ev.pointerId !== from.id || ev.type !== "pointerup") return;
      if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > TAP_SLOP) return;
      // Not from inside the release: see the note at the top of the file.
      setTimeout(onMenu, 0);
    };
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
  };

  const lit = pressed || menuOpen;

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
          // The desktop pill exactly, minus its hover: a phone has none, and a
          // press is the only thing that wakes this one.
          pillShell(lit, false),
          "pointer-events-auto relative",
        )}
      >
        <TrafficDots focused={focused} interacting={lit} />
        {/* Never revealed without a hover — but it is what makes the pill the
            shape it is. See PillTitle. */}
        <PillTitle>{label}</PillTitle>
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
