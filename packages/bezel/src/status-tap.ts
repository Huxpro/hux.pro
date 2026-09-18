"use client";

import { STATUS_TAP_ATTRIBUTE, STATUS_TAP_PARK_PX } from "./constants";
import { getScrollContainer, onPageScroll } from "./scroll";

// =============================================================================
// Status-bar tap — the page back to the top, in container scroll.
//
// iOS Safari's tap-the-status-bar-to-scroll-to-the-top talks to the main
// WKScrollView only. WebKit sets `scrollsToTop = NO` on every overflow
// UIScrollView it creates — bug 134456, filed 2014, still what
// ScrollingTreeScrollingNodeDelegateIOS.mm does — so the bezel's scroll
// container can never be handed the gesture itself.
//
// The window can. <body> is fixed at inset 0, so the document has nothing to
// move: a few pixels of window scroll are invisible. While the page is away
// from the top, park the window a few pixels down. A status-bar tap is then
// Safari scrolling that back to 0, with no finger on the glass — which is a
// signature nothing else on the page produces. Read it, and take the container
// to the top ourselves.
//
// Everything hard about this is timing, and there are three of them:
//
//  1. Scroll events are asynchronous, and a frame can carry two of them — the
//     container's and the window's. So nothing here acts inside a scroll
//     handler. They only schedule `sync`, which runs in a rAF callback: the
//     rendering loop fires a frame's scroll events BEFORE its animation frame
//     callbacks, so by the time `sync` runs it can see both, in any order they
//     arrived. Acting inside the handlers instead means the container's
//     handler re-parks the window before the window's handler has run, and the
//     tap is swallowed — intermittently, depending on which scroller moved
//     first that frame.
//
//  2. The tap almost always lands DURING a fling. `scrollTop` written each
//     frame is then fighting momentum that the compositor is still applying,
//     and the page lurches. So the fling is ended first — one frame of
//     `overflow: hidden` drops the container out of its scrolling state — and
//     the animation re-bases itself if the container moves under it anyway.
//
//  3. The park is a REQUEST, not a move. iOS scrolls the main frame in the UI
//     process, so `window.scrollTo` is asked for on one side of a process
//     boundary and `window.scrollY` keeps reporting the old offset until the
//     answer comes back. Reading it straight afterwards and giving up cancels
//     the park that was on its way, every time, and the gesture never arms at
//     all. So the park is confirmed late, and only a confirmed park counts —
//     an unconfirmed one must never be read as a tap.
//
//  4. Being armed means <html> is not `overflow: hidden` for that time, and
//     `overflow: hidden` on <html> is exactly how an overlay library decides
//     the page is already locked and stands down (Base UI reads the computed
//     `overflow-y` of the viewport scroller). So an open sheet and an armed
//     window are mutually exclusive: the moment anything writes an inline
//     overflow onto <html>, this stands down and gives the page back, and it
//     re-arms when that clears. A park that does not stick is never fatal
//     either — it backs off and tries again.
// =============================================================================

/** A window offset at most this far down is the top. */
const AT_TOP_PX = 0.25;
/** A park that lands at least this far down counts as stuck. */
const PARKED_PX = 0.75;
/** How long the platform is given to answer a park before it is a failure. */
const PARK_CONFIRM_MS = 250;
/**
 * A container found this much FURTHER down the page than it was left was moved
 * by something else — momentum, most likely. Only that direction counts: a
 * reading that lags behind our own writes is a platform answering late, not
 * the page moving, and re-basing on it would fight nothing at all.
 */
const DRIFT_PX = 2;
/** After a touch, this long belongs to the touch, not to a status-bar tap. */
const TOUCH_GRACE_MS = 250;
/**
 * After the viewport changes, this long belongs to it. A rotation or a
 * keyboard being dismissed can take the window back to 0 on its own, and that
 * is not somebody asking for the top of the page.
 */
