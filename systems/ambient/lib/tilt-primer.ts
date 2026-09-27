// =============================================================================
// The sky hold — a finger resting on the home sky, in any weather.
//
// It opens the sky window (lib/sky-window.ts): the phone becomes a window onto
// the real sky, aimed by its compass and its tilt, with the sun and the moon
// where they really are. A second hold closes it again. That is the egg, and
// like the others it is a reward for poking at a sky that owes you nothing —
// unlike them it is not tied to a weather, because every sky has a sun or a
// moon somewhere in it, and the window is how you go and find them.
//
// On WebKit it has a gate to pass first: motion is behind
// `DeviceOrientationEvent.requestPermission()`, which needs a user gesture —
// so there the hold brings up a sheet showing what the window does, with a
// button under it that asks. Two presses, not one, and that is the whole point
// rather than an extra step: a permission dialog that arrives with no idea what
// it is for gets refused, and in every browser a refusal is final — there is
// no second prompt, only the site settings the visitor will never open. The
// first press buys the explanation; the second spends the one chance. Once the
// gate is passed, a hold is just the window, both ways.
//
// A hold where the gate has already been refused brings up the same sheet,
// saying so and where to undo it — a hold that silently did nothing would be
// the one answer that explains nothing.
//
// -----------------------------------------------------------------------------
// Where it sits among the other gestures on the sky
//
// It shares the background with the gust (rain and snow) and the fog wipe, and
// does not collide with either, because a gust is travel and this is stillness:
//
//   · A hold that does not move past the slop, for the hold's length, is this.
//     The finger has gone nowhere, so `attachWindStir` has reported nothing and
//     there is no gust to take away.
//   · Any drift before that is the gust's (or the scroller's, or the wipe's),
//     and this one stands down for the rest of the press without having taken
//     anything.
//
// The wipe arms on a hold of its own — the same TOUCH_HOLD_MS — so on a fog day
// this one waits longer (`SKY_HOLD_FOG_MS`): a finger that rests on the mist
// wipes a patch of it at 400 ms, and one that is STILL resting a second later
// meant something else.
//
// Nothing here ever calls `preventDefault`: a press that turns out to be a
// scroll must scroll, and the page's own fast path is not this module's to slow
// down. The one style it touches is iOS's callout, for the length of the press
// and put back after — see `holdCallout`, and the note on its absence being why
// this hold did not work on a phone while the wipe's did. The sheet opens on a
// `setTimeout`, which is not a user gesture — that is fine, because the gesture
// WebKit wants is the button inside the sheet.
//
// Touch only. A mouse cannot point a phone at the sky (the devtool's Sky module
// drives the window by hand instead). And the system surface only — see
// SYSTEM_SURFACE below: a long press on a document is the reader's.
// =============================================================================

import {
  holdCallout,
  isBackgroundPress,
  TOUCH_HOLD_MS,
  TOUCH_HOLD_SLOP_PX,
} from "./poke";

/**
 * The page that has declared itself one OS composition rather than a document
 * — the home screen (`app/globals.css`, "System surface"; `app/home-view.tsx`).
 *
 * The hold is only answered there, and this is why. `isBackgroundPress` asks
 * whether anything PAINTS over the wallpaper, which is the right question for
 * an easter egg and the wrong one here: a paragraph paints nothing, so on an
 * article the whole column answers "background" and a finger resting in the
 * margin — or on the prose — would put a permission sheet, or a sky that
 * swings with the hand, behind what somebody is reading. A long press on a document belongs to the reader; the system
 * surface is where a long press belongs to the system, and that is a property
 * the page states about itself rather than a list of routes kept in here.
 */
const SYSTEM_SURFACE = ".system-surface";

function onSystemSurface(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(SYSTEM_SURFACE);
}

/**
 * How long the finger rests before the window opens, and how far it may drift
 * while it does — `TOUCH_HOLD_*`, the same hold the fog wipe arms on and the
 * same beat as the widget grid's `TOUCH_ACTIVATION`, from one definition rather
 * than from three comments promising they agree.
 */
