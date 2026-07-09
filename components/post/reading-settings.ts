"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";

/**
 * Reading-surface settings — small persisted, global dev-time channels
 * adjustable from the devtool "Reading" panel. Each mirrors the ruler/bleed
 * pattern: a localStorage-backed value, a change event, and a hook. The
 * settings apply whether or not the devtool is enabled; the panel is just the
 * UI for flipping them.
 *
 *   · font    — body typeface: sans (default) or serif
 *   · measure — reading column width: narrow / default / wide
 *   · focus   — dim every block but the one at the reading line
 *
 * {@link ReadingRootSync} reflects font/measure onto `data-reading-*`
 * attributes on <html> (consumed by app/globals.css) and drives the focus
 * dimming. Mount it once at the app root.
 */

export type ReadingFont = "sans" | "serif";
export type ReadingMeasure = "narrow" | "default" | "wide";

// -----------------------------------------------------------------------------
// Persisted store factory (non-hook parts) + explicit hooks
// -----------------------------------------------------------------------------

function makeStore<T extends string>(
  key: string,
  event: string,
  fallback: T,
  parse: (raw: string | null) => T
) {
  const get = (): T => {
    if (typeof window === "undefined") return fallback;
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return fallback;
    }
  };
  const set = (value: T): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable — the event still updates this session.
    }
    window.dispatchEvent(new Event(event));
  };
  const subscribe = (callback: () => void) => {
    window.addEventListener(event, callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener(event, callback);
      window.removeEventListener("storage", callback);
    };
  };
  return { get, set, subscribe, fallback };
}

const fontStore = makeStore<ReadingFont>(
  "hux_reading_font",
  "hux:reading-font",
  "sans",
  (raw) => (raw === "serif" ? "serif" : "sans")
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

export const getReadingFont = fontStore.get;
export const setReadingFont = fontStore.set;
export function useReadingFont(): ReadingFont {
  return useSyncExternalStore(fontStore.subscribe, fontStore.get, () => "sans");
}

export const getReadingMeasure = measureStore.get;
export const setReadingMeasure = measureStore.set;
export function useReadingMeasure(): ReadingMeasure {
  return useSyncExternalStore(
    measureStore.subscribe,
    measureStore.get,
    () => "default"
  );
}

export const setReadingFocus = (on: boolean) => focusStore.set(on ? "on" : "off");
export const getReadingFocus = () => focusStore.get() === "on";
export function useReadingFocus(): boolean {
  return (
    useSyncExternalStore(focusStore.subscribe, focusStore.get, () => "off") ===
    "on"
  );
}

// -----------------------------------------------------------------------------
// Root sync — reflects settings onto <html> and drives focus dimming
// -----------------------------------------------------------------------------

/**
 * Applies the reading settings globally. Font and measure are simple root
 * attributes (only set when non-default, keeping <html> clean); focus attaches
 * a scroll tracker that flags the block nearest the reading line so CSS can dim
 * the rest. Renders nothing.
 */
export function ReadingRootSync() {
  const font = useReadingFont();
  const measure = useReadingMeasure();
  const focus = useReadingFocus();

  // Font: sans is the default (no attribute) — only mark serif.
  useEffect(() => {
    const root = document.documentElement;
    if (font === "serif") root.setAttribute("data-reading-font", "serif");
    else root.removeAttribute("data-reading-font");
  }, [font]);

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

    const clear = (article: Element | null) => {
      article
        ?.querySelectorAll(".reading-dim")
        .forEach((el) => el.classList.remove("reading-dim"));
    };

    const update = () => {
      raf = 0;
      const article = document.querySelector(".prose-article");
      if (!article) return;

      const line = window.innerHeight * 0.4;
      const blocks = Array.from(article.children);
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
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.removeAttribute("data-reading-focus");
      clear(document.querySelector(".prose-article"));
    };
  }, [focus]);

  return null;
}
