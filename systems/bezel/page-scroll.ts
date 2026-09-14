// =============================================================================
// Bezel — where the page scrolls.
//
// On an iOS phone with the frame up, the document itself does not scroll.
// `<body>` is `position: fixed; inset: 0; overflow: hidden` — ryOS's rule — and
// the page scrolls inside one element, `#scroll-root`, instead. Everywhere
// else the window scrolls, as it always has.
//
// Why the document has to stop: Safari collapses and re-expands its toolbar
// only when the DOCUMENT scrolls, and every collapse is a relayout and a fresh
// look at what is under the chrome. A document that never scrolls never gives
// it that chance, so the chrome, the viewport and the frame stay exactly where
// the first frame put them.
//
// Which mode applies follows `BEZEL_LOCK_CLASS` on <html>: the boot script puts
// it there before first paint when the page loads framed, and ./boot adds or
// removes it when the frame turns on or off. Every lookup here reads the class
// at call time, and `onPageScroll` listens in both places, so a subscriber
// keeps working across a switch. `#scroll-root` is always in the server
// markup and only its styles change with the class.
//
// Anything that reads or drives page scroll goes through here rather than
// `window`, or it silently reads 0 and scrolls nothing in the locked mode.
// =============================================================================

/** On <html> while the document is locked and the page scrolls in the root. */
export const BEZEL_LOCK_CLASS = "bezel-lock";
/** The element the page scrolls in while locked. Always rendered. */
export const BEZEL_SCROLL_ROOT_ID = "scroll-root";

/** The inner scroll root when the document is locked, else `null` (the window). */
export function getPageScrollRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (!document.documentElement.classList.contains(BEZEL_LOCK_CLASS)) return null;
  return document.getElementById(BEZEL_SCROLL_ROOT_ID);
}

/** How far the page is scrolled. */
export function pageScrollTop(): number {
  const root = getPageScrollRoot();
  if (root) return root.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/** The full scrollable height of the page. */
export function pageScrollHeight(): number {
  const root = getPageScrollRoot();
  return root ? root.scrollHeight : document.documentElement.scrollHeight;
}

/** The height of the visible part of the page. */
export function pageViewportHeight(): number {
  const root = getPageScrollRoot();
  return root ? root.clientHeight : window.innerHeight;
}

/** Where an element sits in the page's scrollable content, from its top. */
export function pageOffsetOf(el: Element): number {
  const root = getPageScrollRoot();
  const rootTop = root ? root.getBoundingClientRect().top : 0;
  return el.getBoundingClientRect().top - rootTop + pageScrollTop();
}

/** Scroll the page to an absolute position. */
export function scrollPageTo(top: number): void {
  const root = getPageScrollRoot();
  if (root) root.scrollTop = top;
  else window.scrollTo(0, top);
}

/**
 * Subscribe to page scroll, in whichever element it happens.
 *
 * Listens on both the window and the scroll root, because the frame can lock
 * and unlock the document while a subscriber is alive. Only the one that
 * actually scrolls fires, so a listener never runs twice for one scroll.
 */
export function onPageScroll(listener: () => void): () => void {
  const root = document.getElementById(BEZEL_SCROLL_ROOT_ID);
  window.addEventListener("scroll", listener, { passive: true });
  root?.addEventListener("scroll", listener, { passive: true });
  return () => {
    window.removeEventListener("scroll", listener);
    root?.removeEventListener("scroll", listener);
  };
}

/** Fire the page's scroll listeners without scrolling, to force a re-measure. */
export function emitPageScroll(): void {
  window.dispatchEvent(new Event("scroll"));
}
