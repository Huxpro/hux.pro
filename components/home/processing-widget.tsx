"use client";

import { computeBylines } from "@/components/log/bylines";
import { normalizeCommit } from "@/components/log/commit-data";
import { TimelineMini } from "@/components/log/timeline-mini";
import {
  WidgetHeader,
  WidgetLink,
  WidgetShell,
  WidgetStatus,
  WidgetTitle,
} from "@/components/ui/widget";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  type LogData,
  type Tag,
  adjustRailForHidden,
  buildTimelineData,
  computeRail,
  formatTagDateRange,
  getLocalizedTagTitle,
} from "@/lib/log";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// ProcessingWidget — a minimized /works timeline for the home grid.
//
// The vertical sibling of FeaturedTalksWidget's horizontal stack: the same
// chapters (`HEAD` / `REACT + PL ERA` / …) and the same commits as /works,
// rendered as a snap-scrolling column of dense git-log rows. Talks are left
// out (they already have their own featured card), so what remains is the
// project / role / recognition spine of the log — with link pills, author
// bylines and the expanded Author / Role block intact, and attachments
// (cards, videos, slides) stripped for the widget's footprint.
//
// Everything is derived from `content/log.json` through the same helpers
// /works uses (`buildTimelineData`, `computeRail`, `computeBylines`,
// `normalizeCommit`), so the widget can't drift from the page.
// ---------------------------------------------------------------------------

/** Height of the sticky chapter chip row, in px. */
const CHAPTER_HEADER_PX = 32;

/** Commit types the mini timeline hides. */
const EXCLUDED_TYPES: ReadonlySet<CommitData["type"]> = new Set(["talk"]);

export interface ProcessingChapter {
  tag: Tag;
  /** Full (rail-computable) commit list for the chapter, talks excluded. */
  commits: CommitData[];
}

/**
 * Build the chapters the widget renders. Exported so the home grid can
 * gate the widget's presence before mounting the masonry slot.
 */
export function buildProcessingChapters(
  log: LogData,
  locale: Locale,
): ProcessingChapter[] {
  return buildTimelineData(log, locale)
    .map(({ tag, commits }) => ({
      tag,
      commits: commits.filter((c) => !EXCLUDED_TYPES.has(c.type)),
    }))
    .filter(({ commits }) =>
      commits.some((c) => !(c.type === "role" && c.hideRow === true)),
    );
}

interface ProcessingWidgetProps {
  log: LogData;
  chapters: ProcessingChapter[];
}

