// =============================================================================
// The fog wipe — the foggy-day easter egg.
//
// Drag a hand across the page's background while it is foggy and the mist wipes
// clear along the path, the way it does on a misted window: the sky the fog was
// hiding shows through, the hand tires as it goes, and the fog closes back over
// it. Nothing is kept — it heals, and that is the whole shape.
//
// One module per egg, which is how the other two are arranged. The strike
// (lib/strike.ts) is a tap on a thunder day; the gust (lib/wallpaper/stir.ts) is
// a drag on a rainy or snowy one. All three ask `isBackgroundClick` the same
// question about where the sky is, so they can never disagree about it, and
// `data-no-strike` keeps all three off. (It is named for a click, but it only
// ever looks at the target, and a press is the same question.)
//
// They can never both be armed, so no arbitration code exists anywhere and none
// is needed. From `deriveWeatherScene`: a fog scene carries `fog: 0.9` with no
// precipitation and `lightning: 0`; a thunder scene carries `lightning: 1` with
// `fog: 0.2`; a rain or snow scene carries precipitation with `fog` at most 0.3.
// Each egg gates on its own scalar and the three sets do not meet.
//
// This module is the part with no engine in it: how far a stroke reaches, how
// fast it gives back, how quickly the hand that draws it runs out — and the
// recognizer, `attachWipeDrag`, which decides whether a drag landed on the
// background and reports the path it took, in CSS pixels. What the mist then
// does with that path lives in `WallpaperRenderer` and `shader.ts`. The gust
// egg is arranged the same way, in `lib/wallpaper/stir.ts`.
// =============================================================================

import {
  holdCallout,
  isBackgroundPress,
  TOUCH_HOLD_MS,
  TOUCH_HOLD_SLOP_PX,
} from "./strike";

// -----------------------------------------------------------------------------
// The wipe (fog)
// -----------------------------------------------------------------------------

/**
 * How much fog a scene needs before the wipe is armed. Only the fog profile
 * (0.9) clears it; the next densest scene is drizzle at 0.3, so the gate is
 * the condition in all but name — and it is the scalar the effect acts on.
 */
export const WIPE_MIN_FOG = 0.5;

/**
 * How long one point of a stroke lives, ms — from the moment it is cleared to
 * the moment the last of it is gone. Slower than the strike on purpose: fog is
 * not an event, it is a condition, and it should reassert itself rather than
 * snap back.
 */
export const WIPE_LIFE_MS = 8000;

/**
 * How fast a cleared point gives back, as the rate of an exponential over its
 * life. There is no hold: it starts closing the instant it is made and then
 * takes a long time about it, which is a different thing from staying open and
 * then shutting.
 *
 * A stroke that sits at full strength for a while and then fades is a drawing
 * with a timer on it — you watch a finished mark, and then you watch it go. Mist
 * never lets you see a finished mark: it is taking the stroke back from the
 * first instant, and what lasts is the ghost, not the stroke. So the visible
 * life is mostly tail. At this rate a point is at 70% after a tenth of its life,
 * a third of the way in by halfway, and a faint smudge for the whole back half.
 */
export const WIPE_DECAY = 2.8;

/**
 * Where the tail is taken cleanly to nothing, as a fraction of the life. An
 * exponential never reaches zero, and a corner dropped at four per cent still
 * pops.
 */
export const WIPE_TAIL = 0.72;

/**
 * Half the width of the swath, in the shader's screen units (1.0 = the
 * viewport's height) — so a stroke is ~5.6% of the viewport height across. A
 * fingertip on a misted window, not a fist: wide enough to see through, narrow
 * enough that two strokes of a letter do not merge into one another.
 */
export const WIPE_RADIUS = 0.028;

/**
 * How far past the live corners' bounding box the swath can still reach, in the
 * same units — the margin on the shader's early-out box. A function of four of
 * the constants around it, and kept here with them so that tuning any of those
 * cannot quietly leave the box behind and clip the swath's soft edge:
 *
 *   · the widest the swath gets — `WIPE_RADIUS` times the top of the `ragged`
 *     fray, out to where the Gaussian has nothing left in it: ~0.082
 *   · the furthest the warp can push a fragment: ~0.11 at the end of a life
 *   · the furthest the wind can carry a patch over a whole life: ~0.05
 *
 * Generous on purpose. The box is only worth having because whole tiles fall on
 * one side of it, and a margin that is a little too wide costs a few tiles of
 * loop; one that is a little too narrow cuts a straight edge across the mist.
 */
