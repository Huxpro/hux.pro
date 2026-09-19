"use client";

import { useEffect, useState, type RefObject } from "react";
import { onPageScroll } from "vitre";

export interface CurrentChapter {
  /** The chapter whose marker has reached the slot, or null above the first. */
  id: string | null;
  /** Which way it changed: 1 reading on (down), -1 back (up). */
  dir: 1 | -1;
}

/**
 * The chapter a pinned bar should wear: the last one whose marker pill
 * (`[data-chapter]`, LogTimeline) has scrolled up to the bar's ref slot. The
 * handover is where the two pills line up — centre to centre — so the one
 * in the flow slides under the slot and the slot is already wearing it.
 *
 * `ids` is the chapters in page order; a change (a filter emptying one)
 * re-reads where the page is.
 */
export function useCurrentChapter(
  slotRef: RefObject<HTMLElement | null>,
  ids: readonly string[],
): CurrentChapter {
  const [chapter, setChapter] = useState<CurrentChapter>({ id: null, dir: 1 });
  // The chapters as a value: a new array with the same ids is no change.
  const key = ids.join("\n");

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const order = key.split("\n");
    const root = slot.closest("main") ?? document;

    const update = () => {
      const s = slot.getBoundingClientRect();
      const line = s.top + s.height / 2;
      let id: string | null = null;
      let index = -1;
      // Few enough to read them all; each is one rect, and nothing is
      // written between the reads.
      // This page's own markers: a streamed render can leave a hidden copy
      // of the whole log in the document, whose markers all sit at 0.
      root.querySelectorAll<HTMLElement>("[data-chapter]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top + r.height / 2 <= line + 1) {
          id = el.dataset.chapter ?? null;
          index = order.indexOf(id ?? "");
        }
      });
      setChapter((prev) => {
        if (prev.id === id) return prev;
        const was = prev.id === null ? -1 : order.indexOf(prev.id);
        return { id, dir: index >= was ? 1 : -1 };
      });
    };

    update();
    const off = onPageScroll(update);
    window.addEventListener("resize", update);
    return () => {
      off();
      window.removeEventListener("resize", update);
    };
  }, [slotRef, key]);

  return chapter;
}
