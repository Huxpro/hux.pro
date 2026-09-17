"use client";

import { STATUS_TAP_ATTRIBUTE } from "./constants";
import { getScrollContainer, onPageScroll } from "./scroll";

// =============================================================================
// Status-bar tap — scroll-to-top, in container scroll.
//
// iOS Safari's tap-the-status-bar-to-scroll-to-the-top talks to the MAIN
// WKScrollView only. Overflow scrollers have scrollsToTop = NO — WebKit set
// that in 2014 (bug 134456) and still does, on every overflow UIScrollView it
// creates. The bezel's container can never receive the gesture itself.
//
// The window can. Body is already position: fixed covering the viewport, so a
// 1px window scroll is invisible. While the container is away from the top,
// park the window at 1px; a status-bar tap is Safari scrolling that 1px back
// to 0, with no touch on the page. Forward it to the container and disarm.
//
// At the top the window stays at 0 and <html> stays overflow: hidden, which is
// the lock overlay libraries look for. Arming is overflow-y: auto on <html>
// only while parked. If the park does not stick, stand down for the rest of
// the session — the page then behaves as it did before this existed.
// =============================================================================

const PARK_Y = 1;

function windowTop(): number {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function containerTop(): number {
  return getScrollContainer()?.scrollTop ?? 0;
}

function jumpContainerToTop(el: HTMLElement): void {
  // -webkit-overflow-scrolling: touch ignores scrollTop until the fling ends.
  // Overflow hidden for one frame drops the container into a non-scrolling
  // state, which kills it; then the stylesheet's overflow-y: auto returns.
  const previous = el.style.overflowY;
  el.style.overflowY = "hidden";
  el.scrollTop = 0;
  void el.offsetHeight;
  el.style.overflowY = previous;
}

/**
 * While container scroll is on, catch a status-bar tap and scroll the page
 * to the top. Returns the cleanup.
 */
export function enableStatusTapToTop(): () => void {
  const root = document.documentElement;
  let parking = false;
  let returning = false;
  let touching = 0;
  let unsupported = false;
  let failures = 0;
  let returnTimer = 0;

  const disarm = () => {
    if (root.hasAttribute(STATUS_TAP_ATTRIBUTE)) root.removeAttribute(STATUS_TAP_ATTRIBUTE);
    if (windowTop() === 0) return;
    parking = true;
    window.scrollTo(0, 0);
    parking = false;
  };

  const park = () => {
    if (unsupported || returning || parking) return;
    if (containerTop() <= 0) {
      disarm();
      return;
    }
    // Hold parking before touching overflow or scrollTop: switching
    // overflow-y to auto can fire a scroll at 0, which is not a status-bar tap.
    parking = true;
    if (!root.hasAttribute(STATUS_TAP_ATTRIBUTE)) {
      root.setAttribute(STATUS_TAP_ATTRIBUTE, "");
      void root.offsetHeight;
    }
    if (windowTop() < PARK_Y) window.scrollTo(0, PARK_Y);
    parking = false;
    if (windowTop() >= PARK_Y) {
      failures = 0;
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (unsupported || returning) return;
        if (windowTop() >= PARK_Y) {
          failures = 0;
          return;
        }
        failures += 1;
        if (failures >= 3) unsupported = true;
        disarm();
      });
    });
  };

  const finishReturn = () => {
    if (!returning) return;
    returning = false;
    if (returnTimer) {
      window.clearTimeout(returnTimer);
      returnTimer = 0;
    }
    park();
  };

  const onWindowScroll = () => {
    if (parking || touching || returning || unsupported) return;
    if (windowTop() > 0) return;
    const el = getScrollContainer();
    if (!el || el.scrollTop <= 0) return;
    returning = true;
    jumpContainerToTop(el);
    returnTimer = window.setTimeout(finishReturn, 1000);
  };

  const onPage = () => {
    if (returning) {
      if (containerTop() <= 0) finishReturn();
      return;
    }
    park();
  };

  const onTouchStart = () => {
    touching += 1;
  };
  const onTouchEnd = () => {
    touching = Math.max(0, touching - 1);
  };

  const opts: AddEventListenerOptions = { passive: true, capture: true };
  document.addEventListener("touchstart", onTouchStart, opts);
  document.addEventListener("touchend", onTouchEnd, opts);
  document.addEventListener("touchcancel", onTouchEnd, opts);
  // html overflow-y: auto makes <html> the scroll container, so the event
  // fires on the element. The viewport path still fires on the window.
  // Neither uses capture: a capturing window listener would see the
  // container's scrolls too, and treat them as a status-bar tap.
  window.addEventListener("scroll", onWindowScroll, { passive: true });
  root.addEventListener("scroll", onWindowScroll, { passive: true });
  window.addEventListener("pageshow", park);
  const stopPage = onPageScroll(onPage);
  const observer = new MutationObserver(() => {
    if (unsupported) return;
    if (containerTop() > 0 && !root.hasAttribute(STATUS_TAP_ATTRIBUTE)) park();
  });
  observer.observe(root, { attributes: true, attributeFilter: [STATUS_TAP_ATTRIBUTE, "style", "class"] });
  park();

  return () => {
    stopPage();
    observer.disconnect();
    window.removeEventListener("scroll", onWindowScroll);
    root.removeEventListener("scroll", onWindowScroll);
    window.removeEventListener("pageshow", park);
    document.removeEventListener("touchstart", onTouchStart, opts);
    document.removeEventListener("touchend", onTouchEnd, opts);
    document.removeEventListener("touchcancel", onTouchEnd, opts);
    if (returnTimer) window.clearTimeout(returnTimer);
    returning = false;
    unsupported = true;
    disarm();
  };
}
