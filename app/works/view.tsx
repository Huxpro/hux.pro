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
    <PageLayout title={t(locale, "logTitle")}>
      {/* Git Log Timeline */}
      <LogTimeline data={data} locale={locale} />

      {/* Footer / End marker */}
      <div className="mt-16 flex items-center gap-4">
        <div className="w-6 h-6 flex items-center justify-center shrink-0">
          <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
        </div>
        <span className="font-mono text-xs text-muted-foreground/40 tracking-wide">
          {t(locale, "logInit")}
        </span>
      </div>
    </PageLayout>
  );
}
