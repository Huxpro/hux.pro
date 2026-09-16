// =============================================================================
// The tilt primer — the offer that comes before the permission prompt.
//
// Rain and snow on the Sky fall along real gravity, so a leaned phone leans the
// weather (lib/gyroscope.ts, and "Where the weather falls" in the docs). On
// WebKit that needs `DeviceOrientationEvent.requestPermission()`, which needs a
// user gesture — and today the only place to make that gesture is the wallpaper
// picker's Weather tab, three taps from the page, describing a feature nobody
// has seen yet.
//
// So: hold a finger on a rainy or snowy background and a sheet comes up showing
// what the tilt does, with a button that then asks. Two presses, not one —
// which is the whole point and not an extra step. A permission dialog that
// arrives with no idea what it is for gets refused, and in every browser a
// refusal is final: there is no second prompt, only the site settings the
// visitor will never open. The first press buys the explanation; the second
// spends the one chance.
//
// It is offered ONCE. `weatherGyroPrimed` is set as soon as the sheet is
// answered either way, and nothing clears it. An introduction repeated is a
// nag, and this one interrupts a page the visitor came to for something else.
//
// -----------------------------------------------------------------------------
// Where it sits among the easter eggs
//
// This is not a fourth egg, whatever the sheet's own copy says. The eggs are
// rewards for poking at a sky that owes you nothing (see "The easter eggs");
// this is a feature explaining itself, and it is *armed by the absence* of
// something rather than by the presence of it — it exists only until it has
// been answered, and then never again. The copy greets it as a find because
// that is honestly how it arrives for the visitor, who went looking for
// nothing and got something; the distinction here is about lifecycle, not
// about how it feels to meet.
//
// But it shares the same page, and on a rainy day the gust egg is armed on that
// same background. They do not collide, because a gust is travel and this is
// stillness:
//
//   · A hold that does not move past WIPE-sized slop, for TOUCH_ACTIVATION's
//     400 ms, is this. The finger has gone nowhere, so `attachWindStir` has
//     reported nothing and there is no gust to take away.
//   · Any drift before that is the gust's (or the scroller's), and this one
//     stands down for the rest of the press without having taken anything.
//
// Nothing here ever calls `preventDefault`: a press that turns out to be a
// scroll must scroll, and the page's own fast path is not this module's to slow
// down. The one style it touches is iOS's callout, for the length of the press
// and put back after — see `holdCallout`, and the note on its absence being why
// this hold did not work on a phone while the wipe's did. The sheet opens on a
// `setTimeout`, which is not a user gesture — that is fine, because the gesture
// WebKit wants is the button inside the sheet.
//
// Touch only. A mouse cannot tilt anything, and the gate this exists to open is
// WebKit's, which is a phone's. And the system surface only — see
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
 * The offer is only made there, and this is why. `isBackgroundPress` asks
 * whether anything PAINTS over the wallpaper, which is the right question for
 * an easter egg and the wrong one here: a paragraph paints nothing, so on an
 * article the whole column answers "background" and a finger resting in the
 * margin — or on the prose — would put a permission sheet over what somebody
 * is reading. A long press on a document belongs to the reader; the system
 * surface is where a long press belongs to the system, and that is a property
 * the page states about itself rather than a list of routes kept in here.
 */
const SYSTEM_SURFACE = ".system-surface";

function onSystemSurface(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest(SYSTEM_SURFACE);
}

/**
 * How long the finger rests before the offer comes up, and how far it may drift
 * while it does — `TOUCH_HOLD_*`, the same hold the fog wipe arms on and the
 * same beat as the widget grid's `TOUCH_ACTIVATION`, from one definition rather
 * than from three comments promising they agree.
 */
export const TILT_PRIMER_HOLD_MS = TOUCH_HOLD_MS;
export const TILT_PRIMER_SLOP_PX = TOUCH_HOLD_SLOP_PX;

/**
 * How much precipitation counts as "there is weather to lean". The same test
 * `<WeatherWallpaper />` uses to arm the gust, and for the same reason: with
 * nothing falling there is nothing for gravity to angle.
 */
export const TILT_PRIMER_MIN_PRECIP = 0.02;

/**
 * Should the offer be made at all? Every reason is a reason not to:
 *
 *   · `primed` — it has been made once, and once is the whole design.
 *   · `gated` — there is no permission to ask for. Everywhere but WebKit the
 *     event fires freely and the sky is already tilting, so an offer would be
 *     explaining something that is not missing. (Refused counts as answered:
 *     `gated` is false once the browser has said no.)
 *   · `wished` — `weatherGyro` is off, i.e. the visitor has been to the picker
 *     and turned it off. Offering it back is arguing.
 *   · `falling` — no rain or snow, nothing to lean.
 *   · `sky` — the Sky is what paints; no other engine has drops.
 *
 * Reduced motion is the caller's to add, and it does: under it the wallpaper is
 * one still frame with no weather falling in it at all.
 */
export function shouldOfferTilt(state: {
  primed: boolean;
  gated: boolean;
  wished: boolean;
  falling: boolean;
  sky: boolean;
}): boolean {
  return (
    !state.primed && state.gated && state.wished && state.falling && state.sky
  );
}

/**
 * Hold a finger still on the background and `onHold` fires, once per press.
 * Returns the detach, the same shape `attachWindStir` and `attachWipeDrag` have.
 */
export function attachTiltPrimer(onHold: () => void): () => void {
  let id = -1;
  let startX = 0;
  let startY = 0;
  let timer = 0;
  /** This press has already made its offer; it does not get to make another. */
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
    // resting on the sky.
    if (id !== -1) {
      stand();
      return;
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
      // The offer is made, but the PRESS is not over — the finger is still
      // down, and iOS's own clock has not run out yet. Standing down here would
      // hand the callout back at 400 ms and let it come up over the sheet at
      // 500. So the suppression, and the listeners that undo it, stay until the
      // finger actually lifts.
      timer = 0;
      spent = true;
      onHold();
    }, TILT_PRIMER_HOLD_MS);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== id || spent) return;
    const travelled = Math.hypot(event.clientX - startX, event.clientY - startY);
    // It went somewhere: a scroll, or a hand stirring up a gust. Either way it
    // is not a rest, and nothing was taken that has to be given back.
    if (travelled > TILT_PRIMER_SLOP_PX) stand();
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
