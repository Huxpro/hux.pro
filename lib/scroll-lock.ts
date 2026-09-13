"use client";

import { useEffect } from "react";

// ---------------------------------------------------------------------------
// Scroll lock — gesture-level, NOT `body { overflow: hidden }`.
//
// `overflow: hidden` on <body> collapses the document's scrollable height.
// iOS 26 Safari's viewport/chrome compositor needs a document that is still
// scrollable: with the height collapsed it stops compositing page pixels
// behind the Liquid Glass toolbars, so the bottom search bar and the status
// bar go flat white/black and `position: fixed` overlays drift as the chrome
// resizes. It also throws away the scroll position on unlock.
//
// So the document keeps its real height and its real scroll offset, and the
// *gestures* are blocked instead: touchmove and wheel are cancelled unless
// they originate inside a subtree that opted back in.
//
// Opt a scrollable region inside a modal back in with the attribute:
//
//     <div {...SCROLL_LOCK_ALLOW}>…</div>
// ---------------------------------------------------------------------------

const ALLOW_ATTR = "data-scroll-lock-allow";

/** Spread onto an element whose subtree should still scroll while locked. */
export const SCROLL_LOCK_ALLOW = { [ALLOW_ATTR]: "" } as const;

/** Nested modals share one lock; only the outermost engages/releases it. */
let lockCount = 0;
let releaseLock: (() => void) | null = null;

function engage() {
  const root = document.documentElement;
  root.setAttribute("data-scroll-locked", "");

  const blockGesture = (event: Event) => {
    const target = event.target as Element | null;
    // `closest` is missing on text nodes and on the document itself.
    if (target?.closest?.(`[${ALLOW_ATTR}]`)) return;
    if (event.cancelable) event.preventDefault();
  };

  // Non-passive, or preventDefault is ignored and the page pans anyway.
  const options: AddEventListenerOptions = { passive: false };
  document.addEventListener("touchmove", blockGesture, options);
  document.addEventListener("wheel", blockGesture, options);

  releaseLock = () => {
    document.removeEventListener("touchmove", blockGesture, options);
    document.removeEventListener("wheel", blockGesture, options);
    root.removeAttribute("data-scroll-locked");
  };
}

export function lockScroll(): void {
  lockCount += 1;
  if (lockCount === 1) engage();
}

export function unlockScroll(): void {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;
  releaseLock?.();
  releaseLock = null;
}

/**
 * Holds a scroll lock for as long as `active` is true.
 *
 * Prefer this over touching `document.body.style.overflow` anywhere — see the
 * note at the top of this file for why that breaks iOS 26 Safari.
 */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    lockScroll();
    return unlockScroll;
  }, [active]);
}