export const WIPE_REACH = 0.24;

/**
 * How many corners of the path the shader carries at once. They are the corners
 * of a polyline, not a row of discs, so each one buys a whole segment of swath
 * — which is what makes the trail long enough to write with. Straight runs
 * spend one per `WIPE_MAX_GAP`; curves spend as many as they need (see
 * `WIPE_SLACK`), which is the trade that keeps a letter from coming out as a
 * polygon. The shader skips the whole loop outside the stroke's bounding box,
 * so the length costs nothing anywhere the stroke is not.
 */
export const WIPE_MAX_POINTS = 64;

/**
 * The longest a single segment may be, in screen units. Only a dead straight
 * run ever reaches it — everywhere else the curvature test below commits first.
 */
export const WIPE_MAX_GAP = 0.085;

/**
 * How far the path may bow away from the straight line the shader would draw
 * for it, before another corner is committed — measured as the difference
 * between the distance travelled and the distance covered, which is a scalar
 * either end of the segment already knows.
 *
 * This is the whole fix for a curve coming out as a polygon: spacing corners by
 * distance alone cuts every corner by however much the hand turned between two
 * of them, and it cuts a tight one worst, which is exactly where a letter is.
 * Chosen against the worst case there is — a circle, where every chord shows —
 * so the deepest facet left in a segment is a few per cent of the stroke's own
 * width, well under the amplitude of the noise that tears its edge.
 */
export const WIPE_SLACK = 0.00025;

// --- The hand tires ----------------------------------------------------------
//
// Wipe a misted window for real and you do not get to keep wiping. The hand
// cools, the finger picks up what it took off the glass, and the same stroke
// stops coming up clear — it smears. Rest a moment and it works again.
//
// Which is the difference between a wallpaper that answers you and a drawing
// board: a board's ink is the same on the hundredth stroke as on the first.
// Nothing about the swath being pretty fixes that; only running out does. It
// also settles what "long enough to write with" was always going to run into —
// you can write a word, you cannot write a paragraph, and the reason is your
// hand rather than an array bound.
//
// Spent by the distance rubbed, recovered by time off the glass, and it belongs
// to the hand rather than to a stroke: lifting between two letters does not
// give it back.

/**
 * What is left of the hand, per screen unit of path rubbed — an e-fold rate.
 * Half a screen leaves about half, one sweep across leaves a quarter, and two
 * screen-heights of path is the floor. That is the budget, and it is meant to
 * be felt inside the first stroke rather than after a few: the point of a hand
 * that tires is that you can see it tiring, which means it has to happen while
 * you are still drawing the stroke it happens to.
 */
export const WIPE_DRAIN = 0.8;

/**
 * And the floor: a hand that has had enough still smears a little, which is
 * worth seeing. Wiping and having almost nothing happen is the effect, not a
 * failure of it.
 */
export const WIPE_SPENT = 0.18;

/** How much of it comes back per second off the glass. */
export const WIPE_RECOVER = 0.3;

/**
 * How long a gap has to be before it counts as off the glass, seconds. Below it
 * the hand is still down and still working — a slow, careful stroke tires it
 * exactly as much as a fast one, because it is the rubbing that does it.
 */
export const WIPE_REST_S = 0.12;

/** A hand: what it has left, and when it last touched the glass. */
export interface WipeHand {
  charge: number;
  at: number;
}

export function freshHand(): WipeHand {
  return { charge: 1, at: 0 };
}

/**
 * Rub `travelled` screen units at `now`, and return what the hand manages —
 * 1 fresh, `WIPE_SPENT` when it has had enough.
 */
export function rub(hand: WipeHand, travelled: number, now: number): number {
  const rested = hand.at ? (now - hand.at) / 1000 - WIPE_REST_S : 0;
  if (rested > 0) {
    hand.charge = Math.min(1, hand.charge + rested * WIPE_RECOVER);
  }
  hand.at = now;
  hand.charge = Math.max(
    WIPE_SPENT,
    hand.charge * Math.exp(-Math.max(0, travelled) * WIPE_DRAIN)
  );
  return hand.charge;
}

