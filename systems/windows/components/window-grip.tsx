"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { TAP_SLOP } from "../lib/pointer";
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
// The shape follows the same bar, and that is the sixth version of it. Under a
// drag the pill draws itself in — padding and dot gaps closing, 48×28.5 down to
// 36×20.5, the width of the site's grabber — so it reads as something you are
// holding rather than something you might tap. The rule it obeys is the one
// above: its *tucked* state is a window's controls too. Three dots, full ink, a
// target that does not move with it (the target is a fixed box, not an inset —
// globals.css). Strand it and you have a slightly squat pill, not a window with
// nothing on it.
//
// It lives entirely in CSS, off a length. Base UI publishes the live drag, the
// sheet re-publishes it as `--surface-travel`, and every dimension is a
// `clamp()` away from rest — so there is no state to set and none to clear,
// and a tap (no travel) never starts down the road to being a handle.
//
// What used to fail: the dots *became* the 36×4 bar, and then had to be turned
// back into dots. First interpolated on the live travel — under a note saying a
// sheet with detents zeroes that at every landing, which this round finally
// measured and found false; the real flicker was elsewhere. Then latched by a
// phase machine here, which has to know when the gesture ended, and cannot:
// Base UI captures the pointer for everything but touch, and the release can
// then reach nothing at all — no pointerup, no pointercancel, no
// lostpointercapture, on window, document or the popup, not even for a listener
// installed before the app. Then driven by the sheet's own published gesture
// state: better, and still one flush of a nested drawer away from stranding.
// Every version had the same shape, and it was never really about the signal —
// something had to *clear* a state, whatever clears it can be missed, and what
// it cleared was the controls themselves. The fix was not a better signal. It
// was a morph with nothing to hide.
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
  const [pressed, setPressed] = useState(false);
  // Whatever the press in flight left running. A press whose release never
  // comes back is the normal case here, not the edge one, so the next press
  // and the unmount both have to be able to clean up after it — otherwise a
  // second finger, or a Close from the menu, leaves a document listener and a
  // timer behind for four seconds.
  const teardown = useRef<(() => void) | null>(null);
  useEffect(() => () => teardown.current?.(), []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    teardown.current?.();
    const from = { id: e.pointerId, x: e.clientX, y: e.clientY };
    setPressed(true);

    const done = () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", finish, true);
      teardown.current = null;
      setPressed(false);
    };
    const timer = window.setTimeout(done, PRESS_TIMEOUT);

    // Capture phase, on the document: for touch the release arrives here, and
    // for a mouse Base UI may swallow it — in which case this press simply was
    // not a tap, and the timer above takes the light back.
    const finish = (ev: PointerEvent) => {
      done();
      if (ev.pointerId !== from.id || ev.type !== "pointerup") return;
      if (Math.hypot(ev.clientX - from.x, ev.clientY - from.y) > TAP_SLOP) return;
      // Not from inside the release: see the note at the top of the file.
      setTimeout(onMenu, 0);
    };
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
    teardown.current = done;
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
