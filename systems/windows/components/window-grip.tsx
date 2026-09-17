"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
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
// 2. A press is ours to read, an end is not. Base UI captures the pointer for
//    everything except touch (`setPointerCapture` is skipped when the event has
//    `touches`), and once it has, the release can fail to reach us at all — no
//    pointerup, no pointercancel, no lostpointercapture, at any phase, on any
//    of window / document / the popup. Base UI can end up not seeing it either
//    and leave its own `data-swiping` set.
//
// So the phase is *latched by the press and released by whichever end arrives
// first*: our own pointerup or cancel, the popup's swipe ending, the pointer
// capture being lost, or — because none of those is guaranteed — the sheet
// being put away and brought back. A state that can only be left one way is a
// state that eventually sticks, and a stuck one here means a window whose dots
// are simply missing, which is exactly what it did: the bar stayed until the
// next press, and `keepMounted` carried it into the next time the app opened.
//
// Which leaves one story: press → the pill wakes; the finger moves past a few
// pixels → the dots become the handle; the finger lifts without having moved →
// that was a tap, so open the menu.
// -----------------------------------------------------------------------------
// =============================================================================

/** How far the finger may wander and still call the press a tap. */
const TAP_SLOP = 4;

/** …and how far it must go before the pill becomes a handle. */
const DRAG_SLOP = 6;

/**
 * How long everything has to hold still before we call the gesture over
 * anyway: no pointer events of ours, and a surface that has stopped moving.
 * Long enough that a finger resting mid-drag does not trip it.
 */
const STILL_MS = 450;

/** How far the sheet is currently held from its detent, as the popup reports. */
function swipeTravel(popup: Element | null): number {
  if (!popup) return 0;
  const y = getComputedStyle(popup).getPropertyValue("--drawer-swipe-movement-y");
  return Number.parseFloat(y) || 0;
}

/** Idle · a finger on it · moving the sheet. */
type Phase = "idle" | "pressed" | "dragging";

export function WindowGrip({
  label,
  focused,
  active,
  onMenu,
}: {
  /** Accessible name — the app whose menu this opens. */
  label: string;
  /** Front-most window: the dots are the window's own indicator. */
  focused: boolean;
  /**
   * Whether the sheet this grip belongs to is up. A kept-mounted sheet keeps
   * its DOM — and would keep a half-finished gesture with it — so putting the
   * window away ends whatever the grip thought was happening.
   */
  active: boolean;
  onMenu: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const release = useRef<(() => void) | null>(null);

  const end = useCallback(() => {
    release.current?.();
    release.current = null;
    setPhase("idle");
  }, []);

  // Put away (or brought back) mid-gesture: nothing is being held any more.
  // Adjusted during render rather than in an effect — the phase is the grip's
  // answer to "what is happening", and while the sheet is not up the answer is
  // nothing (docs/react-engineering.md).
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (phase !== "idle") setPhase("idle");
  }

  // The listeners are the effectful half of the same thing, and they go when
  // this grip does.
  useEffect(() => {
    if (active) return;
    release.current?.();
    release.current = null;
  }, [active]);
  useEffect(
    () => () => {
      release.current?.();
      release.current = null;
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    release.current?.();

    const id = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    const popup = e.currentTarget.closest("[data-surface-popup]");
    let dragged = false;
    let travel = swipeTravel(popup);
    let lastActivity = performance.now();
    let raf = 0;

    const travelled = (ev: PointerEvent) =>
      Math.hypot(ev.clientX - startX, ev.clientY - startY);

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      // A move with no button down is a release we never heard about.
      if (ev.pointerType === "mouse" && ev.buttons === 0) {
        end();
        return;
      }
      lastActivity = performance.now();
      if (travelled(ev) > DRAG_SLOP) {
        dragged = true;
        setPhase("dragging");
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const tap = ev.type === "pointerup" && !dragged && travelled(ev) <= TAP_SLOP;
      end();
      if (tap) onMenu();
    };
    const onLost = (ev: Event) => {
      if ((ev as PointerEvent).pointerId === id) end();
    };
    // The popup's own account of the gesture, as a second way out: Base UI
    // sets `data-swiping` on the press and clears it when the swipe is over,
    // which it sometimes notices when we do not.
    let watchSwipe: MutationObserver | undefined;
    if (popup) {
      watchSwipe = new MutationObserver(() => {
        if (!popup.hasAttribute("data-swiping")) end();
      });
      watchSwipe.observe(popup, { attributes: true, attributeFilter: ["data-swiping"] });
    }
    // And a watchdog, because none of the above is guaranteed to arrive: a
    // surface that has stopped moving under a finger that has stopped moving
    // is a gesture that is over. This one only puts the pill back — it leaves
    // the listeners alone, so a gesture that turns out to still be going picks
    // the handle straight back up.
    const watch = () => {
      const now = swipeTravel(popup);
      if (now !== travel) {
        travel = now;
        lastActivity = performance.now();
      } else if (performance.now() - lastActivity > STILL_MS) {
        setPhase("idle");
      }
      raf = requestAnimationFrame(watch);
    };
    raf = requestAnimationFrame(watch);

    // Listening on the document in the capture phase: for touch the whole
    // gesture arrives here, and for everything else at least the press does.
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    document.addEventListener("lostpointercapture", onLost, true);

    release.current = () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      document.removeEventListener("lostpointercapture", onLost, true);
      watchSwipe?.disconnect();
    };
    setPhase("pressed");
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