// --- Where the mist carries it -----------------------------------------------
//
// A cleared patch is not a mark on the screen, it is a hole in something that
// is moving. It goes downwind and settles as it ages, so the old end of a
// stroke has travelled further than the new end and the stroke shears rather
// than sitting still — which is most of why the mark reads as weather and not
// as a board.
//
// All three are a displacement over the whole of one point's life, in screen
// units, and they are resolved against gravity in the renderer (`aimWipe`) the
// same way the rain's and the snow's are: the wind ACROSS gravity, the settle
// ALONG it. See "Where the weather falls".

/** How far a unit of wind carries it. */
export const WIPE_BLOW_WIND = 0.055;

/** And a little that never stops, so a dead calm is not dead still. */
export const WIPE_BLOW_STILL = 0.008;

/** How far it sinks in the same time. Mist settles; it does not just blow. */
export const WIPE_SETTLE = 0.014;

/**
 * A move longer than this is not a stroke, it is a pointer that went somewhere
 * else — a window dragged under the cursor, a capture handed back. Draw no line
 * across the screen for it; start a new stroke instead.
 */
export const WIPE_JUMP = 0.35;

/**
 * How far a mouse must travel before a press becomes a wipe, in CSS px. Below
 * it the gesture is still a click, a double-click or a word-select.
 */
export const WIPE_SLOP_PX = 10;

// --- Touch, where the page's own scroll has first claim ----------------------
//
// A finger on the sky is ambiguous — it could be a scroll — and the ambiguity
// cannot be resolved by watching which way it goes. `preventDefault` on a
// pointer event does not stop scrolling, and by the time a direction is
// readable iOS has started scrolling and will not be stopped. So the question
// has to be settled while the finger is still still.
//
// Which is a problem this site has already solved once: the widget grid picks a
// card up on a long press, precisely so a plain swipe still scrolls
// (`TOUCH_ACTIVATION` in components/ui/sortable-order.ts). The wipe uses the
// same shape and the same 400 ms, so both hands-on gestures on this site wait
// the same beat. Nothing is bound and nothing is blocked until the hold is
// good: until then the page scrolls with the browser's own fast path, which is
// the whole point of arming this way rather than taking the gesture and giving
// it back.

/**
 * How long a finger must rest on the sky before the wipe takes the gesture, and
 * how far it may drift while it does — `TOUCH_HOLD_*`, the one hold every
 * press-and-hold on this site keeps. Past the slop the gesture was a scroll all
 * along and the wipe never existed.
 */
export const WIPE_ARM_MS = TOUCH_HOLD_MS;
export const WIPE_ARM_SLOP_PX = TOUCH_HOLD_SLOP_PX;

/**
 * How long after a stroke ends a fresh touch is armed at once, ms. Writing is
 * letters, and holding for 400 ms before every stroke of every letter is not
 * writing — once a hand is clearly drawing, it keeps the gesture.
 */
export const WIPE_RESUME_MS = 1200;

/**
 * And how near the last stroke ended it has to land for that, as a fraction of
 * the viewport's height. The next stroke of a word starts about where the last
 * one finished; a flick meant for the scroller usually does not, so proximity
 * buys back most of what the open window gives away.
 */
export const WIPE_RESUME_NEAR = 0.3;

/**
 * What the Sky can be asked for. Registered by `<WeatherWallpaper />` and null
 * under every other engine, so the egg cannot half-exist — the same arrangement
 * the strike uses.
 */
export interface WipeHandle {
  /** Clear the mist at (x, y), screen space 0..1 bottom → top. Repeatedly along a stroke. */
  wipe(x: number, y: number): void;
  /** The stroke is over — the next `wipe` starts a new one, not a continuation. */
  wipeEnd(): void;
}

// -----------------------------------------------------------------------------
// The recognizer
// -----------------------------------------------------------------------------

/**
 * The most path one frame may carry, as x, y pairs — a couple of hundred
 * samples, which no real hand reaches and a stalled tab would otherwise.
 */
const MAX_PENDING = 512;

