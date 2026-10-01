"use client";

import { useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { t, type Locale } from "@/lib/i18n";
import {
  FILTERABLE_COMMIT_TYPES,
  getCommitTypePluralLabel,
  type Commit,
} from "@/lib/log";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { GUTTER_PULL, HASH_CELL, RESUME_INDENT } from "./timeline-commit";

/** Where a row was given — the conference, the outlet — without the year
 *  the date column already prints (`GOSIM Paris 2026` → `GOSIM Paris`). */
function venueOf(c: Commit): string | null {
  const venue =
    c.type === "talk"
      ? c.conference.name
      : c.type === "press"
        ? c.platform
        : c.type === "post"
          ? c.publication.name
          : null;
  return venue ? venue.replace(/\s*(19|20)\d{2}$/, "") : null;
}

/**
 * The line a project's folded rows hang from (the `fold` flag) —
 *
 *   talks 10 · press 1        WeAreDevelopers World Congress, GOSIM Paris, …  ⌄
 *
 * directly under the project's row. Closed, it is the rows: how much was
 * said about the work, in the chips' own words and counts, and where,
 * newest first, for as long as the column has room. Open, the rows are under
 * it, so it drops the venues they print and is the label and the way back.
 *
 * It sits in the row's own grid — the empty hash cell, the rail column, the
 * title column — so its text starts where the project's title does, and a
 * tenure rail running through the project runs on through it (`rail`)
 * instead of breaking for a line that is not a commit.
 */
export function FoldLine({
  rows,
  open,
  rail,
  locale,
  resume = false,
  onToggle,
}: {
  /** The rows it holds that the page's filter shows. */
  rows: readonly Commit[];
  open: boolean;
  /** The project's rail continues below it, so it passes through here. */
  rail: boolean;
  locale: Locale;
  /** The project above is a résumé entry (the `resume` flag): start where
   *  its text does, past the tile, not where its tile does. */
  resume?: boolean;
  onToggle: () => void;
}) {
  const counts = FILTERABLE_COMMIT_TYPES.flatMap((type) => {
    const n = rows.filter((c) => c.type === type).length;
    return n > 0
      ? [`${getCommitTypePluralLabel(type, locale).toLocaleLowerCase()} ${n}`]
      : [];
  }).join(" · ");
  const venues = [
    ...new Set(rows.map(venueOf).filter((v): v is string => !!v)),
  ].join(t(locale, "logListSeparator"));

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      data-fold-line
      // The row's box (TimelineCommit's trigger): the same gutter pull, the
      // same wash, the same vertical clip so the rail stops at its edges.
      className={cn(
        "pressable relative -mx-3 px-3 py-1 rounded-lg cursor-pointer @container [clip-path:inset(0_-100vw)]",
        "transition-colors duration-150 hover:bg-muted/20 active:bg-muted/30",
        GUTTER_PULL,
      )}
    >
      <div className="grid grid-cols-[auto_1fr] lg:grid-cols-[auto_auto_1fr] gap-x-2 items-center">
        <span aria-hidden className={cn("hidden lg:inline-block", HASH_CELL)} />
        <span aria-hidden className="relative inline-flex w-5 h-4">
          {rail && (
            // `data-rail-above` so a tenure's hover brightens it with the
            // rest of the rail (globals.css) — it is the same line.
            <span
              data-rail-above
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px transition-colors duration-200 bg-muted-foreground/10"
              style={{ top: "-1000px", bottom: "-1000px" }}
            />
          )}
        </span>
        {/* Laid out as a title line (TimelineCommit): the counts where a
            title starts, and the right packed to the edge — the venues in
            the column a row's venue takes, the caret in the date's slot —
            so a fold line under a row reads down the same two columns the
            row does. It keeps one line on every viewport: where a row
            lifts its venue into an eyebrow below `@md`, the venues here are
            a teaser list that ends in `…` by design, so they stay beside
            the counts and cut. */}
        <span className={cn("flex min-w-0 items-baseline gap-3", resume && RESUME_INDENT)}>
          <span className={cn("shrink-0 tabular-nums", TYPE.label)}>{counts}</span>
          <span className="ml-auto flex min-w-0 max-w-[55%] items-baseline justify-end gap-2">
            {!open && venues && (
              <span className={cn("min-w-0 truncate text-right", TYPE.rowMeta)}>
                {venues}
              </span>
            )}
            <ChevronDown
              aria-hidden
              className={cn(
                "h-3.5 w-3.5 shrink-0 self-center text-tertiary-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </span>
        </span>
      </div>
    </div>
  );
}
