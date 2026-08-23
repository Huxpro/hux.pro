// =============================================================================
// Page scroll lock — stop a window's scroll from chaining through to the page
//
// A window's body is someone else's app: a cross-origin <iframe> or a
// <lynx-view>. When the wheel/touch reaches the end of whatever scrolls in
// there — or the app doesn't scroll at all (Flappy Bird, a BusyWeek card) —
// the browser *chains* the leftover scroll up to the nearest ancestor scroller,
// which is the page behind the window. So flicking inside an app quietly
// scrolls the site underneath it. Native app windows never do that.
//
// For an iframe there is no way to intercept the gesture from out here: the
// wheel / touch events are dispatched inside the child frame and never reach
// this document, and (verified in Chromium) `overscroll-behavior: contain` on
// *any* ancestor on our side — the frame, its wrapper, the window, <html> —
// does not stop the chain either. What does stop it is making the page
// unscrollable for the duration: with no scroll room on the root, the leftover
// scroll has nowhere to land, while scrollers *inside* the app keep working.
//
// So: hold this lock while a window owns the pointer. It's ref-counted (two
// overlapping windows, or a window plus some other holder, nest safely) and
// toggles a class rather than inline styles, so it can't clobber — or be
// clobbered by — the body locks Radix/Vaul dialogs apply.
//
// Removing the root scrollbar would reflow the page by its width, so we hand
// the gutter to CSS as a custom property and pad it back — the page doesn't
// move a pixel (macOS overlay scrollbars report a 0 gutter and skip this).
// =============================================================================

let holders = 0;

function engage(): void {
  const html = document.documentElement;
  const gutter = window.innerWidth - html.clientWidth;
  if (gutter > 0) {
    html.style.setProperty("--window-scroll-gutter", `${gutter}px`);
  }
  html.classList.add("window-scroll-lock");
}

function release(): void {
  const html = document.documentElement;
  html.classList.remove("window-scroll-lock");
  html.style.removeProperty("--window-scroll-gutter");
}

/**
 * Take the page-scroll lock. Returns an idempotent release; the page only
 * scrolls again once every holder has let go.
 */
export function lockPageScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  holders += 1;
  if (holders === 1) engage();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders -= 1;
    if (holders === 0) release();
  };
}
