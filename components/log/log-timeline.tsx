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

  // Compute beam specs for explicit `attachedTo` attachments. Both
  // endpoints (source + target) carry the same spec so hovering/
  // focusing/expanding EITHER end brightens the connector line.
  // Per-endpoint gap is derived from the commit's type so the line
  // meets each endpoint at the right radius (role ring vs icon vs
  // event dot).
  const gapFor = (type: CommitData["type"]) =>
    type === "role" ? 10 : type === "event" ? 3 : 7;

  const { railInfo, beamSpecs, attachments } = useMemo(() => {
    const rail = computeRail(commits);
    const explicit = computeBeams(commits);

    const specs: (BeamSpec | null)[] = commits.map(() => null);

    const attachmentsWithGaps = explicit.map((b) => ({
      ...b,
      fromGap: gapFor(commits[b.fromIdx].type),
      toGap: gapFor(commits[b.toIdx].type),
    }));

    for (const b of explicit) {
      if (rail[b.fromIdx].segmentId === null) {
        rail[b.fromIdx].segmentId = b.roleId;
      }
      const spec: BeamSpec = {
        fromHash: b.fromHash,
        toHash: b.toHash,
        roleId: b.roleId,
      };
      specs[b.fromIdx] = spec;
      if (specs[b.toIdx] === null) {
        specs[b.toIdx] = spec;
      }
    }

    return {
      railInfo: rail,
      beamSpecs: specs,
      attachments: attachmentsWithGaps,
    };
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

      {/* Commits — relative so the beam measures against this box.
       *  Consecutive commits sharing a tenure segmentId are wrapped in
       *  a `group/tenure` div so hovering/focusing/expanding ANY row in
       *  the cluster brightens the rail and the role's ring. */}
      <div className="relative space-y-0">
        {(() => {
          type Run =
            | { kind: "loose"; indices: number[] }
            | { kind: "cluster"; segmentId: string; indices: number[] };
          const runs: Run[] = [];
          for (let i = 0; i < commits.length; i++) {
            const sid = railInfo[i].segmentId;
            const last = runs[runs.length - 1];
            if (sid && last && last.kind === "cluster" && last.segmentId === sid) {
              last.indices.push(i);
            } else if (sid) {
              runs.push({ kind: "cluster", segmentId: sid, indices: [i] });
            } else if (last && last.kind === "loose") {
              last.indices.push(i);
            } else {
              runs.push({ kind: "loose", indices: [i] });
            }
          }
          return runs.map((run, runIdx) => {
            const rows = run.indices.map((i) => (
              <Commit
                key={commits[i].id}
                commit={commits[i]}
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
            ));
            return run.kind === "cluster" ? (
              <div key={`cluster-${run.segmentId}`} className="group/tenure">
                {rows}
              </div>
            ) : (
              <div key={`loose-${runIdx}`}>{rows}</div>
            );
          });
        })()}
        {/* Persistent back-point connectors — one per explicit
         *  attachedTo. They run through the icon column (same visual
         *  vocabulary as the tenure rail), dimmed by default and
         *  brightened when EITHER endpoint is the activeBeam. */}
        {attachments.map((a) => (
          <TimelineConnector
            key={`${a.fromHash}->${a.toHash}`}
            fromHash={a.fromHash}
            toHash={a.toHash}
            fromGap={a.fromGap}
            toGap={a.toGap}
            isActive={
              activeBeam?.fromHash === a.fromHash &&
              activeBeam?.toHash === a.toHash
            }
          />
        ))}
      </div>
    </div>
  );
}
