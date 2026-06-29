"use client";

import { useMemo, useState } from "react";
import { PageLayout } from "@/components/ui/page-layout";
import { LogTimeline } from "@/components/log/log-timeline";
import { t, useLocale } from "@/services";
import { ChevronsDownUp, ChevronsUpDown, GitBranch } from "lucide-react";
import { buildTimelineData, type LogData } from "@/lib/log";

interface WorksViewProps {
  logData: LogData;
}

export function WorksView({ logData }: WorksViewProps) {
  const { locale } = useLocale();
  const data = useMemo(
    () => buildTimelineData(logData, locale),
    [logData, locale],
  );

  // `expandAll` is a bumped "command" rather than a mirror of every row's
  // state: each toggle flips the target and the timeline syncs every commit
  // to it, while individual rows stay freely toggleable in between.
  const [expandAll, setExpandAll] = useState(false);

  return (
    <PageLayout
      page="works"
      headerActions={
        <span className="inline-flex items-center gap-3 font-mono text-xs text-muted-foreground/60">
          <span className="inline-flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            <span>main</span>
          </span>
          {/* Expand/collapse all — echoes the `main` ref's mono/quiet vibe,
              reads as another git-log affordance rather than a UI chrome button. */}
          <button
            type="button"
            onClick={() => setExpandAll((v) => !v)}
            aria-pressed={expandAll}
            className="inline-flex items-center gap-1.5 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            {expandAll ? (
              <ChevronsDownUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
            <span>{t(locale, expandAll ? "logCollapseAll" : "logExpandAll")}</span>
          </button>
        </span>
      }
    >
      {/* Git Log Timeline */}
      <LogTimeline data={data} locale={locale} expandAll={expandAll} />

      {/* End marker — initial commit */}
      <div className="mt-8 py-4 font-mono text-xs text-muted-foreground/30">
        {t(locale, "logInit")}
      </div>
    </PageLayout>
  );
}
