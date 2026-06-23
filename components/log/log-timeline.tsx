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

/**
 * Git Log / Commit History style timeline.
 * Renders tags as ref markers and commits as dense log entries.
 */
export function LogTimeline({ data, locale }: LogTimelineProps) {
  return (
    <div className="space-y-0">
      {data.map(({ tag, commits }, tagIndex) => (
        <div key={tag.id}>
          {/* Tag ref marker — like `git log --decorate` ref annotations */}
          <div
            className={cn(
              "sticky top-4 z-20 flex items-center gap-3 py-2",
              tagIndex > 0 && "mt-6 pt-6 border-t border-border/30",
            )}
          >
            <span
              className="inline-flex items-center bg-background/80 backdrop-blur font-mono text-xs font-medium text-foreground px-2.5 py-0.5 border border-border rounded-full"
              style={
                tag.accentColor
                  ? { color: tag.accentColor, borderColor: tag.accentColor }
                  : undefined
              }
            >
              {tagIndex === 0
                ? "HEAD"
                : getLocalizedTagTitle(tag, locale).toUpperCase()}
            </span>
            <span className="font-mono text-xs text-muted-foreground/50">
              {formatTagDateRange(tag, locale)}
            </span>
          </div>

          {/* Commits */}
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
