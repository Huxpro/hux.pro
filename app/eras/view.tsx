"use client";

import { useLocale } from "@/services";
import { SystemNav } from "@/components/ui/system-nav";
import { EraTimeline } from "@/components/eras/era-timeline";
import type { Era, WorkItem } from "@/lib/eras";

interface ErasViewProps {
  data: {
    era: Era;
    items: WorkItem[];
  }[];
}

export function ErasView({ data }: ErasViewProps) {
  const { locale } = useLocale();

  return (
    <main className="mx-auto max-w-[680px] px-6 pt-24 pb-32">
      {/* Back link - System UI */}
      <SystemNav href="/" path="λhux" className="mb-16" />

      {/* Header */}
      <header className="mb-20">
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
          {locale === "zh" ? "提交历史" : "Commit History"}
        </h1>
      </header>

      {/* Git Log Timeline */}
      <EraTimeline data={data} locale={locale} />

      {/* Footer / End marker */}
      <div className="mt-16 flex items-center gap-4">
        <div className="w-6 h-6 flex items-center justify-center shrink-0">
          <div className="w-3 h-3 rounded-full border-2 border-muted-foreground/30" />
        </div>
        <span className="font-mono text-xs text-muted-foreground/40 tracking-wide">
          git init
        </span>
      </div>
    </main>
  );
}
