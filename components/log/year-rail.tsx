"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useReducedMotion } from "motion/react";
import {
  onPageScroll,
  pageOffsetOf,
  pageScrollHeight,
  pageScrollTop,
  pageViewportHeight,
  scrollPageTo,
} from "vitre";
import { t, type Locale } from "@/lib/i18n";
import {
  commitSortKey,
  computeCommitHash,
  isRowVisible,
  type FilterableCommitType,
  type TimelineData,
} from "@/lib/log";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";

// =============================================================================
// YearRail — the log's years, down the desk's right margin.
//
// The log is already in order; what a reader loses fifteen rows down is where
// in it they are. The dates are there, one per row, but only for the rows on
// screen. So the margin carries the whole run, newest at the top, the way
// the log reads — a scrollbar that is labelled in years:
//
//   │ 2026
//   │ 2025
//   ┃ 2024   ← the year(s) of the row at the reading line: a talk lights its
//   │ 2023     one, a project its span (Hermes, 2020 – 2021)
//   │ 2022
//   │ 2021
//     2020   ← under a filter, a year with nothing left in it keeps its
//     2019     place, a rung quieter and not a button, so the scale stays
//     2018     a scale
//   │ 2017
//
// Pressing a year goes to the first row of it that is on the page, under
// whatever `?type=` is on.
//
// Years, not chapters. The pinned bar already wears the chapter at the line,
// and the chapters share their border years (2022 is the last of HEAD's rows
// and the first of React's), so a chapter's name on the rail would sit beside
// a year two of them claim.
//
// A desk's only, at `xl`: the margin right of the column is empty there — the
// hash hangs in the *left* one (the gutter, TimelineCommit) — and wide enough
// that a strip of three covers ends before the rail begins. Narrower, there
// is no margin to put it in, and a phone has each row's date already. Below
// `xl` it renders nothing at all, rather than something hidden, so the page
// there is the page it was.
//
// It follows the page without re-rendering it: the rail is its own small
// tree, reads a handful of rects per scroll, and sets state only when the
// row at the line changes (docs/system-attachments.md, "What the page costs
// to scroll").
// =============================================================================

/**
 * The reading line, from the top of the viewport: where a row comes to rest
 * when it is travelled to — `HEADROOM` in `useCommitAnchor`, which clears the
 * pinned bar with a row's room above. The same number here means a year you
 * press, or a `#hash` you land on, is the one that lights.
 */
const READING_LINE = 120;

/** Tailwind's `xl`, where the right margin has room for the rail. */
const XL_QUERY = "(min-width: 80rem)";

let xlMql: MediaQueryList | null = null;
const getXlMql = () => (xlMql ??= window.matchMedia(XL_QUERY));
const subscribeXl = (onChange: () => void) => {
  const mql = getXlMql();
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};

