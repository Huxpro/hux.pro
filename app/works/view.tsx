"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { LogTimeline } from "@/components/log/log-timeline";
import { t, useLocale } from "@/services";
import { GitBranch } from "lucide-react";
import type { Tag, Commit } from "@/lib/log";

interface WorksViewProps {
  data: {
    tag: Tag;
    commits: Commit[];
  }[];
}

export function WorksView({ data }: WorksViewProps) {
  const { locale } = useLocale();

  return (
    <PageLayout
      page="works"
      headerActions={
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground/60">
          <GitBranch className="h-3.5 w-3.5" />
          <span>main</span>
        </span>
      }
    >
      {/* Git Log Timeline */}
      <LogTimeline data={data} locale={locale} />

      {/* End marker — initial commit */}
      <div className="mt-8 py-4 font-mono text-xs text-muted-foreground/30">
        {t(locale, "logInit")}
      </div>
    </PageLayout>
  );
}