const VIEWPORT_GRACE_MS = 400;
/** Parks that may fail in a row before standing down for `BACKOFF_MS`. */
const FAILURE_LIMIT = 3;
const BACKOFF_MS = 5000;
/** The return never runs longer than this, whatever the frames do. */
const MAX_RETURN_MS = 1200;

const TOUCH_EVENTS = ["touchstart", "touchmove", "touchend", "touchcancel"] as const;

// The curve the chrome morph uses — cubic-bezier(0.32, 0.72, 0, 1), iOS's fast
// start and long settle. Solved here rather than handed to CSS because what
// moves is `scrollTop`, which no transition can animate.
const EASE_X1 = 0.32;
const EASE_Y1 = 0.72;
const EASE_X2 = 0;
const EASE_Y2 = 1;

function curve(t: number, p1: number, p2: number): number {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return ((a * t + b) * t + c) * t;
}

function slope(t: number, p1: number, p2: number): number {
  const c = 3 * p1;
  const b = 3 * (p2 - p1) - c;
  const a = 1 - c - b;
  return (3 * a * t + 2 * b) * t + c;
}

/** The curve's y for a fraction of its duration. */
function ease(fraction: number): number {
  let t = fraction;
  for (let i = 0; i < 6; i += 1) {
    const error = curve(t, EASE_X1, EASE_X2) - fraction;
    if (Math.abs(error) < 1e-5) break;
    const d = slope(t, EASE_X1, EASE_X2);
    if (Math.abs(d) < 1e-6) break;
    t -= error / d;
  }
  return curve(Math.min(1, Math.max(0, t)), EASE_Y1, EASE_Y2);
}

/** How long a return of `distance` px takes: a short floor, a gentle cap. */
function durationFor(distance: number): number {
  return Math.min(640, Math.max(280, 220 + Math.sqrt(Math.max(0, distance)) * 8));
}

/**
 * Whether this is a platform with the gesture at all. Everywhere else the park
 * would buy nothing and <html> is better left alone — and container scroll is
 * reachable off iOS through the devtool, so this cannot be assumed.
 */
