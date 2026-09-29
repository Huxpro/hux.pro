"use client";

/**
 * WorksContents — the career at a glance, above its first chapter.
 *
 *   ByteDance · Lynx     ▣                    2023 – Present
 *   Meta · React         ▣ ▣ ▣ ▣ ▣            2017 – 2022
 *   China · Mobile Web   ▣ ▣ ▣ ▣ ▣            2012 – 2017
 *   Early days           ▣                    2004 – 2012
 *
 * A résumé's first screen answers "where, when, and what" before any of it
 * is explained; the log's opened on its newest chapter and left the other
 * three a scroll away. This is the chapters as one line each — the name,
 * the work it holds as logos, the years — so the whole career is on the
 * first screen and every part of it is one tap away: the name goes to the
 * chapter's opener, a logo to the entry itself (the page's own permalink
 * travel, `useCommitAnchor`).
 *
 * Nothing here is new data. A line is a tag the page already prints, and
 * its logos are the work the chapter leads with (`leadWithWork`), in the
 * order the chapter prints them — the same `ProjectLogo` its entries wear,
 * so a mark here and a mark there are the same mark.
 *
 * Only in the résumé, and only while the page is about the work: one depth
 * down is the log, which has its own way of saying where you are (the
 * pinned bar's chapter), and a page filtered to talks has no use for a line
 * of project logos.
 */

import { computeCommitHash, formatTagDateRange, localize, type Commit, type Tag } from "@/lib/log";
import { t, type Locale } from "@/lib/i18n";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { pageOffsetOf, scrollPageTo } from "vitre";
import { useReducedMotion } from "motion/react";
import { ProjectLogo } from "./project-logo";

/** Where a chapter's opener comes to rest: clear of the pinned bar, the
 *  same headroom a permalink lands a row with (`useCommitAnchor`). */
const HEADROOM = 120;

export interface ContentsChapter {
  tag: Tag;
  /** The chapter's name, as its opener sets it (`chapterLabel`). */
  label: string;
  /** The work it holds, in the order the chapter prints it. */
  works: Commit[];
}

export function WorksContents({
  chapters,
  locale,
  onSelectHash,
}: {
  chapters: ContentsChapter[];
  locale: Locale;
  /** The page's permalink travel — a logo goes to its entry. */
  onSelectHash: (hash: string) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const toChapter = (id: string) => {
    const opener = document.getElementById(`chapter-${id}`);
    if (!opener) return;
    scrollPageTo(Math.max(0, pageOffsetOf(opener) - HEADROOM), {
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <nav aria-label={t(locale, "logContents")} className="mb-14 sm:mb-16">
      <ul className="-mx-3">
        {chapters.map(({ tag, label, works }) => (
          // A phone has no room for a years column beside five logos, so
          // there the years go under the name, and the logos keep a line.
          <li
            key={tag.id}
            className="grid grid-cols-[9rem_1fr] items-center gap-3 px-3 py-1.5 sm:grid-cols-[11rem_1fr_auto] sm:gap-4"
          >
            <button
              type="button"
              onClick={() => toChapter(tag.id)}
              className="group/chapter flex min-w-0 flex-col text-left"
            >
              <span
                className={cn(
                  "truncate transition-colors group-hover/chapter:text-muted-foreground",
                  TYPE.rowTitle,
                )}
              >
                {label}
              </span>
              {!tag.hideDate && (
                <span className={cn("sm:hidden", TYPE.rowMeta)}>
                  {formatTagDateRange(tag, locale)}
                </span>
              )}
            </button>
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              {works.map((c) => {
                const title = localize(c.title, locale);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectHash(computeCommitHash(c.id))}
                    title={title}
                    aria-label={title}
                    className="pressable rounded-[24%] transition-transform duration-150 hover:-translate-y-px"
                  >
                    <ProjectLogo
                      commitId={c.id}
                      locale={locale}
                      className="size-5"
                      monogramClassName="text-[10px]"
                    />
                  </button>
                );
              })}
            </span>
            {!tag.hideDate && (
              <span className={cn("hidden shrink-0 text-right sm:block", TYPE.rowMeta)}>
                {formatTagDateRange(tag, locale)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
