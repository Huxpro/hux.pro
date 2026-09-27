// =============================================================================
// The sky pull — pull the home screen down to look up.
//
// The home composition sits on the ground: identifier, greeting, widgets, all
// in the lower part of the screen, with the sky above them. Pull the page down
// from the top and it all sinks — the eyes lift — and past a point the sky
// window opens (lib/sky-window.ts): the phone becomes a window onto the real
// sky, and the home steps out of the frame the way it was already going, out
// of the bottom. Swipe up and it comes back, which is looking down again.
//
// Why a pull, and not a press-and-hold (which it was, briefly):
//
//   · It is the gesture's own metaphor. Down on the page is up with the eyes;
//     nothing has to be explained for the next step to make sense.
//   · It is found the way an egg should be found. Everybody pulls the top of a
//     page down out of habit — pull-to-refresh — and the ones who do on the
//     home screen are met with something that answers.
//   · It shares nothing with the sky's other eggs. Those are all hands ON the
//     wallpaper — a tap for the strike or the meteor, a drag for the gust, a
//     hold for the fog wipe or, on a rainy or snowy day, for the tilt's offer
//     (lib/tilt-primer.ts; the two holds are never armed on the same sky) —
//     and this is the page itself moving.
//   · Detecting it needs no permission, so the ask (on WebKit) comes after the
//     visitor has already shown they want in, from the window's own sheet
//     (SkyWindowSheet — not the tilt primer, which is the rain's).
//
// While the finger pulls, the page follows it (with resistance) and a cue at
// the top says there is something up there and how far is far enough (see
// <SkyPullCue />); the sky's gradient lifts under it as a preview, while the
// sun and the moon hold still until the window has actually opened. All of it
// is driven from here without React: two CSS variables and three attributes on
// <html>, and a callback for the renderer.
//
//   --sky-pull           px the page has followed the finger down
//   --sky-pull-progress  0..1 of the way to far enough
//   [data-sky-pulling]   a finger is pulling (transitions off: follow it exactly)
//   [data-sky-armed]     far enough: letting go opens the window
//
// Touch only, and only on the system surface (see SYSTEM_SURFACE): a pull at
// the top of an article is the reader's, and the browser's.
//
// It has to claim the touch on its FIRST move, because a browser that has
// begun scrolling will not let a touchmove be cancelled after the fact — and
// cancelling is the only way to keep iOS's rubber-band and Chrome's
// pull-to-refresh from happening on top of this. So the claim is made early
// and narrowly: at the top of the page, moving down more than sideways, and
// soon after the finger landed (a finger that rested first is picking up a
// widget, TOUCH_ACTIVATION's hold).
//
// That cancelling listener is the one thing here that costs the page anything:
// while a non-passive touchmove is listened for, the browser has to ask the
// main thread before it may scroll. So it is only there while the page is at
// its top, where a pull can start at all, and taken off as soon as the page
// scrolls away. It cannot wait for the touchstart instead: whether a touch's
// moves can be cancelled is settled when the touch begins, from the listeners
// already there.
// =============================================================================

import { onPageScroll, pageScrollTop } from "vitre";
import { isBackgroundClick } from "./poke";
import { onSystemSurface } from "./tilt-primer";

/** How far the page follows at most, px — the rubber band's reach. */
const PULL_REACH = 220;
/** Followed this far, letting go opens the window, px. */
const PULL_ARM_PX = 92;
/**
 * A move that starts later than this after the finger landed belongs to the
 * widget grid's press-and-hold (400 ms), not to a pull.
 */
const CLAIM_BEFORE_MS = 320;
/** A swipe up this long, in the window, is looking back down, px. */
const RETURN_SWIPE_PX = 56;
/** How long the page takes to come back to rest after a pull, ms (globals.css). */
const PULL_RETURN_MS = 450;

