// =============================================================================
// holdScrollGestures — keep the page still under an overlay, without making
// the document unscrollable
//
// The reflex for a fullscreen overlay is `document.body.style.overflow =
// "hidden"`. On iOS 26 that's the trigger for the Liquid Glass viewport bug:
// with nothing to scroll, Safari's toolbars have no real content to composite
// against and fall back to a flat white / black band behind the search bar and
// the status area. The document has to stay scrollable — so block the gestures
// inside the overlay shell instead.
//
// A wheel or touch drag that no scroller *inside* the overlay can consume is
// cancelled outright, so it never chains out to the page. Scrollable content
// within the overlay (a result list, a caption block) keeps working, including
// at its ends: the check is direction-aware, so hitting the bottom of a list
// stops there instead of handing the rest to the page.
//
// Cross-origin iframes inside the overlay are the known gap — their events are
// dispatched in the child document and never reach us (see
// systems/windows/lib/page-scroll-lock.ts for the case where that gap has to be
// closed and what it costs).
// =============================================================================

/** Can something between `start` and the shell root take `dy` pixels of scroll? */
function consumedInside(start: EventTarget | null, root: Element, dy: number): boolean {
  let node = start instanceof Element ? start : null;

  while (node && node !== root && node !== document.body && node !== document.documentElement) {
    const style = getComputedStyle(node);
    const scrollable =
      /(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1;

    if (scrollable) {
      const atTop = node.scrollTop <= 0;
      const atEnd = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
      // Room left in the direction being scrolled — let the browser have it.
      if (dy < 0 ? !atTop : !atEnd) return true;
    }

    node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host ?? null);
  }
  return false;
}

/**
 * Hold the page still for gestures inside `root` (the overlay shell, or the
 * document when the overlay spans several fixed layers). Returns a teardown.
 */
export function holdScrollGestures(root: HTMLElement | Document = document): () => void {
  if (typeof document === "undefined") return () => {};

  const target: EventTarget = root;
  const shell = root instanceof Document ? document.documentElement : root;
  let startY = 0;

  const onWheel = (e: Event) => {
    const evt = e as WheelEvent;
    if (!consumedInside(evt.target, shell, evt.deltaY)) evt.preventDefault();
  };

  const onTouchStart = (e: Event) => {
    const evt = e as TouchEvent;
    startY = evt.touches[0]?.clientY ?? 0;
  };

  const onTouchMove = (e: Event) => {
    const evt = e as TouchEvent;
    if (evt.touches.length > 1) return; // pinch-zoom stays the user's
    const dy = startY - (evt.touches[0]?.clientY ?? startY);
    if (!consumedInside(evt.target, shell, dy)) evt.preventDefault();
  };

  target.addEventListener("wheel", onWheel, { passive: false });
  target.addEventListener("touchstart", onTouchStart, { passive: true });
  target.addEventListener("touchmove", onTouchMove, { passive: false });

  return () => {
    target.removeEventListener("wheel", onWheel);
    target.removeEventListener("touchstart", onTouchStart);
    target.removeEventListener("touchmove", onTouchMove);
  };
}
