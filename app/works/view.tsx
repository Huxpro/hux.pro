"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { LogTimeline } from "@/components/log/log-timeline";
import { t, useLocale } from "@/services";
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
    <PageLayout page="works">
      {/* Git Log Timeline */}
      <LogTimeline data={data} locale={locale} />

      {/* End marker — initial commit */}
      <div className="mt-8 py-4 font-mono text-xs text-muted-foreground/30">
        {t(locale, "logInit")}
      </div>
    </PageLayout>
  );
}
