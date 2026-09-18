"use client";

import { computeBylines } from "@/components/log/bylines";
import { normalizeCommit } from "@/components/log/commit-data";
import { TimelineMini, type TimelineDetail } from "@/components/log/timeline-mini";
import {
  WidgetBody,
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
// A collection widget, so its footprint decides how much of the collection
// shows and how each row is cut:
//
//   h = 1   the two newest projects, no port — "what's in flight".
//   h ≥ 2   the scrolling log; from three cells tall each row also carries
//           its description, folded in under the summary.
//   w = 2   the log stays one column (the tenure rail can't be split), and
//           each row spreads sideways: summary on the left, the description
//           beside it — `git log` with the body alongside the subject.
//
// Everything is derived from `content/log.json` through the same helpers
// /works uses (`buildTimelineData`, `computeRail`, `computeBylines`,
// `normalizeCommit`), so the widget can't drift from the page.
// ---------------------------------------------------------------------------

export const PROCESSING_WIDGET_SIZE = sizeSpec([1, 1], [2, 3], [1, 2]);

/**
 * The commits the widget renders: projects only, newest first across every
 * chapter. Roles are carried along as hidden rows — they never render, but
 * they still anchor the tenure rail and resolve each project's byline.
 * Exported so the home grid can gate the widget's presence before mounting
 * the grid slot.
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
  const { w, h } = useWidgetSize(PROCESSING_WIDGET_SIZE.default);

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

  const detail: TimelineDetail = w >= 2 ? "beside" : h >= 3 ? "below" : "none";

  // One cell tall: the newest two projects, and nothing to scroll.
  if (h === 1) {
    const shown = runs
      .flatMap((run) => run.indices)
      .slice(0, 2);
    return (
      <WidgetShell href="/works">
        <WidgetHeader className="pb-2">
          <WidgetTitle>{t(locale, "widgetStatus")}</WidgetTitle>
          <WidgetLink href="/works" label="View works" />
        </WidgetHeader>
        <WidgetBody className="min-h-0 overflow-hidden">
          {shown.map((i) => (
            <TimelineMini
              key={commits[i].id}
              data={rows[i]}
              rail=""
              isRole={commits[i].type === "role"}
              byline={bylines[i]}
              hideDate={hideDateFor(commits[i])}
              detail={detail}
            />
          ))}
        </WidgetBody>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell href="/works">
      <WidgetHeader className="pb-2">
        <WidgetTitle>{t(locale, "widgetStatus")}</WidgetTitle>
        <WidgetLink href="/works" label="View works" />
      </WidgetHeader>

      {/* Vertical snapping stack — the column analogue of the talks widget's
          horizontal card row. */}
      <WidgetScrollBody fill>
        {runs.map((run, runIdx) => {
          const nodes = run.indices.map((i) => (
            <TimelineMini
              key={commits[i].id}
              data={rows[i]}
              rail={railInfo[i].rail}
              isRole={commits[i].type === "role"}
              byline={bylines[i]}
              hideDate={hideDateFor(commits[i])}
              detail={detail}
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