/** What a wipe gesture reports back, in client coordinates. */
export interface WipeGestureHandlers {
  /**
   * The path the hand covered since the last frame, as x, y pairs. Not one
   * position: see `sample`. The array belongs to the recognizer and is emptied
   * as soon as this returns — read it, do not keep it.
   */
  onWipe: (path: readonly number[]) => void;
  /** The stroke is over — after its last `onWipe`. */
  onEnd: () => void;
}

/**
 * The foggy-day easter egg: a drag that stays on the wallpaper wipes the mist
 * along its path. Returns the detach.
 *
 * A drag cannot use the strike's click trick, so it has to tell a wipe from a
 * scroll itself — and it cannot do that by watching which way the hand goes.
 * `preventDefault` on a pointer event does not stop scrolling; only a
 * non-passive `touchmove` does, and only before the scroll has started, which
 * on iOS means before the finger has moved at all. So on touch the question is
 * settled while the finger is still still, by a hold, exactly the way the
 * widget grid settles it (`TOUCH_ACTIVATION` in components/ui/sortable-order).
 * On a mouse there is no ambiguity and the slop is enough.
 *
 * "Is this the sky?" — the expensive question, a `getComputedStyle` per
 * ancestor — is asked once, on `pointerdown`, and never again while the hand
 * moves. The path itself is taken whole, coalesced samples and all, and handed
 * over once a frame; see `sample`.
 */
