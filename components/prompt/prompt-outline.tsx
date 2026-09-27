"use client";

/**
 * PromptOutline — the page's shape, in the margin beside it.
 *
 *     Worlding │
 *            ─ │  one tick per entry, in page order
 *           ── │  ← the entry the page is spotlighting
 *            ─ │
 *            ─ │
 *        Being │  the column's left edge
 *            ─ │
 *            … │
 *   Influences │
 *         ─ ×8 │
 *
 * The page reads as one column of large sentences, and nothing in the column
 * says where one shelf stops and the next begins: the first four are 天行,
 * the next four 修身, then five of 行事, then the people who trained all of
 * it — and a reader scrolling past them sees thirteen beliefs and eight
 * names, not three chapters and a bibliography. The shelves are the page's
 * reading order (`lib/prompt-view`), so the order is worth being able to see.
 *
 * It lives off the column on purpose. A previous version printed each
 * entry's `#会通` down the left margin, on every entry, and lost to the
 * chrome it cost (see `EntryTag` in `app/prompt/view`). This is the same
 * outline drawn once, in a gutter that is otherwise empty on a desk: four
 * words and a tick per entry, so the count of each shelf — 4, 4, 5, 8 — is
 * the picture itself, and nothing is added to the thing being read. On a
 * phone there is no gutter, and it simply isn't there; the toolbar's chips
 * already carry the same counts.
 *
 * The rail hugs the column: set flush right against the text's left edge,
 * a ruler along the margin rather than a table of contents across the room.
 * It rides with the page until the list reaches the top, then sticks at the
 * height an entry lands at when it is linked to (`scroll-mt-24` in
 * `PromptItem`), so a tick you click and the entry it brings up end on the
 * same line. It ends where the list ends, too: sticky inside a box the
 * height of the entries, so at the foot of the page it rides back up with
 * the last of them instead of hanging over the footer.
 *
 * Not the article's ruler (`components/post/ruler-toc`), which is a dial
 * docked to the screen's edge for prose whose sections come in any number
 * and length, sliding the tape so the active one rests at the centre. Here
 * the counts are the content: the ticks stay where they are, so the shape
 * holds still to be read, and only the light moves.
 *
 * Rungs, from the toolbar's own grammar: there, nothing selected is plain
 * tertiary text, and once something is selected the rest drop to
 * quaternary. The rail always has a selection — you are always somewhere —
 * so it lives in the second state: the current shelf on the secondary rung,
 * the others receding to quaternary, where they carry the shape and ask
 * for nothing. Ticks are decoration and sit on quaternary, one rung up
 * inside the current shelf so the shelf reads as a group, and the current
 * entry's tick is ink and twice as long.
 *
 * Not `.ink-bare`, although nothing is behind it but the backdrop: /prompt
 * is a reading route, where the wallpaper sits under a veil and bare zones
 * neither flip nor take the bare boost — the gutter is the same ground as
 * the column, so the rail takes the column's ink.
 *
 * "Current" is the entry the page itself is already spotlighting. `.prompt-
 * item` fades each entry in and out on a view timeline that peaks with the
 * entry centred in the viewport (globals.css, `prompt-spotlight`), so the
 * rail asks the same question the stylesheet does — which entry holds the
 * middle of the view — and the lit tick and the lit sentence agree. It
 * reflects only what is rendered: a filter narrows the page and the rail
 * with it, because it is built from the same filtered lists.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getScrollContainer,
  onPageScroll,
  pageOffsetOf,
  pageScrollHeight,
  pageScrollTop,
  pageViewportHeight,
} from "vitre";
import { cn } from "@/lib/utils";

export interface OutlineEntry {
  /** The DOM id the entry renders under — this locale's anchor. */
  anchor: string;
}

export interface OutlineChapter {
  /** Stable key: a topic, or `influences`. */
  key: string;
  /** What the chapter is called in the reader's language. */
  label: string;
  entries: OutlineEntry[];
}

interface PromptOutlineProps {
  chapters: OutlineChapter[];
  /** The landmark's name, for assistive tech. */
  label: string;
  /** Travel to an entry and put it in the URL (the page's `goTo`). */
  onEntry: (anchor: string) => void;
  /** Glide to a chapter's first entry, leaving the URL alone. */
  onChapter: (anchor: string) => void;
}

/**
 * Where `scrollend` is missing (Safari before 26), the quiet that stands in
 * for it: how long scroll has to stay still before a jump counts as landed.
 */
