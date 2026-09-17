"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageLayout } from "@/components/ui/page-layout";
import { LogTimeline } from "@/components/log/log-timeline";
import { CommitTypeFilter } from "@/components/log/type-filter";
import { t, useLocale } from "@/services";
import { ChevronsDownUp, ChevronsUpDown, GitBranch } from "lucide-react";
import {
  buildTimelineData,
  type CommitType,
  type LogData,
} from "@/lib/log";
import {
  availableCommitTypes,
  filterTimelineByTypes,
  parseCommitTypeParam,
  serializeCommitTypeParam,
} from "@/lib/log-filter";

interface WorksViewProps {
  logData: LogData;
}

export function WorksView({ logData }: WorksViewProps) {
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const timeline = useMemo(
    () => buildTimelineData(logData, locale),
    [logData, locale],
  );
  const types = availableCommitTypes(timeline);
  const selected = parseCommitTypeParam(searchParams.get("type"));
  const data = filterTimelineByTypes(timeline, selected);

  // `expandAll` is a bumped "command" rather than a mirror of every row's
  // state: each toggle flips the target and the timeline syncs every commit
  // to it, while individual rows stay freely toggleable in between.
  const [expandAll, setExpandAll] = useState(false);

  const setSelected = (next: Set<CommitType> | null) => {
    const params = new URLSearchParams(searchParams.toString());
    const serialized = serializeCommitTypeParam(next, types);
    if (serialized) params.set("type", serialized);
    else params.delete("type");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  return (
    <PageLayout
      page="works"
      headerActions={
        <span className="flex items-center gap-2 sm:gap-3 font-mono text-xs text-tertiary-foreground">
          {selected ? (
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label={t(locale, "logFilterReset")}
              className="inline-flex items-center gap-1.5 shrink-0 hover:text-foreground transition-colors"
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>main</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 shrink-0">
              <GitBranch className="h-3.5 w-3.5" />
              <span>main</span>
            </span>
          )}
          <CommitTypeFilter
            types={types}
            selected={selected}
            onChange={setSelected}
          />
          {/* Expand/collapse all — echoes the `main` ref's mono/quiet vibe,
              reads as another git-log affordance rather than a UI chrome button. */}
          <button
            type="button"
            onClick={() => setExpandAll((v) => !v)}
            aria-pressed={expandAll}
            className="ml-auto inline-flex items-center gap-1.5 shrink-0 text-tertiary-foreground hover:text-foreground transition-colors"
          >
            {expandAll ? (
              <ChevronsDownUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {t(locale, expandAll ? "logCollapseAll" : "logExpandAll")}
            </span>
          </button>
        </span>
      }
    >
      {data.length === 0 ? (
        <p className="font-mono text-xs text-tertiary-foreground">
          {t(locale, "logFilterEmpty")}
        </p>
      ) : (
        <LogTimeline
          data={data}
          locale={locale}
          expandAll={expandAll}
          identities={logData.identities}
        />
      )}

      {/* End marker — initial commit */}
      <div className="mt-8 py-4 font-mono text-xs text-tertiary-foreground">
        {t(locale, "logInit")}
      </div>
    </PageLayout>
  );
}