export const SKY_HOLD_MS = TOUCH_HOLD_MS;
export const SKY_HOLD_SLOP_PX = TOUCH_HOLD_SLOP_PX;

/**
 * On a fog day the wipe owns the first 400 ms of a resting finger, so the
 * window waits until the finger has plainly stayed put past it.
 */
export const SKY_HOLD_FOG_MS = 1000;

/**
 * What a hold on the sky does, or null for nothing at all:
 *
 *   · `window` — readings can flow: open (or close) the window.
 *   · `offer`  — WebKit's gate stands, unanswered or refused: the sheet, which
 *                asks (or says it was refused and where to undo it).
 *
 * Every reason for null is a reason there is no window to open: the Sky is not
 * what paints (no other engine has a sky to look around), or there is no
 * motion sensor here at all. Reduced motion is the caller's to add, and it
 * does — through `sky`: a window that follows the hand is motion.
 */
export function skyHoldAction(state: {
  sky: boolean;
  reachable: boolean;
  gated: boolean;
  denied: boolean;
}): "window" | "offer" | null {
  if (!state.sky) return null;
  if (state.reachable) return "window";
  if (state.gated || state.denied) return "offer";
  return null;
}

/**
 * Hold a finger still on the background and `onHold` fires, once per press.
 * Returns the detach, the same shape `attachWindStir` and `attachWipeDrag` have.
 */
export function attachSkyHold(
  onHold: () => void,
  holdMs: number = SKY_HOLD_MS
): () => void {
  let id = -1;
  let startX = 0;
  let startY = 0;
  let timer = 0;
  /** This press has already been answered; it does not get another. */
  let spent = false;
  /** Undoes the callout suppression put up on the way down. */
  let freeCallout: (() => void) | null = null;

  /**
   * The end of a press, however it ended — and the only way out, so what was
   * put up on the way down always comes back down. Harmless when there was
   * never a press at all.
   */
  const stand = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
    id = -1;
    spent = false;
    freeCallout?.();
    freeCallout = null;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onEnd);
    document.removeEventListener("pointercancel", onEnd);
  };

  const onDown = (event: PointerEvent) => {
    // A second finger is a pinch or a scroll starting over — not one hand
    // resting on the sky. But a new PRIMARY pointer means the last one is gone
    // and its lift never reached us (swallowed on the way up, or lost with the
    // page's focus); that press is stale, and this one is a fresh start rather
    // than a second finger — without this, every such loss ate the next hold.
    if (id !== -1) {
      stand();
      if (!event.isPrimary) return;
    }
    if (event.pointerType === "mouse") return;
    if (!event.isPrimary || !isBackgroundPress(event)) return;
    if (!onSystemSurface(event.target)) return;
    id = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd);
    document.addEventListener("pointercancel", onEnd);
    // Before the hold, not after: iOS claims a resting finger for its own press
    // gesture at around 500 ms and cancels the pointer on the way, which lands
    // on top of this timer. The fog wipe has done this since it shipped, and it
    // is the difference between a hold that works on a phone and one that does
    // not.
    freeCallout = holdCallout();
    timer = window.setTimeout(() => {
      // The hold is answered, but the PRESS is not over — the finger is still
      // down, and iOS's own clock has not run out yet. Standing down here would
      // hand the callout back at 400 ms and let it come up over the sheet at
      // 500. So the suppression, and the listeners that undo it, stay until the
      // finger actually lifts.
      timer = 0;
      spent = true;
      onHold();
    }, holdMs);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== id || spent) return;
    const travelled = Math.hypot(event.clientX - startX, event.clientY - startY);
    // It went somewhere: a scroll, or a hand stirring up a gust. Either way it
    // is not a rest, and nothing was taken that has to be given back.
    if (travelled > SKY_HOLD_SLOP_PX) stand();
  };

  const onEnd = (event: PointerEvent) => {
    if (event.pointerId !== id) return;
    stand();
  };

  document.addEventListener("pointerdown", onDown);
  return () => {
    document.removeEventListener("pointerdown", onDown);
    stand();
  };
}
