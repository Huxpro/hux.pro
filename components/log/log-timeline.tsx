"use client";

import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  formatTagDateRange,
  getLocalizedTagTitle,
  type Tag,
} from "@/lib/log";
import { cn } from "@/lib/utils";
import { Commit } from "./commit-embed";

interface LogTimelineProps {
  data: {
    tag: Tag;
    commits: CommitData[];
  }[];
  locale: Locale;
}

function formatTagBadge(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("lynx")) return "LYNX";
  if (t.includes("react")) return "REACT";
  return title.toUpperCase();
}

/**
 * Git Log / Commit History style timeline.
 * Renders tags as branch separators and commits as work items.
 */
export function LogTimeline({ data, locale }: LogTimelineProps) {
  const isFirst = (index: number) => index === 0;

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div
        className="absolute left-[11px] top-0 bottom-0 w-px bg-border/60"
        aria-hidden="true"
      />

      {data.map(({ tag, commits }, tagIndex) => (
        <div
          key={tag.id}
          className={cn("relative", !isFirst(tagIndex) && "mt-8")}
        >
          {/*
            Layout strategy:
            1. Sticky badge row takes up h-6 (24px) in normal flow
            2. Header row uses -mt-6 to pull up and overlap, aligning with badge
            3. Both use h-6 containers so they align vertically
          */}

          {/* Sticky badge row - normal flow, explicit height for alignment */}
          <div className="sticky top-4 z-20 h-6 flex items-center pointer-events-none">
            <div className="inline-flex items-center bg-background/80 backdrop-blur px-3 py-0.5 border border-border rounded-full shadow-sm">
              <span className="font-mono text-xs font-medium text-foreground tracking-wide leading-none">
                {isFirst(tagIndex)
                  ? "HEAD"
                  : formatTagBadge(getLocalizedTagTitle(tag, locale))}
              </span>
            </div>
          </div>

          {/* HEAD marker for current tag - pulled up to align with sticky badge */}
          {isFirst(tagIndex) && (
            <div className="h-6 flex items-center mb-6 -mt-6">
              {/* Spacer for the sticky badge - matches badge width */}
              <div className="w-[72px] shrink-0" />
              <span className="font-mono text-xs text-muted-foreground/60">
                {locale === "zh" ? "当前" : "Current"}
                {" · "}
                {getLocalizedTagTitle(tag, locale)}
              </span>
            </div>
          )}

          {/* Tag Separator Header (for non-first tags) - pulled up to align */}
          {!isFirst(tagIndex) && (
            <div className="h-6 flex items-center mb-6 -mt-6">
              {/* Spacer for the sticky badge */}
              <div className="w-[72px] shrink-0" />
              <span className="flex-1 border-t border-dashed border-border/40" />
              <span className="font-mono text-[10px] text-muted-foreground/50 tracking-wide ml-3">
                {formatTagDateRange(tag, locale)}
              </span>
            </div>
          )}

          {/* Commits for this tag */}
          <div className="space-y-0">
            {commits.map((commit) => (
              <Commit
                key={commit.id}
                commit={commit}
                locale={locale}
                variant="timeline"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