export function attachWipeDrag(handlers: WipeGestureHandlers): () => void {
  // The gesture in progress. `id` of -1 is "no hand down"; `live` means it has
  // been decided to be a wipe rather than a scroll or a stray press.
  let id = -1;
  let live = false;
  let touch = false;
  let startX = 0;
  let startY = 0;
  let atX = 0;
  let atY = 0;
  let raf = 0;
  let arming = 0;
  let selectable = "";
  /** Undoes the callout suppression put up on the way down; see `holdCallout`. */
  let freeCallout: (() => void) | null = null;
  // Where and when the last stroke ended, for the resume window.
  let endedAt = 0;
  let endedX = 0;
  let endedY = 0;
  // The path since the last frame, as x, y pairs.
  const pending: number[] = [];

  const flush = () => {
    raf = 0;
    if (live && pending.length > 0) handlers.onWipe(pending);
    pending.length = 0;
  };

  /**
   * Take the whole path, hand it over once a frame.
   *
   * A `pointermove` is not one position: the browser coalesces everything the
   * digitiser reported since the last one into it, and a pen or a trackpad
   * reports several times a frame. Keeping only the newest — which is what
   * "sample once a frame" used to mean here — throws the shape of the path
   * away and hands the renderer a frame-rate polygon to draw, so a fast curve
   * comes out as the chords between wherever the hand happened to be on each
   * frame. Every one of them goes in, in order; what to keep is the renderer's
   * decision, and it makes it by shape rather than by count.
   *
   * The *delivery* is still once a frame, because that is how often anything
   * can be drawn — and it is one call with the batch rather than one call per
   * sample, so whatever the far end has to measure it measures once. A stalled
   * frame is capped: past the ceiling the oldest samples go, since the near end
   * of the path is the part still being drawn.
   */
  const sample = (event: PointerEvent) => {
    const coalesced = event.getCoalescedEvents?.() ?? [];
    if (coalesced.length > 0) {
      for (const e of coalesced) pending.push(e.clientX, e.clientY);
    } else {
      pending.push(event.clientX, event.clientY);
    }
    if (pending.length > MAX_PENDING) {
      pending.splice(0, pending.length - MAX_PENDING);
    }
    if (!raf) raf = requestAnimationFrame(flush);
  };

  /** One position on its own — the first mark of a stroke, or a mouse tap. */
  const mark = (x: number, y: number) => {
    pending.push(x, y);
    handlers.onWipe(pending);
    pending.length = 0;
  };

  /**
   * The one thing that stops the page scrolling under a wipe — and the reason
   * the hold above has to happen first. A pointer event cannot cancel a
   * scroll; only a non-passive `touchmove` can, and only before the scroll has
   * started, which on iOS means before the finger has moved at all.
   *
   * It is attached when a stroke arms and removed the moment it ends, never
   * while one is merely possible: a non-passive `touchmove` sitting on the
   * document makes the browser wait for JS on every scroll frame, and the
   * page's own scrolling is not this egg's to slow down.
   */
  const holdScroll = (event: TouchEvent) => {
    if (live && event.cancelable) event.preventDefault();
  };

  /**
   * Once it is a wipe, the page stops selecting and scrolling under it. A hand
   * dragged across the sky would otherwise leave a blue smear of whatever text
   * it crossed — and clear whatever was already selected, since a selection
   * made before the gesture was claimed is not something the visitor asked for
   * either.
   */
  const engage = () => {
    live = true;
    const root = document.documentElement;
    selectable = root.style.userSelect;
    root.style.userSelect = "none";
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
    if (touch) {
      document.addEventListener("touchmove", holdScroll, { passive: false });
    }
    // The mist opening under the finger is the only "armed" tell there is, and
    // the only one worth having: it is the effect itself.
    mark(atX, atY);
  };

  /**
   * The end of a gesture, however it ended — and the only way out, so that the
   * listeners and the two styles put up on the way in always come back down
   * together. Harmless when there was never a gesture at all.
   */
  const release = () => {
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", onUp);
    document.removeEventListener("pointercancel", onCancel);
    if (arming) clearTimeout(arming);
    arming = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (live) {
      // Whatever the last frame did not get to belongs to THIS stroke, and it
      // has to go in before the stroke is closed. Dropping it loses the tail
      // of every stroke whose last move and release land in the same frame,
      // which on a quick lift is most of them.
      flush();
      document.documentElement.style.userSelect = selectable;
      document.removeEventListener("touchmove", holdScroll);
      handlers.onEnd();
      endedAt = performance.now();
      endedX = atX;
      endedY = atY;
    }
    // And nothing may outlive the gesture. A sample left in the queue is
    // replayed by the *next* stroke's first frame, after that stroke has
    // already begun — and since the two ends are usually nearer than
    // WIPE_JUMP, the renderer joins them: a line straight from where the next
    // touch went down back to where the last one came up.
    pending.length = 0;
    freeCallout?.();
    freeCallout = null;
    id = -1;
    live = false;
  };

  /** Is this touch the next stroke of something already being drawn? */
  const resuming = (x: number, y: number) => {
    if (!endedAt || performance.now() - endedAt > WIPE_RESUME_MS) return false;
    const near = WIPE_RESUME_NEAR * window.innerHeight;
    return Math.hypot(x - endedX, y - endedY) <= near;
  };

  const onDown = (event: PointerEvent) => {
    // A second finger is a pinch, or a scroll starting over. Either way this
    // is not one hand drawing: give the gesture back rather than fight for it.
    if (id !== -1) {
      release();
      return;
    }
    if (!event.isPrimary || !isBackgroundPress(event)) return;
    id = event.pointerId;
    touch = event.pointerType !== "mouse";
    startX = atX = event.clientX;
    startY = atY = event.clientY;
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    if (!touch) return;
    // Sit on iOS's own press gesture for the length of this touch, whether it
    // becomes a wipe or not — see `holdCallout`. Without it WebKit claims the
    // press and cancels the pointer before the hold below can finish.
    freeCallout = holdCallout();
    if (resuming(atX, atY)) engage();
    else arming = window.setTimeout(engage, WIPE_ARM_MS);
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== id) return;
    atX = event.clientX;
    atY = event.clientY;
    if (!live) {
      const travelled = Math.hypot(atX - startX, atY - startY);
      if (touch) {
        // The finger moved before the hold was good, so it was the scroller's
        // all along. Nothing was ever bound, so there is nothing to give back
        // — but the gesture still has to be closed properly, or the callout
        // suppression put up on the way down is left on the document for the
        // rest of the session.
        if (travelled > WIPE_ARM_SLOP_PX) release();
        return;
      }
      if (travelled <= WIPE_SLOP_PX) return;
      engage();
    }
    sample(event);
  };

  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== id) return;
    atX = event.clientX;
    atY = event.clientY;
    // A mouse press that never travelled is a click, and a click clears one
    // patch. On touch the hold has already done that, or nothing has.
    if (!live && !touch) {
      mark(atX, atY);
      handlers.onEnd();
    }
    release();
  };

  const onCancel = (event: PointerEvent) => {
    if (event.pointerId !== id) return;
    release();
  };

  document.addEventListener("pointerdown", onDown);
  return () => {
    document.removeEventListener("pointerdown", onDown);
    release();
  };
}
