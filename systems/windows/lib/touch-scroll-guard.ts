import { lockPageScroll } from "./page-scroll-lock";

// =============================================================================
// Touch scroll guard — who owns the scroll when there's nothing to hover
//
// A pointer tells us where it is at all times, so a window can simply take the
// page-scroll lock while the cursor is inside it (see window.tsx). Touch can't:
// a finger landing inside a cross-origin iframe fires *no* event in this
// document — the one gesture we most need to know about is the one we can't
// see. Hovering isn't a thing either.
//
// So the belief is inverted. While a window is open we hold the lock by
// default — an unseen touch is assumed to be inside the app, where its leftover
// scroll must not chain through to the page. Every gesture we *can* see tells
// us exactly where it landed, and one that landed outside every window belongs
// to the page: hand the lock back for its duration, so swiping (or wheeling)
// outside a window scrolls the site normally. Once that scroll settles —
// counting momentum, which outlives the finger — we take the lock back and are
// ready for the next invisible one.
// =============================================================================

/** Quiet time after a hand-back gesture before the guard takes the lock back. */
const SETTLE_MS = 150;

/** Start guarding; returns a teardown that also releases the lock. */
export function guardTouchPageScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  let held: (() => void) | null = lockPageScroll();
  let settleTimer = 0;
  let torndown = false;

  const take = () => {
    if (!torndown && !held) held = lockPageScroll();
  };
  const handBack = () => {
    held?.();
    held = null;
  };
  const settle = () => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(take, SETTLE_MS);
  };

  // A gesture that reached this document — so we know where it is. Inside a
  // window's own DOM (chrome, a Lynx card): keep the lock. Anywhere else: the
  // page owns this one.
  const onGesture = (e: Event) => {
    const target = e.target;
    if (target instanceof Element && target.closest("[data-window]")) return;
    window.clearTimeout(settleTimer);
    handBack();
    // A wheel has no end event; let the settle timer close it out instead.
    if (e.type === "wheel") settle();
  };

  const onGestureEnd = () => settle();
  // Momentum keeps scrolling after the finger lifts — every frame of it pushes
  // the hand-back out, so the lock returns only once the page is truly still.
  const onScroll = () => {
    if (!held) settle();
  };

  document.addEventListener("touchstart", onGesture, { passive: true, capture: true });
  document.addEventListener("wheel", onGesture, { passive: true, capture: true });
  document.addEventListener("touchend", onGestureEnd, { passive: true });
  document.addEventListener("touchcancel", onGestureEnd, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    torndown = true;
    window.clearTimeout(settleTimer);
    document.removeEventListener("touchstart", onGesture, { capture: true });
    document.removeEventListener("wheel", onGesture, { capture: true });
    document.removeEventListener("touchend", onGestureEnd);
    document.removeEventListener("touchcancel", onGestureEnd);
    window.removeEventListener("scroll", onScroll);
    handBack();
  };
}
