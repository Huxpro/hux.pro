"use client";

import { useEffect, useState } from "react";
import { getScrollContainer, onPageScroll } from "vitre";
import type { PromptTopic } from "@/lib/prompt-view";

/**
 * The page's chapters, in reading order: the three shelves, and then the
 * people behind them. An influence sits on no shelf (`lib/prompts`), but the
 * page still reads them as a run of their own after the last shelf, so the
 * kind stands in for the topic there.
 */
export type PromptChapter = PromptTopic | "influence";

/**
 * Which chapter the reader is in: the one the entry under the middle of the
 * view belongs to (`[data-chapter]`, set on every entry by `app/prompt/view`).
 *
 * The middle, and not the bar, because the middle is where this page already
 * says you are reading — the spotlight in `globals.css` lights whichever
 * entry crosses it and dims the rest. The bar naming a chapter an entry
 * earlier or later than the one in the light would be two answers to one
 * question. Which also means the chapter is named at rest, before anything
 * has scrolled: the first thing the page says is what the first entries are.
 *
 * `null` while the middle is above the first entry (a tall header on a short
 * screen) or when a filter left nothing to read.
 */
export function useReadingChapter(): PromptChapter | null {
  const [chapter, setChapter] = useState<PromptChapter | null>(null);

  useEffect(() => {
    const update = () => {
      // The scrollport the spotlight's `view()` follows: Vitre's container
      // when the page scrolls in it, the viewport otherwise.
      const port = getScrollContainer()?.getBoundingClientRect();
      const line = port
        ? port.top + port.height / 2
        : window.innerHeight / 2;
      let current: PromptChapter | null = null;
      // A score of entries, one rect each, nothing written between reads.
      // The last one whose top has reached the line is the one it is in.
      for (const el of document.querySelectorAll<HTMLElement>(
        "main [data-chapter]",
      )) {
        const r = el.getBoundingClientRect();
        // A copy a streamed render left hidden has no box at all.
        if (r.height === 0) continue;
        if (r.top > line) break;
        current = el.dataset.chapter as PromptChapter;
      }
      setChapter(current);
    };

    update();
    const off = onPageScroll(update);
    window.addEventListener("resize", update);
    // A filter or an expanding entry moves the page under a still reader.
    const observer = new ResizeObserver(update);
    const main = document.querySelector("main");
    if (main) observer.observe(main);
    return () => {
      off();
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  return chapter;
}
