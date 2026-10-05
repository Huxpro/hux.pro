"use client";

/**
 * Landing on `#id`: the page travels to what the hash names and marks it.
 *
 * Every permalink on the site works this way: a commit on /works
 * (components/log/use-commit-anchor.ts), a heading in a post
 * (components/post/heading-landing.tsx). It runs on arrival, cold load and
 * client navigation alike, and again on every `hashchange`, which is how a
 * link to the page already open travels too (lib/follow-href.ts fires one).
 *
 * Scrolling goes through `vitre`, never `window.scrollY`. With the
 * bezel on an iPhone the page scrolls inside a container, so the window knows
 * nothing about it (see docs/system-ambient.md). The travel is the same
 * shape as the table of contents' (`ruler-toc.tsx`): `animate` from motion
 * driving `scrollPageTo`, on iOS's curve, cancelled the moment the reader
 * touches the page, and `emitPageScroll()` on arrival so the subscribers
 * that only hear about scrolling through bezel (the hero fade) wake up at
 * the end of it.
 */

import { useCallback, useEffect, useRef } from "react";
import { animate, useReducedMotion } from "motion/react";
import {
  emitPageScroll,
  pageOffsetOf,
  pageScrollTop,
  scrollPageTo,
} from "vitre";

const TRAVEL_MS = 460;

export interface HashLanding {
  /** The element a hash (without `#`, decoded) names, or null if it names
   *  nothing on this page. */
  resolve: (id: string) => HTMLElement | null;
  /** Set on the element as it lands; `globals.css` styles it and owns how
   *  long it stays up (an animation, whose end takes it back off). */
  markAttr: string;
  /** Distance from the top of the viewport the element comes to rest at. */
  headroom: number;
  /** Also on landing, before the travel: open what was folded. */
  onLand?: (el: HTMLElement) => void;
}

export function markLanded(el: HTMLElement, attr: string) {
  document.querySelectorAll(`[${attr}]`).forEach((n) => n.removeAttribute(attr));
  // Restart the wash even when the same element is picked twice in a row:
  // the attribute has to leave the element and come back for the animation
  // to replay. CSS owns the duration; `animationend` takes the mark back
  // off, so the two can't disagree about how long it is.
  void el.offsetWidth;
  el.setAttribute(attr, "");
  el.addEventListener("animationend", () => el.removeAttribute(attr), { once: true });
}

/** The hash in the address bar, without `#`, decoded. */
export function currentHash(): string {
  const raw = window.location.hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Wires arrival and `hashchange`, and returns the travel, for a click that
 * changes the address itself (with `pushState`, which fires no
 * `hashchange`).
 */
export function useHashLanding({ resolve, markAttr, headroom, onLand }: HashLanding) {
  const reduced = useReducedMotion() ?? false;
  // One travel at a time: a second hash while the first is still gliding
  // stops it rather than easing toward two destinations at once.
  const stopRef = useRef<() => void>(() => {});
  // The latest options, read when a travel starts, so the effect below
  // wires its listeners once.
  const options = useRef({ resolve, markAttr, headroom, onLand });
  useEffect(() => {
    options.current = { resolve, markAttr, headroom, onLand };
  });

  const travelTo = useCallback(
    (el: HTMLElement) => {
      stopRef.current();
      const { markAttr, headroom, onLand } = options.current;
      onLand?.(el);

      const land = () => {
        emitPageScroll();
        // Marked on arrival rather than on departure: it lights up as it
        // settles, so the eye is already there to catch it.
        markLanded(el, markAttr);
      };

      // Measured a frame after `onLand`, which may have unfolded it.
      const frame = requestAnimationFrame(() => {
        const to = Math.max(0, pageOffsetOf(el) - headroom);
        const from = pageScrollTop();
        if (reduced || Math.abs(to - from) < 2) {
          scrollPageTo(to);
          land();
          return;
        }
        let done = false;
        const finish = (arrived = true) => {
          if (done) return;
          done = true;
          window.removeEventListener("wheel", cancel);
          window.removeEventListener("touchmove", cancel);
          stopRef.current = () => {};
          if (arrived) land();
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
          finish(false);
        };
        stopRef.current = cancel;
        window.addEventListener("wheel", cancel, { passive: true });
        window.addEventListener("touchmove", cancel, { passive: true });
        controls.then(() => finish(), () => finish(false));
      });
      stopRef.current = () => cancelAnimationFrame(frame);
    },
    [reduced],
  );

  useEffect(() => {
    const go = () => {
      const id = currentHash();
      const el = id ? options.current.resolve(id) : null;
      if (el) travelTo(el);
    };

    // On mount: covers a cold load and a client navigation alike. Gated on
    // the webfonts, not just on paint: Inter, Newsreader and JetBrains Mono
    // all swap in after first layout, and every line's height changes when
    // they do. Measuring before that lands ~80px off.
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

  return travelTo;
}