/** A row on the page, as the rail sees it. */
interface Mark {
  /** The row's element id (`computeCommitHash`). */
  hash: string;
  /** The year it sits at in the log's order — what pressing a year finds. */
  year: number;
  /** The years it covers — what lights while it is at the line. */
  from: number;
  to: number;
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

export function YearRail({
  data,
  types,
  locale,
}: {
  data: TimelineData[];
  types: FilterableCommitType[];
  locale: Locale;
}) {
  const wide = useSyncExternalStore(
    subscribeXl,
    () => getXlMql().matches,
    () => false,
  );
  if (!wide) return null;
  return <Rail data={data} types={types} locale={locale} />;
}

function Rail({
  data,
  types,
  locale,
}: {
  data: TimelineData[];
  types: FilterableCommitType[];
  locale: Locale;
}) {
  const reduced = useReducedMotion() ?? false;
  const navRef = useRef<HTMLElement>(null);

  // Every row the log prints under this filter, in the order it prints them
  // — `isRowVisible` is the question each TagBlock asks, so the rail and the
  // rows cannot disagree about what is on the page.
  const { marks, top, bottom } = useMemo(() => {
    // "Present" is the newest year the log has anything in — derived from
    // the data rather than the clock, the way the sort derives its order.
    const now = Math.max(
      ...data.flatMap(({ commits }) => commits.map((c) => yearOf(c.date))),
    );
    const at = (date: string) => (date.startsWith("9999") ? now : yearOf(date));
    const marks: Mark[] = data.flatMap(({ commits }) =>
      commits
        .filter((c) => isRowVisible(c, types))
        .map((c) => {
          const year = at(commitSortKey(c));
          const from = yearOf(c.date);
          const to = c.endDate
            ? c.endDate === "present"
              ? now
              : yearOf(c.endDate)
            : from;
          return {
            hash: computeCommitHash(c.id),
            year,
            from: Math.min(from, year),
            to: Math.max(to, year),
          };
        }),
    );
    // The rail runs as far as anything on the page reaches, not just as far
    // as the rows sit: filtered to projects, Lynx (2023 – present) still
    // lights the years up to now.
    return {
      marks,
      top: Math.max(...marks.map((m) => m.to)),
      bottom: Math.min(...marks.map((m) => m.from)),
    };
  }, [data, types]);

  // Which row is at the reading line, as an index into `marks`.
  const [active, setActive] = useState(0);
  // A pressed year holds the rail until the page arrives, and after, until
  // the reader moves it: the travel passes through every year between, and
  // the last rows of the log can never reach the line — the page ends
  // first — so without the hold, pressing 2015 could light 2014.
  const hold = useRef<{ index: number; top: number; arrived: boolean } | null>(
    null,
  );

  useEffect(() => {
    // A new set of rows (a filter, a locale) is a new page; a year held on
    // the old one means nothing on it.
    hold.current = null;
    const root = navRef.current?.closest("main") ?? document;
    // Resolved once, and again if a row is missing or has left the document
    // (a locale switch re-renders the log): a scroll should cost rects, not
    // queries.
    let els: (HTMLElement | null)[] = [];
    const resolve = () => {
      els = marks.map((m) =>
        root.querySelector<HTMLElement>(`[id="${m.hash}"][data-rail-row]`),
      );
    };
    resolve();

    const update = () => {
      const held = hold.current;
      if (held) {
        const here = Math.abs(pageScrollTop() - held.top) < 2;
        if (here || !held.arrived) {
          held.arrived ||= here;
          setActive(held.index);
          return;
        }
        hold.current = null;
      }
      if (els.some((el) => !el?.isConnected)) resolve();

      // The line slides to the bottom of the viewport over the page's last
      // screen, so the rows the page ends before they reach it still get
      // their turn — the last one is lit when there is no more page.
      const vh = pageViewportHeight();
      const rest = pageScrollHeight() - pageScrollTop() - vh;
      const line = READING_LINE + Math.max(0, vh - READING_LINE - rest);

      // The last row whose top has crossed the line. Rows are in page order,
      // so their tops only ever increase: a binary search reads a handful
      // of rects rather than one per row.
      let lo = 0;
      let hi = els.length - 1;
      let found = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const el = els[mid];
        const y = el ? el.getBoundingClientRect().top : Infinity;
        if (y <= line + 1) {
          found = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      setActive(found);
    };

    // The reader taking the page back releases a held year mid-travel.
    const release = () => {
      if (hold.current && !hold.current.arrived) hold.current = null;
    };

    update();
    const off = onPageScroll(update);
    // Rows change height without the page scrolling — a form switch, a row
    // opened by hand, a cover arriving — and the row at the line with them.
    const resize = new ResizeObserver(update);
    if (root instanceof HTMLElement) resize.observe(root);
    window.addEventListener("resize", update);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      off();
      resize.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("wheel", release);
      window.removeEventListener("keydown", release);
    };
  }, [marks]);

  if (marks.length === 0) return null;

  const current = marks[Math.min(active, marks.length - 1)];
  const filled = new Set(marks.map((m) => m.year));
  const years = Array.from({ length: top - bottom + 1 }, (_, i) => top - i);

  // Pressing a year while a chapter's track is held lets the track go — the
  // year takes focus from its marker, and anywhere else is how a hold ends
  // (LogTimeline) — so by the click the commits outside it have unfolded
  // again, and the offset read here is the page the reader arrives on.
  const goTo = (year: number) => {
    const index = marks.findIndex((m) => m.year === year);
    const el = navRef.current
      ?.closest("main")
      ?.querySelector<HTMLElement>(`[id="${marks[index]?.hash}"][data-rail-row]`);
    if (!el) return;
    const max = pageScrollHeight() - pageViewportHeight();
    const to = Math.min(max, Math.max(0, pageOffsetOf(el) - READING_LINE));
    hold.current = { index, top: to, arrived: false };
    setActive(index);
    scrollPageTo(to, { behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <nav
      ref={navRef}
      aria-label={t(locale, "logYearsLabel")}
      // In the margin, clear of the column and of a strip of three covers
      // (which ends a gutter short of it). Under the page's own layer and
      // over the wallpaper's (`-z-10`): the one strip long enough to reach
      // this far runs on under the bleed as it always did, and passes over
      // the numbers rather than being written on.
      className="fixed top-1/2 -z-[1] -translate-y-1/2"
      style={{ left: "calc(50% + var(--page-col) / 2 + 3.5rem)" }}
    >
      <ol className="flex flex-col">
        {years.map((year) => {
          const lit = year >= current.from && year <= current.to;
          if (!filled.has(year)) {
            // Nothing of this year is on the page: a place on the scale,
            // not a way in.
            return (
              <li
                key={year}
                aria-hidden
                className={cn(
                  TYPE.hash,
                  "flex h-5 items-center gap-2.5 leading-none tabular-nums transition-colors duration-300",
                  lit && "text-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-full w-px transition-colors duration-300",
                    lit && "bg-foreground",
                  )}
                />
                {year}
              </li>
            );
          }
          return (
            <li key={year}>
              <button
                type="button"
                onClick={() => goTo(year)}
                aria-current={year === current.year ? "location" : undefined}
                className={cn(
                  TYPE.rowMeta,
                  "group/year flex h-5 items-center gap-2.5 leading-none tabular-nums transition-colors duration-300",
                  lit ? "text-foreground" : "hover:text-foreground",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-full w-px transition-colors duration-300",
                    lit
                      ? "bg-foreground"
                      : "bg-border group-hover/year:bg-tertiary-foreground",
                  )}
                />
                {year}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
