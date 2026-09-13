"use client";

import { VStackWidget } from "@/components/home/featured-stack-widget";
import { Commit } from "@/components/log";
import { WidgetStatus } from "@/components/ui/widget";
import logData from "@/content/log.json";
import type { Commit as CommitData, RawLogData } from "@/lib/log";
import {
  getWidgetProjectCommits,
  normalizeLogData,
  resolveCommitByline,
} from "@/lib/log";
import { enrichLogDataWithPreviews, type OGSnapshot } from "@/lib/og-enrich";
import ogSnapshotJson from "@/content/og-snapshot.json";
import { t, useLocale } from "@/services";
import { useMemo } from "react";

// Same enrichment path as the home page / /works so project rows resolve
// from the commit log (links, identity, role) without a second source.
const log = enrichLogDataWithPreviews(
  normalizeLogData(logData as unknown as RawLogData),
  ogSnapshotJson as OGSnapshot,
);

/**
 * ProcessingWidget — a miniature /works timeline on the home grid.
 *
 * Vertical snap stack (the talks widget's horizontal stack, rotated):
 * one project at a time, peek of the next, dots. Talks are excluded
 * (they already have featured talks). Attachments stay off; links,
 * author, and role come straight from the commit + identity.
 */
export function ProcessingWidget() {
  const { locale } = useLocale();
  const projects = useMemo(
    () => getWidgetProjectCommits(log.commits as CommitData[], locale),
    [locale],
  );

  if (projects.length === 0) return null;

  return (
    <VStackWidget
      title={t(locale, "widgetStatus")}
      href="/works"
      leading={<WidgetStatus />}
      snap
    >
      {projects.map((commit) => (
        <Commit
          key={commit.id}
          commit={commit}
          locale={locale}
          variant="mini"
          byline={resolveCommitByline(
            commit,
            log.commits as CommitData[],
            log.identities,
            locale,
          )}
        />
      ))}
    </VStackWidget>
  );
}
