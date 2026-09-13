"use client";

import { computeBylines } from "@/components/log/bylines";
import { normalizeCommit } from "@/components/log/commit-data";
import { TimelineMini } from "@/components/log/timeline-mini";
import {
  WidgetHeader,
  WidgetLink,
  WidgetScrollBody,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  type LogData,
  adjustRailForHidden,
  buildTimelineData,
  computeRail,
} from "@/lib/log";
import { t, useLocale } from "@/services";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// ProcessingWidget — a minimized /works timeline for the home grid.
//
// The vertical sibling of FeaturedTalksWidget's horizontal stack: the same
// commits as /works, in the same order, rendered as one snap-scrolling
// column of dense git-log rows. Only projects render (talks have their own
// featured card; posts, roles and events are noise at this size) — with
// link pills, author bylines and the expanded Author / Role block intact,
// and attachments (cards, videos, slides) stripped for the footprint.
//
// Everything is derived from `content/log.json` through the same helpers
// /works uses (`buildTimelineData`, `computeRail`, `computeBylines`,
// `normalizeCommit`), so the widget can't drift from the page.
// ---------------------------------------------------------------------------

/**
 * The commits the widget renders: projects only, newest first across every
 * chapter. Roles are carried along as hidden rows — they never render, but
 * they still anchor the tenure rail and resolve each project's byline.
 * Exported so the home grid can gate the widget's presence before mounting
 * the masonry slot.
 */
export function buildProcessingCommits(
  log: LogData,
  locale: Locale,
): CommitData[] {
  const commits = buildTimelineData(log, locale).flatMap(({ commits }) =>
    commits.flatMap((c): CommitData[] => {
      if (c.type === "project") return [c];
      if (c.type === "role") return [{ ...c, hideRow: true }];
      return [];
    }),
  );
  return commits.some((c) => c.type === "project") ? commits : [];
}

interface ProcessingWidgetProps {
  log: LogData;
  commits: CommitData[];
}

export function ProcessingWidget({ log, commits }: ProcessingWidgetProps) {
  const { locale } = useLocale();

  // Rail + bylines are derived from the filtered list, so clusters stay
  // contiguous even where /works would have interleaved talks between two
  // projects of the same tenure.
  const { rows, railInfo, bylines, hideDateFor } = useMemo(() => {
    const rail = adjustRailForHidden(commits, computeRail(commits));
    const bylines = computeBylines(commits, log.identities, locale);
    const rows = commits.map((c) => normalizeCommit(c, locale));
    const tagHideDate = new Map(log.tags.map((t) => [t.id, !!t.hideDate]));
    const hideDateFor = (c: CommitData) =>
      !!(tagHideDate.get(c.tagId) || c.hideDate);
    return { rows, railInfo: rail, bylines, hideDateFor };
  }, [commits, log.identities, log.tags, locale]);

  // Same tenure clustering as /works: consecutive rows sharing a segmentId
  // share a `group/tenure` wrapper so hovering any of them brightens the
  // rail and the role's ring.
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

  if (commits.length === 0) return null;

  return (
    <WidgetShell>
      <WidgetHeader className="pb-2">
        <WidgetTitle count={commits.filter((c) => c.type === "project").length}>
          {t(locale, "widgetStatus")}
        </WidgetTitle>
        <WidgetLink href="/works" label="View works" />
      </WidgetHeader>

      {/* Vertical snapping stack — the column analogue of the talks widget's
          horizontal card row. */}
      <WidgetScrollBody>
        {runs.map((run, runIdx) => {
          const nodes = run.indices.map((i) => (
            <TimelineMini
              key={commits[i].id}
              data={rows[i]}
              rail={railInfo[i].rail}
              isRole={commits[i].type === "role"}
              byline={bylines[i]}
              hideDate={hideDateFor(commits[i])}
              className="snap-start"
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
      </WidgetScrollBody>
    </WidgetShell>
  );
}
