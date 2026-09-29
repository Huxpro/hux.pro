"use client";

/**
 * SquashRow — one line standing for a run of talks (lib/log-view.ts,
 * `computeSquashRuns`).
 *
 *   ···   ◔  12 talks  React Advanced London, React Universe Conf, …  2023 – 2026 ⌄
 *
 * It is drawn on the commit row's own grid — the hash column, the mark
 * column, the title line — so it sits in the log as a row would, with the
 * tenure rail running through its mark where the rows it folds were part
 * of one. The hash column prints `···`, the ellipsis of a range; the mark
 * is the type's, when the run is all one type. The line says how many and
 * where, and the date column the years they span; pressing it unfolds the
 * rows in place, under this line, which stays as the way back.
 */

import { useCallback, type KeyboardEvent } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { formatDateRange, type Commit, type CommitType } from "@/lib/log";
import { CommitIcon } from "./icons";

/** The same pull the commit row uses to hang its gutter in the margin. */
const GUTTER_PULL = "lg:-ml-[6.5rem]";
const HASH_CELL = "lg:w-14 lg:text-right";

/** Where a talk or a piece of press happened. */
function venueOf(commit: Commit): string | undefined {
  switch (commit.type) {
    case "talk":
      return commit.conference.name;
    case "post":
      return commit.publication.name;
    case "press":
      return commit.platform;
    default:
      return undefined;
  }
}

const COUNT_KEY = {
  talk: "logSquashTalk",
  press: "logSquashPress",
  post: "logSquashPost",
} as const;

/** `12 talks`, or `2 talks · 1 press` for a mixed run. */
function countLabel(commits: readonly Commit[], locale: Locale): string {
  const counts = new Map<CommitType, number>();
  for (const c of commits) counts.set(c.type, (counts.get(c.type) ?? 0) + 1);
  return (["talk", "press", "post"] as const)
    .filter((type) => counts.has(type))
    .map((type) => t(locale, COUNT_KEY[type]).replace("{n}", String(counts.get(type))))
    .join(" · ");
}

interface SquashRowProps {
  /** The rows the line stands for, in the chapter's order (newest first). */
  commits: readonly Commit[];
  locale: Locale;
  open: boolean;
  onToggle: () => void;
  /** Whether the tenure rail runs through this line: the rows around it
   *  are one run of the same tenure, and this sits between them. */
  rail?: boolean;
}

export function SquashRow({
  commits,
  locale,
  open,
  onToggle,
  rail = false,
}: SquashRowProps) {
  const types = new Set(commits.map((c) => c.type));
  const type = types.size === 1 ? commits[0].type : null;
  const venues = [
    ...new Set(commits.map(venueOf).filter((v): v is string => !!v)),
  ];
  // Newest first in the log, so the span reads oldest to newest the way a
  // chapter's date range does.
  const newest = commits[0].date;
  const oldest = commits[commits.length - 1].date;
  const span = formatDateRange(oldest, newest, locale);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  return (
    <div
      data-rail-row
      role="button"
      tabIndex={0}
      aria-expanded={open}
      title={t(locale, open ? "logSquashClose" : "logSquashOpen")}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative -mx-3 px-3 rounded-lg py-2 transition-colors duration-150 [clip-path:inset(0_-100vw)]",
        GUTTER_PULL,
        "pressable cursor-pointer @container hover:bg-muted/20 active:bg-muted/30",
      )}
    >
      <div className="grid grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
        {/* The range's hash: an ellipsis, in the hash's own ink. */}
        <span
          aria-hidden
          className={cn("hidden @sm:inline-block leading-5", HASH_CELL, TYPE.hash)}
        >
          ···
        </span>

        <span
          data-rail-icon
          className="relative inline-flex items-center justify-center w-5 h-5"
        >
          {rail && (
            <>
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-muted-foreground/10"
                style={{ top: "-1000px", bottom: "calc(50% + 7px)" }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px bg-muted-foreground/10"
                style={{ top: "calc(50% + 7px)", bottom: "-1000px" }}
              />
            </>
          )}
          {type ? (
            <CommitIcon type={type} className="w-3 h-3 text-quaternary-foreground" />
          ) : (
            <span
              aria-hidden
              className="block w-[3px] h-[3px] rounded-full bg-muted-foreground/30"
            />
          )}
        </span>

        <div className="flex items-baseline gap-2 min-w-0">
          <span className={cn("shrink-0 text-sm text-muted-foreground")}>
            {countLabel(commits, locale)}
          </span>
          {venues.length > 0 && (
            <span className={cn("min-w-0 flex-1 truncate", TYPE.rowMeta)}>
              {venues.join(", ")}
            </span>
          )}
          <span className={cn("shrink-0 ml-auto inline-flex items-center gap-1.5", TYPE.rowMeta)}>
            {span}
            <ChevronDown
              aria-hidden
              className={cn(
                "h-3 w-3 text-quaternary-foreground transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
