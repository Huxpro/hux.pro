"use client";

import { onPageScroll } from "vitre";
import { useEffect } from "react";
import { makeStore } from "./persisted-setting";

/**
 * Reading-surface settings — small persisted, global dev-time channels
 * adjustable from the devtool "Reading" panel (all built on the shared
 * {@link makeStore} factory):
 *
 *   · bleed   — let wide landscape media break out of the reading column
 *   · font    — body typeface: sans (default) or serif
 *   · size    — type size: small / default / large
 *   · measure — reading column width: narrow / default / wide
 *   · focus   — dim every block but the one at the reading line
 *
 * {@link ReadingRootSync} reflects each onto an attribute on <html> (consumed
 * by app/globals.css) and drives the focus dimming. Mount it once at the app
 * root.
 */

export type ReadingFont = "sans" | "serif";
export type ReadingSize = "small" | "default" | "large";
export type ReadingMeasure = "narrow" | "default" | "wide";

// Bleed defaults ON — absence of a stored value means "bleed active", so only
// an explicit "off" disables it. That polarity is deliberate (see the
// data-bleed-off note in ReadingRootSync).
const bleedStore = makeStore<"on" | "off">(
  "hux_bleed_enabled",
  "hux:bleed-enabled",
  "on",
  (raw) => (raw === "off" ? "off" : "on")
);

const fontStore = makeStore<ReadingFont>(
  "hux_reading_font",
  "hux:reading-font",
  "sans",
  (raw) => (raw === "serif" ? "serif" : "sans")
);

const sizeStore = makeStore<ReadingSize>(
  "hux_reading_size",
  "hux:reading-size",
  "default",
  (raw) => (raw === "small" || raw === "large" ? raw : "default")
);

const measureStore = makeStore<ReadingMeasure>(
  "hux_reading_measure",
  "hux:reading-measure",
  "default",
  (raw) => (raw === "narrow" || raw === "wide" ? raw : "default")
);

const focusStore = makeStore<"on" | "off">(
  "hux_reading_focus",
  "hux:reading-focus",
  "off",
  (raw) => (raw === "on" ? "on" : "off")
);

export const setBleedEnabled = (on: boolean) => bleedStore.set(on ? "on" : "off");
export const getBleedEnabled = () => bleedStore.get() === "on";
export const useBleedEnabled = (): boolean => bleedStore.use() === "on";

export const getReadingFont = fontStore.get;
export const setReadingFont = fontStore.set;
export const useReadingFont = fontStore.use;

export const getReadingSize = sizeStore.get;
export const setReadingSize = sizeStore.set;
export const useReadingSize = sizeStore.use;

export const getReadingMeasure = measureStore.get;
export const setReadingMeasure = measureStore.set;
export const useReadingMeasure = measureStore.use;

export const setReadingFocus = (on: boolean) => focusStore.set(on ? "on" : "off");
export const getReadingFocus = () => focusStore.get() === "on";
export const useReadingFocus = (): boolean => focusStore.use() === "on";

// -----------------------------------------------------------------------------
// Root sync — reflects settings onto <html> and drives focus dimming
// -----------------------------------------------------------------------------

/**
 * Applies the reading settings globally. Font/measure/bleed are simple root
 * attributes (only set when non-default, keeping <html> clean); focus attaches
 * a scroll tracker that flags the block nearest the reading line so CSS can dim
 * the rest. Renders nothing.
 */
export function ReadingRootSync() {
  const bleed = useBleedEnabled();
  const font = useReadingFont();
  const size = useReadingSize();
  const measure = useReadingMeasure();
  const focus = useReadingFocus();

  // Bleed defaults on, so the attribute is the *kill switch*: present only when
  // disabled. (Font/measure/focus default to neutral, so absence = default for
  // them — opposite polarity, matching opposite defaults.)
  useEffect(() => {
    const root = document.documentElement;
    if (bleed) root.removeAttribute("data-bleed-off");
    else root.setAttribute("data-bleed-off", "");
  }, [bleed]);

  // Font: sans is the default (no attribute) — only mark serif.
  useEffect(() => {
    const root = document.documentElement;
    if (font === "serif") root.setAttribute("data-reading-font", "serif");
    else root.removeAttribute("data-reading-font");
  }, [font]);

  // Size: default needs no attribute; small/large set --reading-size in CSS.
  useEffect(() => {
    const root = document.documentElement;
    if (size === "default") root.removeAttribute("data-reading-size");
    else root.setAttribute("data-reading-size", size);
  }, [size]);

  // Measure: default width needs no attribute; narrow/wide override in CSS.
  useEffect(() => {
    const root = document.documentElement;
    if (measure === "default") root.removeAttribute("data-reading-measure");
    else root.setAttribute("data-reading-measure", measure);
  }, [measure]);

  // Focus: dim every prose block except the one crossing the reading line
  // (viewport 40% — the same index line the ruler reads from).
  useEffect(() => {
    const root = document.documentElement;
    if (!focus) {
      root.removeAttribute("data-reading-focus");
      return;
    }
    root.setAttribute("data-reading-focus", "");

    let raf = 0;
    let active: Element | null = null;

    const update = () => {
      raf = 0;
      // Re-query each tick so language switches / view transitions that swap
      // the article DOM are picked up without re-arming the listener.
      const article = document.querySelector(".prose-article");
      if (!article) return;

      const line = window.innerHeight * 0.4;
      const blocks = article.children;
      let best: Element | null = null;
      let bestDist = Infinity;
      for (const el of blocks) {
        const r = el.getBoundingClientRect();
        if (r.height === 0) continue;
        // 0 while the block straddles the reading line, else the gap to it.
        const dist =
          r.top > line ? r.top - line : r.bottom < line ? line - r.bottom : 0;
        if (dist < bestDist) {
          bestDist = dist;
          best = el;
        }
      }

      if (best === active) return;
      active = best;
      for (const el of blocks) el.classList.toggle("reading-dim", el !== best);
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    // Page scroll: in container scroll Vitre's container scrolls, not the window.
    const offScroll = onPageScroll(schedule);
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(raf);
      offScroll();
      window.removeEventListener("resize", schedule);
      root.removeAttribute("data-reading-focus");
      document
        .querySelector(".prose-article")
        ?.querySelectorAll(".reading-dim")
        .forEach((el) => el.classList.remove("reading-dim"));
    };
  }, [focus]);

  return null;
}