/**
 * What opening the window takes, or null for "there is no window to open":
 *
 *   · `window` — readings can flow and the place is settled: just open it.
 *   · `offer`  — the sheet first: WebKit's motion gate stands (unanswered, or
 *                refused and it says so), or the window would open onto a
 *                guessed place and the sheet asks for the location in the same
 *                breath (`wantsLocation`).
 *
 * Null when the Sky is not what paints (no other engine has a sky to look
 * around), or there is no motion sensor to ask. Reduced motion is the caller's
 * to add, through `sky`: a window that follows the hand is motion.
 */
export function skyOpenAction(state: {
  sky: boolean;
  reachable: boolean;
  gated: boolean;
  denied: boolean;
  wantsLocation: boolean;
}): "window" | "offer" | null {
  if (!state.sky) return null;
  if (state.reachable) return state.wantsLocation ? "offer" : "window";
  if (state.gated || state.denied) return "offer";
  return null;
}

/** The rubber band: the page follows less and less as the pull goes on. */
function follow(dy: number): number {
  return PULL_REACH * (1 - Math.exp(-Math.max(0, dy) / PULL_REACH));
}

const root = () => document.documentElement;

/** The touch this recognizer is following, out of a list, or null. */
function touchOf(list: TouchList, id: number | null): Touch | null {
  for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
  return null;
}

/**
 * What reads the pull's variables: the home content and the search button
 * (`[data-sky-exits]`) and the cue. The variables are written on these and not
 * on <html>, so a move repaints what follows the finger instead of restyling
 * the whole document through inheritance.
 */
let painted: HTMLElement[] = [];

function paint(px: number) {
  const progress = Math.min(1, px / PULL_ARM_PX).toFixed(3);
  for (const el of painted) {
    el.style.setProperty("--sky-pull", `${px.toFixed(1)}px`);
    el.style.setProperty("--sky-pull-progress", progress);
  }
}

function claimPaint() {
  painted = [...document.querySelectorAll<HTMLElement>("[data-sky-exits], .sky-pull-cue")];
}

/** The one timer that ends a return; a new transition cancels a pending one. */
let returnTimer = 0;

/**
 * Let the page come back to rest: the pull's variables are cleared under a
 * `data-sky-returning` that keeps the transition on for the way back.
 */
export function settlePull() {
  const el = root();
  el.removeAttribute("data-sky-pulling");
  el.removeAttribute("data-sky-armed");
  el.setAttribute("data-sky-returning", "");
  claimPaint();
  paint(0);
  window.clearTimeout(returnTimer);
  returnTimer = window.setTimeout(() => el.removeAttribute("data-sky-returning"), PULL_RETURN_MS);
}

export interface SkyPullHandlers {
  /** Every move, with the fraction of the way to far enough — the sky's preview. */
  onProgress: (progress: number) => void;
  /** Let go past far enough. The page is left pulled; the caller decides what next. */
  onPulled: () => void;
}

