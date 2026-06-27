"use client";

import { useCallback, useMemo, useState } from "react";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  computeBeams,
  computeCommitHash,
  computeRail,
  formatTagDateRange,
  getLocalizedTagTitle,
  type Tag,
} from "@/lib/log";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "motion/react";
import { Commit } from "./commit-embed";
import { TimelineConnector } from "./timeline-connector";
import type { BeamSpec } from "./timeline-commit";

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
        <TagBlock
          key={tag.id}
          tag={tag}
          commits={commits}
          tagIndex={tagIndex}
          locale={locale}
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
}

function TagBlock({ tag, commits, tagIndex, locale }: TagBlockProps) {
  const [activeBeam, setActiveBeam] = useState<BeamSpec | null>(null);
  const handleBeamSet = useCallback(
    (spec: BeamSpec) => setActiveBeam(spec),
    [],
  );
  // Stale-write guard: React runs sibling useEffects in document order,
  // so a row higher up the list can fire its "set" before a row lower
  // down fires its "clear" for the same hover transition. Ignore the
  // clear if the active beam no longer matches the leaving row's spec.
  const handleBeamClear = useCallback(
    (spec: BeamSpec) =>
      setActiveBeam((current) =>
        current &&
        current.fromHash === spec.fromHash &&
        current.toHash === spec.toHash
          ? null
          : current,
      ),
    [],
  );

  // For each commit, compute the beam it should emit when hovered.
  // - A tenure member or explicitly-attached commit emits a beam from
  //   itself up to its role.
  // - A role with members emits a "comprehensive" beam from its
  //   segment-end commit up to itself, the same long span the bracket
  //   already draws.
  const { railInfo, beamSpecs } = useMemo(() => {
    const rail = computeRail(commits);
    const explicit = computeBeams(commits);

    const specs: (BeamSpec | null)[] = commits.map(() => null);

    // Tenure: find each role's segmentEnd; emit per-member and comprehensive.
    const roleIdxBySegment = new Map<string, number>();
    const endIdxBySegment = new Map<string, number>();
    for (let i = 0; i < commits.length; i++) {
      const sid = rail[i].segmentId;
      if (!sid) continue;
      if (rail[i].rail === "┐") roleIdxBySegment.set(sid, i);
      if (rail[i].rail === "┘") endIdxBySegment.set(sid, i);
    }
    for (let i = 0; i < commits.length; i++) {
      const sid = rail[i].segmentId;
      if (!sid) continue;
      const roleIdx = roleIdxBySegment.get(sid);
      const endIdx = endIdxBySegment.get(sid);
      if (roleIdx === undefined || endIdx === undefined) continue;
      if (i === roleIdx) {
        // Role hover → comprehensive beam (segmentEnd → role).
        specs[i] = {
          fromHash: computeCommitHash(commits[endIdx].id),
          toHash: computeCommitHash(commits[roleIdx].id),
          roleId: sid,
        };
      } else {
        // Member hover → this commit → role.
        specs[i] = {
          fromHash: computeCommitHash(commits[i].id),
          toHash: computeCommitHash(commits[roleIdx].id),
          roleId: sid,
        };
      }
    }

    // Explicit attachedTo: enrich rail (so the bracket-active style
    // still works) AND set a per-commit beam spec.
    for (const b of explicit) {
      if (rail[b.fromIdx].segmentId === null) {
        rail[b.fromIdx].segmentId = b.roleId;
      }
      specs[b.fromIdx] = {
        fromHash: b.fromHash,
        toHash: b.toHash,
        roleId: b.roleId,
      };
      // Also let the target role emit a beam back from this commit, so
      // hovering the role lights up the explicit attachment.
      if (specs[b.toIdx] === null) {
        specs[b.toIdx] = {
          fromHash: b.fromHash,
          toHash: b.toHash,
          roleId: b.roleId,
        };
      }
    }

    return { railInfo: rail, beamSpecs: specs };
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
        {/* Frosted-glass fill: translucent + blurred so the ambient gradient
            shows through and gets tinted per-theme rather than covered by a
            flat opaque patch. The tint direction follows the theme — lighten
            toward white in light mode (keeping the near-white chip it always
            was), darken with black in dark mode (the "shade darker than the
            page" look). Compositing a tint at alpha α over backdrop B gives a
            uniform shift, so a solid background reads the same as before while
            a gradient keeps its hue. */}
        <span className="inline-flex items-center bg-white/70 dark:bg-black/25 backdrop-blur font-mono text-xs font-medium text-foreground px-2.5 py-0.5 border border-border rounded-full">
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

      {/* Commits — relative so the beam measures against this box. */}
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
              railInfo[i].segmentId === activeBeam?.roleId
            }
            beamSpec={beamSpecs[i]}
            onBeamSet={handleBeamSet}
            onBeamClear={handleBeamClear}
          />
        ))}
        <AnimatePresence>
          {activeBeam && (
            <TimelineConnector
              key={`${activeBeam.fromHash}->${activeBeam.toHash}`}
              fromHash={activeBeam.fromHash}
              toHash={activeBeam.toHash}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