const SETTLE_MS = 250;

const HAS_SCROLLEND =
  typeof window !== "undefined" && "onscrollend" in window;

/** An entry a click has lit, held until the jump to it has landed. */
interface Pin {
  anchor: string;
  /** The page has started moving toward it. */
  moved: boolean;
  /** …and has stopped: the next scroll is the reader's own. */
  landed: boolean;
}

/**
 * Which entry holds the middle of the view.
 *
 * Measured from the element that actually scrolls: with the bezel on an
 * iPhone the page scrolls inside a container, so the middle of the view is
 * the middle of that box, and scroll events come from vitre's
 * `onPageScroll` rather than the window. An entry that contains the middle
 * wins outright; between two (the gap `space-y-2` leaves), the nearer edge
 * does.
 *
 * A click is allowed to overrule the measurement. A linked entry lands
 * under the toolbar, not in the middle, and a short one — most influences
 * are a name and a line — would leave the middle to its neighbour, so the
 * tick you clicked would light the one after it. `pin` holds the clicked
 * entry lit until the jump has landed and the reader scrolls on their own.
 */
function useCurrentEntry(
  rootRef: React.RefObject<HTMLElement | null>,
  anchors: readonly string[],
) {
  const [current, setCurrent] = useState<string | null>(null);
  const pinRef = useRef<Pin | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The anchors as a value: a new array with the same entries is no change.
  const key = anchors.join("\n");

  /** Count the jump as landed once `ms` pass without being re-armed. */
  const landAfter = useCallback((target: Pin, ms: number) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      target.landed = true;
    }, ms);
  }, []);

  const pin = useCallback(
    (anchor: string) => {
      clearTimeout(timerRef.current);
      // A jump to where the page already is — the entry is already under
      // the toolbar, or the page cannot scroll any further toward it —
      // fires no scroll at all, so it has landed before it starts and the
      // next scroll is the reader's. Worked out rather than waited for:
      // how soon a smooth scroll sends its first event depends on how
      // busy the page is.
      const element = rootRef.current
        ?.closest("main")
        ?.querySelector(`#${CSS.escape(anchor)}`);
      const margin = element
        ? parseFloat(getComputedStyle(element).scrollMarginTop) || 0
        : 0;
      const room = pageScrollHeight() - pageViewportHeight();
      const target = element
        ? Math.min(room, Math.max(0, pageOffsetOf(element) - margin))
        : pageScrollTop();
      const still = Math.abs(target - pageScrollTop()) < 1;
      pinRef.current = { anchor, moved: false, landed: still };
      setCurrent(anchor);
    },
    [rootRef],
  );

  useEffect(() => {
    const order = key ? key.split("\n") : [];
    // This page's own entries: a streamed render can leave a hidden copy of
    // the page in the document (`use-current-chapter` has the same guard).
    const scope = rootRef.current?.closest("main") ?? document;
    let frame = 0;

    const measure = () => {
      frame = 0;
      // Not drawn (a phone, where there is no margin to draw it in): the
      // page pays nothing per scroll. A resize past `lg` measures again.
      if (!rootRef.current?.getClientRects().length) return;
      const box = getScrollContainer()?.getBoundingClientRect();
      const middle = box
        ? box.top + box.height / 2
        : window.innerHeight / 2;
      let best: string | null = null;
      let bestDistance = Infinity;
      // A couple of dozen rects, all read before anything is written.
      for (const anchor of order) {
        const element = scope.querySelector(`#${CSS.escape(anchor)}`);
        if (!element) continue;
        const r = element.getBoundingClientRect();
        const distance =
          r.top > middle ? r.top - middle : r.bottom < middle ? middle - r.bottom : 0;
        if (distance < bestDistance) {
          best = anchor;
          bestDistance = distance;
        }
      }
      setCurrent(best);
    };

    const onScroll = () => {
      const pinned = pinRef.current;
      if (pinned) {
        // Still travelling: keep the clicked entry lit until the jump
        // lands. After it has, this is the reader's own scroll, and the
        // measurement takes over again.
        if (!pinned.landed) {
          pinned.moved = true;
          if (!HAS_SCROLLEND) landAfter(pinned, SETTLE_MS);
          return;
        }
        pinRef.current = null;
      }
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // `scrollend` does not bubble from an element, so it is caught on the
    // way down: that hears the window and Vitre's container alike.
    const onScrollEnd = () => {
      const pinned = pinRef.current;
      if (pinned?.moved) pinned.landed = true;
    };

    // A filter, a locale switch or a pin that no longer points at anything
    // starts over from where the page is.
    if (pinRef.current && !order.includes(pinRef.current.anchor))
      pinRef.current = null;
    if (!pinRef.current) measure();

    const off = onPageScroll(onScroll);
    window.addEventListener("resize", onScroll);
    document.addEventListener("scrollend", onScrollEnd, { capture: true });
    return () => {
      off();
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("scrollend", onScrollEnd, {
        capture: true,
      });
      cancelAnimationFrame(frame);
    };
  }, [rootRef, key, landAfter]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { current, pin };
}

export function PromptOutline({
  chapters,
  label,
  onEntry,
  onChapter,
}: PromptOutlineProps) {
  const rootRef = useRef<HTMLElement>(null);
  const anchors = chapters.flatMap((c) => c.entries.map((e) => e.anchor));
  const { current, pin } = useCurrentEntry(rootRef, anchors);

  if (anchors.length === 0) return null;

  return (
    <nav
      ref={rootRef}
      aria-label={label}
      className={cn(
        // A box the height of the entries, standing in the margin: the rail
        // inside it is sticky, so it can only travel as far as the list does.
        // `lg` is where the gutter first has room for a word beside the
        // column — 172px a side at 1024.
        "pointer-events-none absolute inset-y-0 right-full mr-12 hidden w-32 lg:block",
      )}
    >
      <ol
        className={cn(
          "pointer-events-auto sticky flex flex-col items-end gap-4",
          // Where a linked entry lands (`scroll-mt-24`), or under the Dock's
          // Live Activities when there are any — the same clearance the
          // toolbar takes, a toolbar's height further down.
          "top-[max(6rem,calc(var(--dock-clear)+5.5rem))]",
          "font-mono text-xs",
        )}
      >
        {chapters.map((chapter) => {
          const here = chapter.entries.some((e) => e.anchor === current);
          return (
            <li key={chapter.key} className="flex flex-col items-end">
              <button
                type="button"
                onClick={() => {
                  const first = chapter.entries[0].anchor;
                  pin(first);
                  onChapter(first);
                }}
                aria-current={here ? "location" : undefined}
                className={cn(
                  "leading-4 transition-colors duration-200 motion-reduce:transition-none",
                  here
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-quaternary-foreground hover:text-muted-foreground",
                )}
              >
                {chapter.label}
              </button>

              <ol className="mt-1.5 flex flex-col items-end">
                {chapter.entries.map(({ anchor }) => {
                  const lit = anchor === current;
                  return (
                    <li key={anchor}>
                      <a
                        href={`#${anchor}`}
                        // Four chapters are enough tab stops for a margin;
                        // the entries themselves are the next ones along.
                        // A reader of the tree still gets every link.
                        tabIndex={-1}
                        aria-current={lit ? "location" : undefined}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
                            return;
                          e.preventDefault();
                          pin(anchor);
                          onEntry(anchor);
                        }}
                        className="group/tick relative flex h-2 w-12 items-center justify-end"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-px transition-[width,background-color] duration-200 motion-reduce:transition-none",
                            lit
                              ? "w-4 bg-foreground"
                              : [
                                  "w-2 group-hover/tick:w-3 group-hover/tick:bg-muted-foreground",
                                  here
                                    ? "bg-tertiary-foreground"
                                    : "bg-quaternary-foreground",
                                ],
                          )}
                        />
                        {/* The entry's outline word, under the pointer only:
                            the same `#会通` the entry's own tag grows on
                            hover, which is also where this link goes. Set to
                            the left of the longest tick, and cut short of
                            the screen's edge rather than by the rail: its
                            right edge is 4.5rem off the text (the rail's
                            `mr-12`, then `right-6`), and `--page-bleed` is
                            the text's distance from the screen's edge. */}
                        <span
                          className={cn(
                            "pointer-events-none absolute right-6 truncate whitespace-nowrap leading-4",
                            "max-w-[calc(var(--page-bleed)-5.5rem)]",
                            "text-muted-foreground opacity-0 transition-opacity duration-150",
                            "group-hover/tick:opacity-100 motion-reduce:transition-none",
                          )}
                        >
                          <span className="text-quaternary-foreground">#</span>
                          {anchor}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
