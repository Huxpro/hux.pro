"use client";

import { PageLayout } from "@/components/ui/page-layout";
import { LogTimeline } from "@/components/log/log-timeline";
import { LanguageFilter } from "@/components/post";
import { t, useLocale } from "@/services";
import { GitBranch } from "lucide-react";
import { type Tag, type Commit, shouldShowCommit } from "@/lib/log";
import { useState } from "react";

interface WorksViewProps {
  data: {
    tag: Tag;
    commits: Commit[];
  }[];
}

export function WorksView({ data }: WorksViewProps) {
  const { locale } = useLocale();
  const [includeOther, setIncludeOther] = useState(false);

  // Filter commits by language, remove tags with no visible commits
  const filteredData = data
    .map(({ tag, commits }) => ({
      tag,
      commits: commits.filter((c) =>
        shouldShowCommit(c, locale, includeOther)
      ),
    }))
    .filter(({ commits }) => commits.length > 0);

  return (
    <PageLayout
      page="works"
      headerActions={
        <span className="inline-flex items-center gap-3">
          <LanguageFilter
            includeOther={includeOther}
            setIncludeOther={setIncludeOther}
          />
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground/60">
            <GitBranch className="h-3.5 w-3.5" />
            <span>main</span>
          </span>
        </span>
      }
    >
      {/* Git Log Timeline */}
      <LogTimeline
        data={filteredData}
        locale={locale}
        includeOther={includeOther}
      />

      {/* End marker — initial commit */}
      <div className="mt-8 py-4 font-mono text-xs text-muted-foreground/30">
        {t(locale, "logInit")}
      </div>
    </PageLayout>
  );
}