export function ProcessingWidget({ log, chapters }: ProcessingWidgetProps) {
  const { locale } = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeChapter, setActiveChapter] = useState(0);

  // The chapter whose block contains the scroll position "wins"; a small
  // bias keeps the sticky header's chapter active while its rows are still
  // in view rather than flipping the moment the next block's top edge
  // crosses the container's top.
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const probe = el.scrollTop + CHAPTER_HEADER_PX;
    let idx = 0;
    for (let i = 0; i < chapterRefs.current.length; i++) {
      const block = chapterRefs.current[i];
      if (block && block.offsetTop <= probe) idx = i;
    }
    setActiveChapter(idx);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollToChapter = useCallback((index: number) => {
    const el = scrollRef.current;
    const block = chapterRefs.current[index];
    if (!el || !block) return;
    el.scrollTo({ top: block.offsetTop, behavior: "smooth" });
  }, []);

  if (chapters.length === 0) return null;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-3">
        <div className="flex items-center gap-2">
          <WidgetStatus />
          <WidgetTitle>{t(locale, "widgetStatus")}</WidgetTitle>
        </div>
        <WidgetLink href="/works" label="View works" />
      </WidgetHeader>

      <div className="flex items-stretch pl-5 pr-3 pb-4">
        {/* Vertical snapping stack — the column analogue of the talks
            widget's horizontal card row. Rows snap under the sticky chapter
            chip (scroll-pt matches its height); events don't snap so a
            fling never lands on an annotation. */}
        <div
          ref={scrollRef}
          className={cn(
            "relative min-w-0 flex-1 h-64 pr-2",
            "overflow-y-auto snap-y snap-mandatory scroll-smooth",
            "no-scrollbar",
            "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]",
          )}
          style={{ scrollPaddingTop: CHAPTER_HEADER_PX }}
        >
          {chapters.map((chapter, i) => (
            <ChapterBlock
              key={chapter.tag.id}
              ref={(node) => {
                chapterRefs.current[i] = node;
              }}
              chapter={chapter}
              chapterIndex={i}
              log={log}
              locale={locale}
            />
          ))}
          {/* Tail spacer so the last row can snap to the top and the mask
              fade never sits on real content at rest. */}
          <div className="h-8" aria-hidden />
        </div>

        {chapters.length > 1 && (
          <div className="flex flex-col items-center justify-center gap-1.5 w-4 shrink-0">
            {chapters.map((chapter, i) => (
              <button
                key={chapter.tag.id}
                type="button"
                onClick={() => scrollToChapter(i)}
                aria-label={
                  i === 0 ? "HEAD" : getLocalizedTagTitle(chapter.tag, locale)
                }
                className={cn(
                  "w-1.5 rounded-full transition-all duration-200",
                  i === activeChapter
                    ? "h-3 bg-foreground/60"
                    : "h-1.5 bg-foreground/20 hover:bg-foreground/40",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

interface ChapterBlockProps {
  chapter: ProcessingChapter;
  chapterIndex: number;
  log: LogData;
  locale: Locale;
  ref: React.Ref<HTMLDivElement>;
}

function ChapterBlock({ chapter, chapterIndex, log, locale, ref }: ChapterBlockProps) {
  const { tag, commits } = chapter;
  const tagLabel =
    chapterIndex === 0 ? "HEAD" : getLocalizedTagTitle(tag, locale).toUpperCase();

  // Rail + bylines are derived from the talk-less list, so clusters stay
  // contiguous even where /works would have interleaved talks between
  // two projects of the same tenure.
  const { rows, railInfo, bylines } = useMemo(() => {
    const rail = adjustRailForHidden(commits, computeRail(commits));
    const bylines = computeBylines(commits, log.identities, locale);
    const rows = commits.map((c) => normalizeCommit(c, locale));
    return { rows, railInfo: rail, bylines };
  }, [commits, log.identities, locale]);

  // Same tenure clustering as /works: consecutive rows sharing a
  // segmentId share a `group/tenure` wrapper so hovering any of them
  // brightens the rail and the role's ring.
  const runs = useMemo(() => {
    type Run =
      | { kind: "loose"; indices: number[] }
      | { kind: "cluster"; segmentId: string; indices: number[] };
    const out: Run[] = [];
    for (let i = 0; i < commits.length; i++) {
      const c = commits[i];
      if (c.type === "role" && c.hideRow === true) continue;
      const sid = railInfo[i].segmentId;
      const last = out[out.length - 1];
      if (sid && last && last.kind === "cluster" && last.segmentId === sid) {
        last.indices.push(i);
      } else if (sid) {
        out.push({ kind: "cluster", segmentId: sid, indices: [i] });
      } else if (last && last.kind === "loose") {
        last.indices.push(i);
      } else {
        out.push({ kind: "loose", indices: [i] });
      }
    }
    return out;
  }, [commits, railInfo]);

  return (
    <div ref={ref} data-chapter={tag.id}>
      {/* Chapter ref marker — the same `git log --decorate` chip as /works,
          sticky inside the scroll port so the chapter stays named while its
          rows scroll under it. */}
      <div
        className="sticky top-0 z-10 flex items-center gap-2 py-1"
        style={{ height: CHAPTER_HEADER_PX }}
      >
        <span className="inline-flex items-center bg-white/70 dark:bg-black/25 backdrop-blur font-mono text-[11px] font-medium text-foreground px-2 py-px border border-border rounded-full">
          {tagLabel}
        </span>
        {!tag.hideDate && (
          <span className="font-mono text-[11px] text-muted-foreground/50 truncate">
            {formatTagDateRange(tag, locale)}
          </span>
        )}
      </div>

      <div className="relative">
        {runs.map((run, runIdx) => {
          const nodes = run.indices.map((i) => (
            <TimelineMini
              key={commits[i].id}
              data={rows[i]}
              rail={railInfo[i].rail}
              isRole={commits[i].type === "role"}
              byline={bylines[i]}
              hideDate={tag.hideDate || commits[i].hideDate}
              className={commits[i].type === "event" ? "snap-align-none" : "snap-start"}
            />
          ));
          return run.kind === "cluster" ? (
            <div key={`cluster-${run.segmentId}`} className="group/tenure">
              {nodes}
            </div>
          ) : (
            <div key={`loose-${runIdx}`}>{nodes}</div>
          );
        })}
      </div>
    </div>
  );
}
