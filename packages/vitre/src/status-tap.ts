"use client";

import { STATUS_TAP_ATTRIBUTE, STATUS_TAP_PARK_PX } from "./constants";
import { getScrollContainer, onPageScroll } from "./scroll";

// =============================================================================
// Status-bar tap — the page back to the top, in container scroll.
//
// iOS Safari's tap-the-status-bar-to-scroll-to-the-top talks to the main
// WKScrollView only. WebKit sets `scrollsToTop = NO` on every overflow
// UIScrollView it creates — bug 134456, filed 2014, still what
// ScrollingTreeScrollingNodeDelegateIOS.mm does — so Vitre's scroll
// container can never be handed the gesture itself.
//
// The window can. <body> is fixed at inset 0, so the document has nothing to
// move: a couple of pixels of window scroll are invisible. While the page is
// away from the top, park the window there. A status-bar tap is then Safari
// scrolling it back to 0, with no finger on the glass — a signature nothing
// else on the page produces. Read it, and take the container to the top.
//
// Everything hard about this is timing, and each piece of it is commented
// where it happens: `sync` (one decision per frame), `park` (the park is a
// request, not a move), `startReturn` (the fling) and `lockedElsewhere` (armed
// and locked are mutually exclusive). The README has the same four in prose.
// =============================================================================

/** A window offset at most this far down is the top. */
const AT_TOP_PX = 0.25;
/** A park that lands at least this far down counts as stuck. */
const PARKED_PX = 0.75;
/** How long the platform is given to answer a park before it did not land. */
const PARK_CONFIRM_MS = 250;
/**
 * A container found this much FURTHER down the page than it was left was moved
 * by something else — momentum, most likely. Only that direction counts: a
 * reading that lags behind our own writes is a platform answering late, not
 * the page moving, and re-basing on it would fight nothing at all.
 */
const DRIFT_PX = 2;
/**
 * After a finger lifts, or the viewport changes size, this long still belongs
 * to it. Both take the window back to 0 by themselves, and neither of them is
 * somebody asking for the top of the page.
 */
const GRACE_MS = 350;
/** The return never runs longer than this, whatever the frames do. */
const MAX_RETURN_MS = 1200;

const TOUCH_EVENTS = ["touchstart", "touchend", "touchcancel"] as const;

// The curve the chrome morph uses — cubic-bezier(0.32, 0.72, 0, 1), iOS's fast
// start and long settle. Solved here rather than handed to CSS because what
// moves is `scrollTop`, which no transition can animate. Both control points
// are constants, so the polynomials are too: x(t), dx/dt and y(t) for
// P1 = (0.32, 0.72) and P2 = (0, 1).
const xAt = (t: number) => ((1.96 * t - 1.92) * t + 0.96) * t;
const dxAt = (t: number) => (5.88 * t - 3.84) * t + 0.96;
const yAt = (t: number) => ((0.16 * t - 1.32) * t + 2.16) * t;

/** The curve's y for a fraction of its duration. */
function ease(fraction: number): number {
  // dx/dt is 5.88t² - 3.84t + 0.96: no real root, and never below 0.333 on
  // [0, 1]. Newton cannot stall on it, and five steps land inside 1e-5.
  let t = fraction;
  for (let i = 0; i < 5; i += 1) t -= (xAt(t) - fraction) / dxAt(t);
  return yAt(Math.min(1, Math.max(0, t)));
}

/** How long a return of `distance` px takes: a short floor, a gentle cap. */
function durationFor(distance: number): number {
  return Math.min(640, Math.max(280, 220 + Math.sqrt(Math.max(0, distance)) * 8));
}

/**
 * Whether this is a platform with the gesture at all. Everywhere else the park
 * buys nothing and a wheel scroll to 0 with no finger would read as a tap —
 * and container scroll is reachable off iOS through the devtool, so it cannot
 * be assumed. The same test as the site's `isIOSBrowser`, which a package with
 * no dependency on the site cannot import.
 */
