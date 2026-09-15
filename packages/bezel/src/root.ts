import {
  BAND_VAR,
  BEZEL_ATTRIBUTE,
  COLOR_VAR,
  SCROLL_ATTRIBUTE,
  SCROLL_CONTAINER_ID,
} from "./constants";
import { emitPageScroll } from "./scroll";

// =============================================================================
// Root — the bezel's state on <html>.
//
// The bezel lives in a handful of attributes and properties on the root
// element, so the stylesheet can paint and lock the page before any component
// renders. This module writes them, moves the scroll position when the scroll
// mode changes, and keeps them in place.
//
// "Keeps" because React owns <html>. When hydration fails — any text the
// server rendered differently, React error #418 — React 19 renders the app
// again on the client and strips every attribute off <html> first. Measured on
// a Vercel preview on iOS 26.5: the bezel lost its colour, its scroll mode and
// its corners. A mutation observer puts them back before the next paint.
// =============================================================================

/** What is written onto <html>. */
export interface RootState {
  enabled: boolean;
  color: string;
  band: number;
  scroll: "window" | "container";
}

function container(): HTMLElement | null {
  return document.getElementById(SCROLL_CONTAINER_ID);
}

function matches(root: HTMLElement, state: RootState): boolean {
  const scroll = root.getAttribute(SCROLL_ATTRIBUTE) === "container" ? "container" : "window";
  if (scroll !== state.scroll) return false;
  if (root.hasAttribute(BEZEL_ATTRIBUTE) !== state.enabled) return false;
  if (!state.enabled) return true;
  return (
    root.style.getPropertyValue(COLOR_VAR) === state.color &&
    root.style.getPropertyValue(BAND_VAR) === `${state.band}px`
  );
}

/** Write `state` onto the root element. Idempotent. */
export function applyRoot(root: HTMLElement, state: RootState): void {
  const was = root.getAttribute(SCROLL_ATTRIBUTE) === "container" ? "container" : "window";

  if (state.enabled) {
    root.setAttribute(BEZEL_ATTRIBUTE, "");
    root.style.setProperty(COLOR_VAR, state.color);
    root.style.setProperty(BAND_VAR, `${state.band}px`);
    root.style.backgroundColor = state.color;
  } else if (root.hasAttribute(BEZEL_ATTRIBUTE)) {
    root.removeAttribute(BEZEL_ATTRIBUTE);
    root.style.removeProperty(COLOR_VAR);
    root.style.removeProperty(BAND_VAR);
    root.style.backgroundColor = "";
  }

  if (state.scroll !== was) {
    // Carry the scroll position across, so switching mode does not jump the
    // page to the top.
    if (state.scroll === "container") {
      const top = window.scrollY;
      root.setAttribute(SCROLL_ATTRIBUTE, "container");
      const el = container();
      if (el) el.scrollTop = top;
    } else {
      const top = container()?.scrollTop ?? 0;
      root.removeAttribute(SCROLL_ATTRIBUTE);
      window.scrollTo(0, top);
    }
    emitPageScroll();
  }
}

/**
 * Apply `state` now, and again whenever something changes the root's class or
 * style attributes, until the returned cleanup runs. The repair's own writes
 * trigger the observer once more, find everything in place, and stop.
 */
export function keepRoot(root: HTMLElement, state: RootState): () => void {
  const restore = () => {
    if (!matches(root, state)) applyRoot(root, state);
  };
  restore();
  const observer = new MutationObserver(restore);
  observer.observe(root, { attributes: true });
  return () => observer.disconnect();
}
