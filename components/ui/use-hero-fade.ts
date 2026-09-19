"use client";

import { onPageScroll, pageScrollTop, useBezel } from "vitre";
import { useEffect, useState, type CSSProperties } from "react";

/**
 * JS fallback for the CSS scroll-driven hero fade animation.
 *
 * Browsers that support `animation-timeline: scroll()` on the *root*
 * use the pure-CSS `.hero-zone-fade` animation. That timeline is silent
 * in the bezel's container scroll — the window never moves — so this
 * hook also activates there, driving opacity from `pageScrollTop()`.
 *
 * Returns a style object to spread onto the hero element, or undefined
 * when the CSS animation handles it natively.
 */
export function useHeroFade(enabled = true): CSSProperties | undefined {
  const { scroll } = useBezel();
  const [needsFallback, setNeedsFallback] = useState(false);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || reduced) {
      setNeedsFallback(false);
      return;
    }

    const cssOk =
      typeof CSS !== "undefined" && CSS.supports("animation-timeline: scroll()");
    // Container scroll: CSS `scroll(root)` never fires, and named timelines
    // on an overflow container are still uneven in Safari. Drive from page
    // scroll whenever the window is not the scroller, or the CSS API is missing.
    if (cssOk && scroll !== "container") {
      setNeedsFallback(false);
      return;
    }

    const frame = window.requestAnimationFrame(() => setNeedsFallback(true));
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, scroll]);

  useEffect(() => {
    if (!needsFallback) return;

    const getFadeDistance = () =>
      window.matchMedia("(min-width: 768px)").matches ? 144 : 176;

    // Page scroll, not window scroll: in container scroll the page scrolls in
    // the bezel's container and the window never moves. See vitre.
    const update = () => {
      setOpacity(1 - Math.min(pageScrollTop() / getFadeDistance(), 1));
    };

    const frame = window.requestAnimationFrame(update);
    const offScroll = onPageScroll(update);
    window.addEventListener("resize", update);

    return () => {
      window.cancelAnimationFrame(frame);
      offScroll();
      window.removeEventListener("resize", update);
    };
  }, [needsFallback]);

  return needsFallback
    ? { opacity, transition: "opacity 120ms linear" }
    : undefined;
}