function hasStatusBarTap(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
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
  /** Until when a window scroll belongs to a finger. Infinity while one is down. */
  let touchedUntil = 0;
  /** Until when it belongs to the viewport having changed size. */
  let resizedUntil = 0;
  let viewport = `${window.innerWidth}x${window.innerHeight}`;
  let parkPending = 0;
  let syncFrame = 0;
  let stepFrame = 0;
  let watchdog = 0;
  /** The container whose overflow is held while a fling is being ended. */
  let held: HTMLElement | null = null;
  let heldOverflow = "";

  const now = () => performance.now();
  const windowTop = () => window.scrollY;
  /** Something other than the status bar was just active. */
  const busy = () => now() < touchedUntil || now() < resizedUntil;

  /**
   * Someone else is holding <html>'s overflow — a scroll lock behind a sheet,
   * most likely. Being armed is what stops the page reading as locked, so
   * armed and locked are mutually exclusive, and their inline style beats the
   * stylesheet anyway. Stand down until it clears.
   */
  const lockedElsewhere = () => /hidden|clip/.test(root.style.overflowY || root.style.overflow);

  /**
   * Give the window back. `toTop` takes it there too, while the range still
   * exists to move in — a park that never landed has nothing to undo.
   */
  const disarm = (toTop = true) => {
    armed = false;
    clearTimeout(parkPending);
    parkPending = 0;
    if (toTop && windowTop() > 0) window.scrollTo(0, 0);
    root.removeAttribute(STATUS_TAP_ATTRIBUTE);
  };

  /** Hold the window a couple of pixels down, so Safari has somewhere to scroll. */
  const park = () => {
    if (armed) {
      if (windowTop() >= PARKED_PX) return;
      armed = false; // the park slipped — a resize, a lock that came and went
    }
    if (parkPending) {
      // Asked for, not answered yet. Nothing is armed until it is, so nothing
      // in the meantime can be mistaken for the gesture.
      if (windowTop() >= PARKED_PX) {
        clearTimeout(parkPending);
        parkPending = 0;
        armed = true;
      }
      return;
    }

    root.setAttribute(STATUS_TAP_ATTRIBUTE, "");
    // The scroll range arrives with the rule, i.e. with layout.
    void root.offsetHeight;
    window.scrollTo(0, STATUS_TAP_PARK_PX);

    // Synchronous where the main frame is scrolled in this process. On iOS it
    // is not: the move is a request across a process boundary and `scrollY` is
    // still 0 on this line, so keep the attribute — taking it back now cancels
    // the park itself — and take the answer when it arrives.
    if (windowTop() >= PARKED_PX) {
      armed = true;
      return;
    }
    parkPending = window.setTimeout(() => {
      parkPending = 0;
      if (!live) return;
      if (windowTop() >= PARKED_PX) armed = true;
      // Nothing to retry against, and no timer to do it on: every reason a
      // park fails — a lock, a sheet, a rotation — ends in a scroll, a
      // mutation or a resize, and each of those comes back through `sync`.
      else disarm(false);
    }, PARK_CONFIRM_MS);
  };

  /** Hand the container's overflow back, if the fling kill is still holding it. */
  const release = () => {
    if (!held) return;
    held.style.overflowY = heldOverflow;
    held = null;
  };

  /** End the return, wherever the page got to, and go back to parking. */
  const stop = () => {
    returning = false;
    cancelAnimationFrame(stepFrame);
    stepFrame = 0;
    clearTimeout(watchdog);
    watchdog = 0;
    release();
    schedule();
  };

  const animate = (el: HTMLElement) => {
    let from = el.scrollTop;
    if (from <= 0) {
      stop();
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollTop = 0;
      stop();
      return;
    }

    let startedAt = now();
    let span = durationFor(from);
    /** What the engine kept after the last write, rounding included. */
    let written = from;

    const step = () => {
      stepFrame = 0;
      if (!live || !returning) return;

      const at = el.scrollTop;
      if (at - written > DRIFT_PX) {
        // Momentum that outlived the kill. Carry on from where the container
        // actually is: yanking it back onto a curve that stopped being true is
        // the lurch this whole path exists to avoid.
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

    // Whatever the frames do — throttled, backgrounded, dropped — the page is
    // not left half way.
    watchdog = window.setTimeout(() => {
      watchdog = 0;
      el.scrollTop = 0;
      stop();
    }, MAX_RETURN_MS);

    stepFrame = requestAnimationFrame(() => {
      stepFrame = 0;
      release();
      if (live && returning) animate(el);
    });
  };

  /**
   * One decision per frame, with that frame's scrolls all in. A frame can
   * carry two of them, the container's and the window's, and the rendering
   * loop fires both BEFORE its animation frame callbacks — so deciding here
   * sees both, in whatever order they arrived. Deciding inside the handlers
   * instead lets the container's re-park the window before the window's has
   * run, and the tap is swallowed.
   */
  const sync = () => {
    const el = getScrollContainer();
    if (!el) {
      disarm();
      return;
    }
    if (lockedElsewhere()) {
      disarm(false);
      return;
    }
    if (el.scrollTop <= 0) {
      // At the top there is nothing to catch, and <html> is better left locked.
      disarm();
      return;
    }
    // The signature: we parked the window, it is at 0 now, and neither a
    // finger nor the viewport put it there.
    if (armed && windowTop() <= AT_TOP_PX && !busy()) startReturn(el);
    else park();
  };

  const onTouch = (event: TouchEvent) => {
    // Read from the event rather than counting: a touchend that never arrives
    // would otherwise disable the gesture for the rest of the session.
    touchedUntil = event.touches.length > 0 ? Infinity : now() + GRACE_MS;
    if (returning && event.type === "touchstart") stop();
  };

  const onViewportChange = () => {
    // `resize` fires on iOS for things that are not a resize. Only a viewport
    // that actually changed size can have moved the window on its own, and
    // treating anything else as one suppresses real taps.
    const size = `${window.innerWidth}x${window.innerHeight}`;
    if (size === viewport) return;
    viewport = size;
    resizedUntil = now() + GRACE_MS;
    schedule();
  };

  function schedule(): void {
    // Not during a return: it owns both scrollers, so every frame of it would
    // otherwise queue a reconcile that has nothing to do.
    if (!live || returning || syncFrame) return;
    syncFrame = requestAnimationFrame(() => {
      syncFrame = 0;
      if (live && !returning) sync();
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
    cancelAnimationFrame(syncFrame);
    cancelAnimationFrame(stepFrame);
    clearTimeout(watchdog);
    release();
    disarm();
  };
}
