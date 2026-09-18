"use client";

import { computeBylines } from "@/components/log/bylines";
import { normalizeCommit } from "@/components/log/commit-data";
import { TimelineMini, type TimelineDetail } from "@/components/log/timeline-mini";
import {
  WidgetHeader,
  WidgetLink,
  WidgetScrollBody,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { sizeSpec } from "@/components/ui/widget-grid";
import { useWidgetSize } from "@/components/ui/widget-size";
import type { Locale } from "@/lib/i18n";
import {
  type Commit as CommitData,
  type LogData,
  adjustRailForHidden,
  isRowVisible,
  buildTimelineData,
  computeRail,
  resolveGroupCommits,
} from "@/lib/log";
import { t, useLocale } from "@/services";
import { useMemo } from "react";

// ---------------------------------------------------------------------------
// ProcessingWidget — a minimized /works timeline for the home grid.
//
// The vertical sibling of FeaturedTalksWidget's horizontal stack, and
// curated the same way: the talks card reads its `featured-*-talks` groups,
// this one reads `featured-projects`. A card is a preview, and a preview is
// a choice about what to show — a truncated list is not one. Rows are dense
// git-log lines with author bylines; link pills and attachments (cards,
// videos, slides) are left to /works, where each row permalinks.
//
// Everything is derived from `content/log.json` through the same helpers
// /works uses (`resolveGroupCommits`, `buildTimelineData`, `computeRail`,
// `computeBylines`, `normalizeCommit`), so the widget can't drift from the
// page, and what it shows is edited in the log rather than in here.
//
// Its footprint (the visitor's — docs/system-widget-grid.md) decides how
// each row is cut, never how many are hidden behind a scroll:
//
//   h = 1   the first two projects — "what's in flight".
//   h = 2   the curated group, one summary line and a byline each.
//   h = 3   each row also folds its description in under the summary.
//   w = 2   the log stays one column (the tenure rail can't be split), and
//           each row spreads sideways: the description beside the summary
//           — `git log` with the body alongside the subject.
// ---------------------------------------------------------------------------

export const PROCESSING_WIDGET_SIZE = sizeSpec([1, 1], [2, 3], [1, 2]);

/** The curated group that decides which projects the card shows. */
export const FEATURED_GROUP_ID = "featured-projects";

/** Where the card hands off — the same reading of /works it is a preview
 *  of, so arriving there does not mean finding these three in a column of
 *  twenty-five. */
export const PROJECTS_HREF = "/works?type=project";

/**
 * The commits the widget renders: the curated projects, in the log's own
 * order. Roles are carried along as hidden rows — they never render, but
 * they still anchor the tenure rail and resolve each project's byline, so
 * they are taken from the whole timeline rather than the curated slice.
 * Exported so the home grid can gate the widget's presence before mounting
 * the masonry slot.
 */
export function buildProcessingCommits(
  log: LogData,
  locale: Locale,
): CommitData[] {
  const group = log.groups?.find((g) => g.id === FEATURED_GROUP_ID);
  const featured = group
    ? new Set(
        resolveGroupCommits(group, log.commits, undefined, locale).map(
          (c) => c.id,
        ),
      )
    : null;

  const commits = buildTimelineData(log, locale).flatMap(({ commits }) =>
    commits.flatMap((c): CommitData[] => {
      if (c.type === "project") {
        return featured ? (featured.has(c.id) ? [c] : []) : [c];
      }
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
  const { w, h } = useWidgetSize(PROCESSING_WIDGET_SIZE.default);

  // Rail + bylines are derived from the filtered list, so clusters stay
  // contiguous even where /works would have interleaved talks between two
  // projects of the same tenure.
  const { rows, railInfo, bylines, hideDateFor } = useMemo(() => {
    // The widget has no filter, so the only thing hiding a row here is the
    // data itself.
    const rail = adjustRailForHidden(commits, computeRail(commits), (c) =>
      !isRowVisible(c),
    );
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

  const detail: TimelineDetail = w >= 2 ? "beside" : h >= 3 ? "below" : "none";
  // One cell tall: the first two projects, flat — no rail to draw between
  // two rows that may not share a tenure.
  const shown =
    h === 1 ? new Set(runs.flatMap((run) => run.indices).slice(0, 2)) : null;

  return (
    <WidgetShell href={PROJECTS_HREF}>
      <WidgetHeader className="pb-2">
        <WidgetTitle>{t(locale, "widgetStatus")}</WidgetTitle>
        <WidgetLink href={PROJECTS_HREF} label="View works" />
      </WidgetHeader>

      {/* No port, on any device: the group is short enough to print whole,
          so there is nothing to scroll and nothing to cut. */}
      <WidgetScrollBody className="min-h-0">
        {runs.map((run, runIdx) => {
          const indices = shown
            ? run.indices.filter((i) => shown.has(i))
            : run.indices;
          if (indices.length === 0) return null;
          const nodes = indices.map((i) => (
            <TimelineMini
              key={commits[i].id}
              data={rows[i]}
              rail={shown ? "" : railInfo[i].rail}
              isRole={commits[i].type === "role"}
              byline={bylines[i]}
              hideDate={hideDateFor(commits[i])}
              detail={detail}
            />
          ));
          return run.kind === "cluster" ? (
            // An identity can cluster twice (Meta, then RIT, then Meta
            // again), so the run is named by its first row, not its id.
            <div key={`cluster-${commits[run.indices[0]].id}`} className="group/tenure">
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