function hasStatusBarTap(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ calls itself a Mac. The touch points give it away.
  return /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * While container scroll is on, catch a status-bar tap and take the page to
 * the top. Returns the cleanup. A no-op off iOS.
 */
export function enableStatusTapToTop(): () => void {
  if (typeof document === "undefined" || !hasStatusBarTap()) return () => {};

  const root = document.documentElement;

  /** The window is parked, and we measured that it stuck. */
  let armed = false;
  /** A return is running; it owns both scrollers until it stops. */
  let returning = false;
  let live = true;
  let touches = 0;
  let touchedAt = -Infinity;
  let resizedAt = -Infinity;
  let failures = 0;
  let quietUntil = 0;
  /** A park has been asked for and not yet answered. */
  let parkPending = 0;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let syncFrame = 0;
  let stepFrame = 0;
  let watchdog = 0;
  /** The container whose overflow is held while a fling is being ended. */
  let held: HTMLElement | null = null;
  let heldOverflow = "";

  const now = () => performance.now();
  const windowTop = () => window.scrollY || root.scrollTop || 0;
  const touchedRecently = () => touches > 0 || now() - touchedAt < TOUCH_GRACE_MS;
  const resizedRecently = () => now() - resizedAt < VIEWPORT_GRACE_MS;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /**
   * Someone else is holding <html>'s overflow — a scroll lock behind a sheet,
   * most likely. Their inline style beats the stylesheet either way, so the
   * only sane move is to stand down until it clears.
   */
  const lockedElsewhere = () => /hidden|clip/.test(root.style.overflowY || root.style.overflow);

  const forgetPendingPark = () => {
    if (!parkPending) return;
    clearTimeout(parkPending);
    parkPending = 0;
  };

  /** Give the window back: no park, and <html> reads as locked again. */
  const disarm = () => {
    armed = false;
    forgetPendingPark();
    if (windowTop() > 0) window.scrollTo(0, 0);
    root.removeAttribute(STATUS_TAP_ATTRIBUTE);
  };

  /** The park landed: from here on, a window at 0 is the gesture. */
  const confirmPark = () => {
    forgetPendingPark();
    armed = true;
    failures = 0;
  };

  /** The park never landed. Give <html> back and decide whether to retry. */
  const abandonPark = () => {
    forgetPendingPark();
    armed = false;
    root.removeAttribute(STATUS_TAP_ATTRIBUTE);
    failures += 1;
    if (failures >= FAILURE_LIMIT) {
      // Somewhere the window cannot be parked at all. Stop asking for a while
      // rather than for the session: a lock, a sheet, a rotation all pass.
      failures = 0;
      quietUntil = now() + BACKOFF_MS;
      return;
    }
    schedule();
  };

  /** Hold the window a few pixels down, so Safari has somewhere to scroll. */
  const park = () => {
    if (armed) {
      if (windowTop() >= PARKED_PX) return;
      // The park slipped — a resize, a lock that came and went. Take it again.
      armed = false;
    }
    if (parkPending) {
      // Asked for, not yet answered. The answer is a window scroll, which
      // brings us back here; until then nothing is armed, so nothing can be
      // mistaken for the gesture.
      if (windowTop() >= PARKED_PX) confirmPark();
      return;
    }
    if (now() < quietUntil) return;

    root.setAttribute(STATUS_TAP_ATTRIBUTE, "");
    // The scroll range arrives with the pseudo-element, i.e. with layout.
    void root.offsetHeight;
    window.scrollTo(0, STATUS_TAP_PARK_PX);

    // Synchronous where the main frame is scrolled in this process. On iOS it
    // is not: `scrollY` is still 0 here and the move is in flight, so keep the
    // attribute — taking it back now would cancel the park itself — and take
    // the answer when it arrives, or time out waiting for it.
    if (windowTop() >= PARKED_PX) {
      confirmPark();
      return;
    }
    parkPending = window.setTimeout(() => {
      parkPending = 0;
      if (!live) return;
      if (windowTop() >= PARKED_PX) confirmPark();
      else abandonPark();
    }, PARK_CONFIRM_MS);
  };

  /** Hand the container's overflow back, if the fling kill is still holding it. */
  const release = () => {
    if (!held) return;
    held.style.overflowY = heldOverflow;
    held = null;
    heldOverflow = "";
  };

  /** End the return, wherever the page got to, and go back to parking. */
  const stop = () => {
    returning = false;
    if (stepFrame) {
      cancelAnimationFrame(stepFrame);
      stepFrame = 0;
    }
    if (watchdog) {
      clearTimeout(watchdog);
      watchdog = 0;
    }
    release();
    schedule();
  };

  const animate = (el: HTMLElement) => {
    let from = el.scrollTop;
    if (from <= 0) {
      stop();
      return;
    }
    if (reducedMotion()) {
      el.scrollTop = 0;
      stop();
      return;
    }

    let startedAt = now();
    let span = durationFor(from);
    // What the engine kept after the last write, rounding included. Anything
    // else there next frame was put there by someone other than us.
    let written = el.scrollTop;

    const step = () => {
      stepFrame = 0;
      if (!live || !returning) return;

      const at = el.scrollTop;
      if (at - written > DRIFT_PX) {
        // Momentum that outlived the kill, or another writer. Carry on from
        // where the container actually is: yanking it back to a position that
        // stopped being true is the lurch this whole path exists to avoid.
        if (at <= 0) {
          stop();
          return;
        }
        from = at;
        startedAt = now();
        span = durationFor(from);
      }

      const t = Math.min(1, (now() - startedAt) / span);
      el.scrollTop = from * (1 - ease(t));
      written = el.scrollTop;
      if (t < 1) {
        stepFrame = requestAnimationFrame(step);
        return;
      }
      el.scrollTop = 0;
      stop();
    };

    stepFrame = requestAnimationFrame(step);
  };

  /** The gesture: take `el` to the top. */
  const startReturn = (el: HTMLElement) => {
    returning = true;
    // The window has done its job. Give it back before the page moves, so
    // nothing re-parks underneath the animation.
    disarm();

    // A fling still being applied fights every `scrollTop` written under it.
    // One frame of `overflow: hidden` drops the container out of its scrolling
    // state, which ends it; the position is untouched, and the stylesheet's
    // `overflow-y: auto` comes back next frame. It has to span a frame — set
    // and restored inside one task, the compositor never sees it.
    held = el;
    heldOverflow = el.style.overflowY;
    el.style.overflowY = "hidden";

    // Whatever the frames do — throttled, backgrounded, dropped — the page
    // does not get left half way.
    watchdog = window.setTimeout(() => {
      watchdog = 0;
      el.scrollTop = 0;
      stop();
    }, MAX_RETURN_MS);

    stepFrame = requestAnimationFrame(() => {
      stepFrame = 0;
      release();
      if (!live || !returning) return;
      animate(el);
    });
  };

  /**
   * One decision per frame, with that frame's scrolls all in. Called from a
   * rAF callback and nowhere else.
   */
  const sync = () => {
    if (!live || returning) return;

    const el = getScrollContainer();
    if (!el) {
      disarm();
      return;
    }
    if (lockedElsewhere()) {
      // Not ours for now. Drop the arming; the observer brings us back.
      armed = false;
      forgetPendingPark();
      root.removeAttribute(STATUS_TAP_ATTRIBUTE);
      return;
    }
    if (el.scrollTop <= 0) {
      // At the top there is nothing to catch, and <html> is better left locked.
      disarm();
      return;
    }
    // The signature: we parked the window, it is at 0 now, and neither a
    // finger nor the viewport put it there. Nothing else on the page scrolls
    // the document in container scroll.
    if (armed && windowTop() <= AT_TOP_PX && !touchedRecently() && !resizedRecently()) {
      startReturn(el);
      return;
    }
    park();
  };

  const onTouch = (event: TouchEvent) => {
    // Read from the event rather than counting: a touchend that never arrives
    // would otherwise disable the gesture for the rest of the session.
    touches = event.touches.length;
    touchedAt = now();
    if (returning && event.type === "touchstart") stop();
  };

  const onViewportChange = () => {
    // `resize` fires on iOS for things that are not a resize. Only a viewport
    // that actually changed size can have moved the window on its own, and
    // treating anything else as one suppresses real taps.
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width === viewportWidth && height === viewportHeight) return;
    viewportWidth = width;
    viewportHeight = height;
    resizedAt = now();
    schedule();
  };

  function schedule(): void {
    if (!live || syncFrame) return;
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      sync();
    });
  }

  const touchOptions: AddEventListenerOptions = { passive: true, capture: true };
  for (const type of TOUCH_EVENTS) document.addEventListener(type, onTouch, touchOptions);
  // Both scrollers, through the package's own subscription: the window's
  // scroll is the gesture, the container's is what arms us for it.
  const stopPageScroll = onPageScroll(schedule);
  window.addEventListener("pageshow", schedule);
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("orientationchange", onViewportChange);
  // An inline overflow appearing on <html> is a lock taking over, and one
  // disappearing is it letting go.
  const observer = new MutationObserver(schedule);
  observer.observe(root, { attributes: true, attributeFilter: ["style"] });
  schedule();

  return () => {
    live = false;
    stopPageScroll();
    observer.disconnect();
    window.removeEventListener("pageshow", schedule);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("orientationchange", onViewportChange);
    for (const type of TOUCH_EVENTS) document.removeEventListener(type, onTouch, touchOptions);
    if (syncFrame) cancelAnimationFrame(syncFrame);
    if (stepFrame) cancelAnimationFrame(stepFrame);
    if (watchdog) clearTimeout(watchdog);
    forgetPendingPark();
    syncFrame = 0;
    stepFrame = 0;
    watchdog = 0;
    returning = false;
    release();
    disarm();
  };
}
