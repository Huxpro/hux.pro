"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import { onPageScroll, pageOffsetOf, scrollPageTo } from "vitre";
import { t, useLocale } from "@/services";
import { isRowVisible, type Commit, type FilterableCommitType } from "@/lib/log";
import { cn } from "@/lib/utils";
import type { WorksIndex } from "@/lib/works-index";

// =============================================================================
// YearRail — the log's chronology, kept beside a page ordered by something
// else.
//
// /works is ordered by significance: Lynx first, the Flash years last. What
// that costs is the one thing the log did for free — the sense of when. So
// the desk's right margin carries the years, newest at the top, the way the
// log ran:
//
//   2026 ┃
//        ┃   ← the span of whatever is under the reading line: Lynx, as
//        ┃     you read Lynx; 2016–17 as you read Ele.me PWA
//   2023 ┃
//        ·
//        ·   ← a year with something in it; a gap is a year without
//   2016 ─
//
// It follows the reader rather than leading them: the span is of the
// project (or list) at the reading line, and moves as the page does. A
// year is also a way in: pressing one goes to the first thing on the page
// that has a row in it.
//
// A desk's only — at `xl`, where the margin has room for it without
// touching the rows' hashes, which hang in the *left* margin. A phone has
// the years in every row's date column, and no margin to spare.
// =============================================================================

/** Where the reading line sits, as a fraction of the viewport's height. */
const READING_LINE = 0.4;

/** Clears the pinned bar with room to read the row above. */
const HEADROOM = 96;

interface Span {
  id: string;
  years: Set<number>;
  from: number;
  to: number;
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Every year a commit covers: a talk its one, a tenure each of its. */
function yearsOf(c: Commit, now: number): number[] {
  const from = yearOf(c.date);
  const to = c.endDate
    ? c.endDate === "present"
      ? now
      : yearOf(c.endDate)
    : from;
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

export function YearRail({
  index,
  types,
}: {
  index: WorksIndex;
  types: FilterableCommitType[];
}) {
  const { locale } = useLocale();
  const reduced = useReducedMotion() ?? false;

  const { spans, top, bottom } = useMemo(() => {
    // "Present" is the newest year the log has anything in — derived from
    // the data rather than the clock, so a server render and the page it
    // hydrates agree.
    const now = Math.max(...index.context.map((c) => yearOf(c.date)));
    const spanOf = (id: string, rows: Commit[]): Span | null => {
      const years = new Set(
        rows
          .filter((c) => isRowVisible(c, types))
          .flatMap((c) => yearsOf(c, now)),
      );
      if (years.size === 0) return null;
      return { id, years, from: Math.min(...years), to: Math.max(...years) };
    };
    const all = [
      ...[...index.lead, ...index.more].map((e) =>
        spanOf(e.commit.id, e.history),
      ),
      ...index.sections.map((s) => spanOf(s.id, s.rows)),
    ].filter((s): s is Span => s !== null);
    return {
      spans: all,
      top: Math.max(...all.map((s) => s.to)),
      bottom: Math.min(...all.map((s) => s.from)),
    };
  }, [index, types]);

  // The container at the reading line: `[data-works-container]` on each
  // project row and list (components/works).
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const line = window.innerHeight * READING_LINE;
      let found: string | null = null;
      document
        .querySelectorAll<HTMLElement>("main [data-works-container]")
        .forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.top <= line && r.bottom >= line) {
            found = el.dataset.worksContainer ?? null;
          }
        });
      setActive(found);
    };
    update();
    const off = onPageScroll(update);
    window.addEventListener("resize", update);
    return () => {
      off();
      window.removeEventListener("resize", update);
    };
  }, [spans]);

  if (spans.length === 0) return null;

  const current = spans.find((s) => s.id === active) ?? null;
  const filled = new Set(spans.flatMap((s) => [...s.years]));
  const years = Array.from(
    { length: top - bottom + 1 },
    (_, i) => top - i,
  );

  const goTo = (year: number) => {
    const span = spans.find((s) => s.years.has(year));
    const el = span
      ? document.querySelector<HTMLElement>(
          `main [data-works-container="${span.id}"]`,
        )
      : null;
    if (!el) return;
    scrollPageTo(Math.max(0, pageOffsetOf(el) - HEADROOM), {
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <nav
      aria-label={t(locale, "worksYearsLabel")}
      className="fixed top-1/2 z-20 hidden -translate-y-1/2 xl:block"
      style={{ left: "calc(50% + var(--page-col) / 2 + 3.5rem)" }}
    >
      <ol className="flex flex-col font-mono text-[10px] leading-none tabular-nums">
        {years.map((year) => {
          const inSpan =
            current !== null && year >= current.from && year <= current.to;
          const has = filled.has(year);
          // Labelled: the ends of the rail, and the ends of the span in view.
          const labelled =
            year === top ||
            year === bottom ||
            (current !== null && (year === current.from || year === current.to));
          return (
            <li key={year}>
              <button
                type="button"
                disabled={!has}
                onClick={() => goTo(year)}
                aria-label={String(year)}
                title={String(year)}
                className="group/year flex h-4 items-center gap-2 disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-full w-[2px] rounded-full transition-colors duration-300",
                    inSpan
                      ? "bg-foreground"
                      : has
                        ? "bg-border group-hover/year:bg-tertiary-foreground"
                        : "bg-transparent",
                  )}
                />
                <span
                  className={cn(
                    "transition-opacity duration-300",
                    inSpan
                      ? "text-foreground"
                      : "text-quaternary-foreground group-hover/year:text-tertiary-foreground",
                    labelled
                      ? "opacity-100"
                      : "opacity-0 group-hover/year:opacity-100",
                  )}
                >
                  {year}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
