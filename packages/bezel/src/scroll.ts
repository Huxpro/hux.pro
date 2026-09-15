"use client";

import { useEffect, useRef } from "react";
import { SCROLL_ATTRIBUTE, SCROLL_CONTAINER_ID } from "./constants";

// =============================================================================
// Scroll — where the page scrolls.
//
// Which mode applies is read from <html> at call time, so every helper is
// right across a live switch. `onPageScroll` listens on the window AND the
// container: only the one that actually scrolls fires, so a listener never
// runs twice for one scroll, and a subscriber survives the switch.
//
// Anything that reads or drives page scroll should go through here rather than
// `window`, or it reads 0 and scrolls nothing in container scroll.
// =============================================================================

export function getScrollContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  if (document.documentElement.getAttribute(SCROLL_ATTRIBUTE) !== "container") return null;
  return document.getElementById(SCROLL_CONTAINER_ID);
}

export function pageScrollTop(): number {
  const container = getScrollContainer();
  if (container) return container.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

export function pageScrollHeight(): number {
  const container = getScrollContainer();
  return container ? container.scrollHeight : document.documentElement.scrollHeight;
}

export function pageViewportHeight(): number {
  const container = getScrollContainer();
  return container ? container.clientHeight : window.innerHeight;
}

export function pageOffsetOf(element: Element): number {
  const container = getScrollContainer();
  const top = container ? container.getBoundingClientRect().top : 0;
  return element.getBoundingClientRect().top - top + pageScrollTop();
}

export function scrollPageTo(top: number): void {
  const container = getScrollContainer();
  if (container) container.scrollTop = top;
  else window.scrollTo(0, top);
}

export function onPageScroll(listener: () => void): () => void {
  const container = document.getElementById(SCROLL_CONTAINER_ID);
  window.addEventListener("scroll", listener, { passive: true });
  container?.addEventListener("scroll", listener, { passive: true });
  return () => {
    window.removeEventListener("scroll", listener);
    container?.removeEventListener("scroll", listener);
  };
}

export function emitPageScroll(): void {
  window.dispatchEvent(new Event("scroll"));
}

export function usePageScroll(listener: () => void): void {
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  }, [listener]);
  useEffect(() => onPageScroll(() => latest.current()), []);
}
