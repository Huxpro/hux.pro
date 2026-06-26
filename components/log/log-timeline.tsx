"use client";

import { useCallback, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  computeBeams,
  computeRail,
  formatTagDateRange,
  getLocalizedTagTitle,
  type Tag,
} from "@/lib/log";
import { cn } from "@/lib/utils";
import { Commit } from "./commit-embed";
import { TimelineBeam } from "./timeline-beam";

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
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const handleSegmentHover = useCallback(
    (id: string | null) => setActiveSegment(id),
    [],
  );

  return (
    <div className="space-y-0">
      {data.map(({ tag, commits }, tagIndex) => (
        <TagBlock
          key={tag.id}
          tag={tag}
          commits={commits}
          tagIndex={tagIndex}
          locale={locale}
          activeSegment={activeSegment}
          onSegmentHover={handleSegmentHover}
        />
      ))}
    </div>
  );
}

interface TagBlockProps {
  tag: Tag;
  commits: CommitData[];
  tagIndex: number;
  locale: Locale;
  activeSegment: string | null;
  onSegmentHover: (id: string | null) => void;
}

function TagBlock({
  tag,
  commits,
  tagIndex,
  locale,
  activeSegment,
  onSegmentHover,
}: TagBlockProps) {
  const { railInfo, beams } = useMemo(() => {
    const rail = computeRail(commits);
    const links = computeBeams(commits);
    // Enrich rail so hovering a beam-source commit highlights its
    // target role's segment (mirroring how the bracket commits behave).
    for (const b of links) {
      if (rail[b.fromIdx].segmentId === null) {
        rail[b.fromIdx].segmentId = b.roleId;
      }
    }
    return { railInfo: rail, beams: links };
  }, [commits]);

  return (
    <div>
      {/* Tag ref marker — like `git log --decorate` ref annotations */}
      <div
        className={cn(
          "sticky top-4 z-20 flex items-center gap-3 py-2",
          tagIndex > 0 && "mt-6 pt-6 border-t border-border/30",
        )}
      >
        <span className="inline-flex items-center bg-background/80 backdrop-blur font-mono text-xs font-medium text-foreground px-2.5 py-0.5 border border-border rounded-full">
          {tagIndex === 0
            ? "HEAD"
            : getLocalizedTagTitle(tag, locale).toUpperCase()}
        </span>
        {!tag.hideDate && (
          <span className="font-mono text-xs text-muted-foreground/50">
            {formatTagDateRange(tag, locale)}
          </span>
        )}
      </div>

      {/* Commits — relative so beam overlays measure against this box. */}
      <div className="relative space-y-0">
        {commits.map((commit, i) => (
          <Commit
            key={commit.id}
            commit={commit}
            locale={locale}
            variant="timeline"
            hideDate={tag.hideDate}
            rail={railInfo[i].rail}
            segmentId={railInfo[i].segmentId}
            isSegmentActive={
              railInfo[i].segmentId !== null &&
              railInfo[i].segmentId === activeSegment
            }
            onSegmentHover={onSegmentHover}
          />
        ))}
        {beams.map((b) => (
          <TimelineBeam
            key={`${b.fromHash}->${b.toHash}`}
            fromHash={b.fromHash}
            toHash={b.toHash}
            active={activeSegment === b.roleId}
          />
        ))}
      </div>
    </div>
  );
}
