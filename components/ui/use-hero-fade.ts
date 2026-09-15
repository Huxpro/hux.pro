"use client";

import { onPageScroll, pageScrollTop } from "@hux/bezel";
import { useEffect, useState, type CSSProperties } from "react";

/**
 * JS fallback for the CSS scroll-driven hero fade animation.
 *
 * Browsers that support `animation-timeline: scroll()` use the pure-CSS
 * `.hero-zone-fade` animation; this hook only activates as a fallback
 * for browsers that don't.
 *
 * Returns a style object to spread onto the hero element, or undefined
 * when the CSS animation handles it natively.
 */
export function useHeroFade(): CSSProperties | undefined {
  const [needsFallback, setNeedsFallback] = useState(false);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const supported =
      typeof CSS !== "undefined" &&
      CSS.supports("animation-timeline: scroll()");
    if (supported) return;

    const frame = window.requestAnimationFrame(() => setNeedsFallback(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!needsFallback) return;

    const getFadeDistance = () =>
      window.matchMedia("(min-width: 768px)").matches ? 144 : 176;

    // Page scroll, not window scroll: in container scroll the page scrolls in
    // the bezel's container and the window never moves. See @hux/bezel.
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
