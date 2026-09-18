"use client";

/**
 * Commit permalinks — `/works#<hash>`.
 *
 * Every row has carried `id={hash}` since the timeline was written, so the
 * anchors existed; nothing pointed at them and nothing happened on arrival.
 * A commit is the page's unit, and a unit you cannot link to is not one —
 * "the Lynx talk" had no address, and following a link from elsewhere on the
 * site dropped you at the top of a 25-row log to find it yourself.
 *
 * This is both halves: land on `#hash` and the page travels to that row and
 * marks it; click a row's hash and the URL becomes that permalink without a
 * navigation.
 *
 * Scrolling goes through `@hux/bezel`, never `window.scrollY` — with the
 * bezel on an iPhone the page scrolls inside a container, so the window knows
 * nothing about it (see docs/system-ambient.md). The travel itself is the
 * same shape as the table of contents' (`ruler-toc.tsx`): `animate` from
 * motion driving `scrollPageTo`, on iOS's curve, cancelled the moment the
 * reader touches the page, and `emitPageScroll()` on arrival so the
 * subscribers that only hear about scrolling through bezel — the hero fade —
 * wake up at the end of it.
 */

import { useCallback, useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";
import {
  emitPageScroll,
  pageOffsetOf,
  pageScrollTop,
  scrollPageTo,
} from "@hux/bezel";

/** Marks the row that was just travelled to; `globals.css` styles it and
 *  owns how long the mark stays up (`commit-target-wash`). */
const TARGET_ATTR = "data-commit-target";

/** Distance from the top of the viewport the row comes to rest at, clearing
 *  the sticky chapter marker (`top-4`) with room to read the row above it. */
const HEADROOM = 120;

const TRAVEL_MS = 460;

function mark(el: HTMLElement) {
  document
    .querySelectorAll(`[${TARGET_ATTR}]`)
    .forEach((n) => n.removeAttribute(TARGET_ATTR));
  // Restart the wash even when the same row is picked twice in a row: the
  // attribute has to leave the element and come back for the animation to
  // replay. CSS owns the duration; `animationend` takes the mark back off,
  // so the two can't disagree about how long two seconds is.
  void el.offsetWidth;
  el.setAttribute(TARGET_ATTR, "");
  el.addEventListener(
    "animationend",
    () => el.removeAttribute(TARGET_ATTR),
    { once: true },
  );
}

/** A commit hash is 7 hex characters — see `computeCommitHash`. */
function rowFor(hash: string): HTMLElement | null {
  const id = hash.replace(/^#/, "");
  if (!/^[0-9a-f]{7}$/.test(id)) return null;
  const el = document.getElementById(id);
  return el?.hasAttribute("data-rail-row") ? (el as HTMLElement) : null;
}

/**
 * Wires arrival and returns the click handler a row's hash uses to become the
 * page's address.
 */
export function useCommitAnchor(): (hash: string) => void {
  const reduced = useReducedMotion() ?? false;
  // One travel at a time: a second hash while the first is still gliding
  // stops it rather than easing toward two destinations at once.
  const stopRef = useRef<() => void>(() => {});

  const travelTo = useCallback(
    (el: HTMLElement) => {
      stopRef.current();

      const to = Math.max(0, pageOffsetOf(el) - HEADROOM);
      const from = pageScrollTop();

      const land = () => {
        emitPageScroll();
        // Marked on arrival rather than on departure: the row lights up as
        // it settles, so the eye is already there to catch it.
        mark(el);
      };

      if (reduced || Math.abs(to - from) < 2) {
        scrollPageTo(to);
        land();
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener("wheel", cancel);
        window.removeEventListener("touchmove", cancel);
        stopRef.current = () => {};
        land();
      };
      const controls = animate(from, to, {
        duration: TRAVEL_MS / 1000,
        ease: [0.32, 0.72, 0, 1],
        onUpdate: (v) => scrollPageTo(v),
      });
      // Reaching for the page outranks the animation; it stops where the
      // reader took over rather than dragging them the rest of the way.
      const cancel = () => {
        controls.stop();
        finish();
      };
      stopRef.current = cancel;
      window.addEventListener("wheel", cancel, { passive: true });
      window.addEventListener("touchmove", cancel, { passive: true });
      controls.then(finish, finish);
    },
    [reduced],
  );

  useEffect(() => {
    const go = () => {
      const el = rowFor(window.location.hash);
      if (el) travelTo(el);
    };

    // On mount: covers a cold load and a client navigation into `/works#hash`
    // alike. Gated on the webfonts, not just on paint — Inter, Newsreader and
    // JetBrains Mono all swap in after first layout, and every row's height
    // changes when they do. Measuring before that lands the row ~80px off,
    // which on a page of 44px rows is a whole row and a half.
    let cancelled = false;
    const whenReady = document.fonts?.ready ?? Promise.resolve();
    void whenReady.then(() => {
      if (!cancelled) requestAnimationFrame(go);
    });

    window.addEventListener("hashchange", go);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", go);
      stopRef.current();
    };
  }, [travelTo]);

  return useCallback(
    (hash: string) => {
      const el = rowFor(hash);
      if (!el) return;
      // `pushState`, so the permalink is in the URL bar and in history without
      // a route change — and without firing `hashchange`, which would send the
      // travel through a second time.
      window.history.pushState(null, "", `#${hash}`);
      travelTo(el);
    },
    [travelTo],
  );
}
