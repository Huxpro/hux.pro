"use client";

import {
  onPageScroll,
  pageScrollHeight,
  pageScrollTop,
  pageViewportHeight,
  scrollPageTo,
} from "@hux/bezel";
import { useEffect, useSyncExternalStore } from "react";

// ---------------------------------------------------------------------------
// Reading progress — where you had got to, per article.
//
// The site already remembers *what* you last read (`services/visitor.tsx`
// stores the slug, title and href, and PostContent records it on mount). What
// it never kept is *where in it* you were, so coming back to a long essay has
// always meant scrolling for the paragraph you recognise.
//
// This is that missing half, and only that. It records a position and offers
// it back; it never moves the page on its own. Automatic restoration fights
// the browser's own scroll restoration, and lands you somewhere you did not
// ask to be — on a page you may have opened to re-read the opening. An offer
// you can ignore is the whole design.
//
// Not a `makeStore` (persisted-setting.ts): those hold one string, this holds
// a map keyed by article, pruned so it cannot grow without bound.
// ---------------------------------------------------------------------------

const KEY = "hux_reading_progress";

/** How many articles to remember. Oldest go first; this is a convenience. */
const MAX_ENTRIES = 50;

/**
 * Below this you have not really started, and the offer would point at the
 * top of the page you are already looking at. Above it you have finished, and
 * an offer to jump to the end is worse than nothing.
 */
const OFFER_FLOOR = 0.05;
const OFFER_CEILING = 0.95;

/** At most one write a second — this runs on scroll. */
const WRITE_EVERY_MS = 1000;

interface Entry {
  /** How far down, 0–1. A ratio rather than a pixel offset: the column's
   *  height changes with the reading size, the measure and the viewport. */
  ratio: number;
  /** Last written, epoch ms. Only used to decide what to prune. */
  at: number;
}

type Store = Record<string, Entry>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Store;
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage full or unavailable. Losing a scroll position is not worth
    // reporting, and the session still works without it.
  }
}

/** Where the reader had got to in this article, or null. */
export function getProgress(href: string): number | null {
  const entry = read()[href];
  return entry && typeof entry.ratio === "number" ? entry.ratio : null;
}

function save(href: string, ratio: number): void {
  const store = read();
  store[href] = { ratio, at: Date.now() };

  const hrefs = Object.keys(store);
  if (hrefs.length > MAX_ENTRIES) {
    // Keep the most recently touched, drop the rest.
    hrefs
      .sort((a, b) => (store[b]?.at ?? 0) - (store[a]?.at ?? 0))
      .slice(MAX_ENTRIES)
      .forEach((stale) => delete store[stale]);
  }
  write(store);
}

/** How far down the page we are, 0–1, or null when there is nothing to scroll. */
function currentRatio(): number | null {
  const scrollable = pageScrollHeight() - pageViewportHeight();
  if (scrollable <= 0) return null;
  const ratio = pageScrollTop() / scrollable;
  return Math.min(1, Math.max(0, ratio));
}

/**
 * The offer for an article, frozen at the moment the article was opened.
 *
 * It has to be frozen: this hook writes to the same storage on every scroll,
 * so a live read would watch the offer chase the reader down the page. Cached
 * per href and dropped when the article unmounts, so coming back later reads
 * the position you actually left, not the one you arrived with.
 */
const offers = new Map<string, number | null>();

function offerFor(href: string): number | null {
  if (!href) return null;
  if (!offers.has(href)) {
    const stored = getProgress(href);
    offers.set(
      href,
      stored !== null && stored > OFFER_FLOOR && stored < OFFER_CEILING
        ? stored
        : null
    );
  }
  return offers.get(href) ?? null;
}

/** Nothing to subscribe to: the snapshot is fixed for as long as it is mounted. */
const NEVER = () => () => {};

/**
 * Records this article's position as it is read, and hands back the position
 * it had when the page opened, so the offer is about the last visit rather
 * than about this one.
 *
 * Returns null when there is nothing worth offering: no stored position, or
 * one at the very top or the very end. Reads through `useSyncExternalStore`
 * with a null server snapshot, the same hydration-safe shape the reading
 * settings use (persisted-setting.ts) — localStorage does not exist when this
 * renders on the server, and an effect that set state would just be a
 * cascading render with a lint rule against it.
 */
export function useReadingProgress(href: string): number | null {
  const previous = useSyncExternalStore(
    NEVER,
    () => offerFor(href),
    () => null
  );

  useEffect(() => {
    // An empty href is a caller saying "not this page" — the docs and any
    // article without the ruler. Nothing to record, nothing to offer.
    if (!href) return;

    let raf = 0;
    let lastWrite = 0;

    const commit = () => {
      const ratio = currentRatio();
      if (ratio !== null) save(href, ratio);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const now = Date.now();
        if (now - lastWrite < WRITE_EVERY_MS) return;
        lastWrite = now;
        commit();
      });
    };

    // The page scrolls inside the bezel's container, not the window.
    const offScroll = onPageScroll(onScroll);
    // A throttled write can always be a second stale; catch the real exit.
    // `pagehide` fires where `beforeunload` does not on iOS.
    window.addEventListener("pagehide", commit);
    document.addEventListener("visibilitychange", commit);

    return () => {
      cancelAnimationFrame(raf);
      offScroll();
      window.removeEventListener("pagehide", commit);
      document.removeEventListener("visibilitychange", commit);
      // Leaving by client-side navigation is an exit too.
      commit();
      // Let a later visit read the position this one is leaving behind.
      offers.delete(href);
    };
  }, [href]);

  return previous;
}

/**
 * Scroll to a stored ratio. Through the bezel rather than `window.scrollTo`:
 * in container-scroll mode the window does not scroll at all.
 */
export function scrollToProgress(ratio: number): void {
  const scrollable = pageScrollHeight() - pageViewportHeight();
  if (scrollable <= 0) return;
  scrollPageTo(ratio * scrollable);
}