/** Arm the pull. Returns the detach, like the sky's other recognizers. */
export function attachSkyPull(handlers: SkyPullHandlers): () => void {
  let id: number | null = null;
  let startX = 0;
  let startY = 0;
  let startAt = 0;
  /** undefined: not decided yet; true: this touch is a pull; false: it is not. */
  let claimed: boolean | undefined;
  let armed = false;

  const reset = () => {
    id = null;
    claimed = undefined;
    armed = false;
  };

  const onStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      // A second finger: whatever this was, it is a pinch now.
      if (claimed) {
        handlers.onProgress(0);
        settlePull();
      }
      reset();
      return;
    }
    const touch = event.touches[0];
    if (!onSystemSurface(event.target)) return;
    if (pageScrollTop() > 0) return;
    id = touch.identifier;
    startX = touch.clientX;
    startY = touch.clientY;
    // The event's own time, not when this handler got to run: on a busy main
    // thread (a WebGL sky is one) the two can be far apart, and a pull must
    // not be mistaken for a hold because the page was slow to hear it.
    startAt = event.timeStamp;
    claimed = undefined;
    armed = false;
  };

  const onMove = (event: TouchEvent) => {
    if (id === null) return;
    const touch = touchOf(event.changedTouches, id);
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    if (claimed === undefined) {
      // The first move decides, and has to: see the header.
      const late = event.timeStamp - startAt > CLAIM_BEFORE_MS;
      claimed = !late && dy > 0 && dy >= Math.abs(dx) && pageScrollTop() <= 0;
      if (!claimed) {
        reset();
        return;
      }
      window.clearTimeout(returnTimer);
      root().removeAttribute("data-sky-returning");
      root().setAttribute("data-sky-pulling", "");
      claimPaint();
    }
    if (!claimed) return;
    if (event.cancelable) event.preventDefault();

    const px = follow(dy);
    paint(px);
    const nowArmed = px >= PULL_ARM_PX;
    if (nowArmed !== armed) {
      armed = nowArmed;
      root().toggleAttribute("data-sky-armed", armed);
      // A tick where the platform has one: the point of no return, felt.
      if (armed) navigator.vibrate?.(8);
    }
    handlers.onProgress(Math.min(1, px / PULL_ARM_PX));
  };

  const onEnd = (event: TouchEvent) => {
    if (id === null) return;
    if (!touchOf(event.changedTouches, id)) return;
    const wasClaimed = claimed;
    const wasArmed = armed;
    reset();
    if (!wasClaimed) return;
    root().removeAttribute("data-sky-pulling");
    root().removeAttribute("data-sky-armed");
    if (wasArmed && event.type === "touchend") {
      handlers.onPulled();
    } else {
      handlers.onProgress(0);
      settlePull();
    }
  };

  // Not passive: a claimed pull cancels the browser's own rubber band and
  // pull-to-refresh, which would otherwise run underneath it. Only at the top
  // of the page, though — see the header. (Below zero is iOS's own bounce.)
  let listening = false;
  const listen = (on: boolean) => {
    if (on === listening) return;
    listening = on;
    if (on) document.addEventListener("touchmove", onMove, { passive: false });
    else document.removeEventListener("touchmove", onMove);
  };
  const onScroll = () => listen(claimed === true || pageScrollTop() <= 0);

  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchend", onEnd);
  document.addEventListener("touchcancel", onEnd);
  const stopScroll = onPageScroll(onScroll);
  onScroll();
  return () => {
    document.removeEventListener("touchstart", onStart);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("touchcancel", onEnd);
    stopScroll();
    listen(false);
    if (claimed) settlePull();
    reset();
  };
}

/**
 * In the window: a swipe up is looking back down. The page underneath is out
 * of the frame and must not scroll, so every move over the sky is cancelled —
 * but only over the sky: a sheet or the dock over it keeps its own touches.
 */
export function attachSkyReturn(onReturn: () => void): () => void {
  let id: number | null = null;
  let startX = 0;
  let startY = 0;
  let done = false;

  const onStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    if (event.touches.length !== 1 || !isBackgroundClick(event.target)) {
      id = null;
      return;
    }
    id = touch.identifier;
    startX = touch.clientX;
    startY = touch.clientY;
    done = false;
  };

  const onMove = (event: TouchEvent) => {
    if (id === null) return;
    const touch = touchOf(event.changedTouches, id);
    if (!touch) return;
    if (event.cancelable) event.preventDefault();
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (!done && -dy > RETURN_SWIPE_PX && -dy > Math.abs(dx)) {
      done = true;
      onReturn();
    }
  };

  const onEnd = () => {
    id = null;
  };

  document.addEventListener("touchstart", onStart, { passive: true });
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onEnd);
  document.addEventListener("touchcancel", onEnd);
  return () => {
    document.removeEventListener("touchstart", onStart);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onEnd);
    document.removeEventListener("touchcancel", onEnd);
  };
}
