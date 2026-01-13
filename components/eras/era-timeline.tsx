"use client";

import { cn } from "@/lib/utils";
import {
  type Era,
  type WorkItem,
  getLocalizedEraTitle,
  formatEraDateRange,
} from "@/lib/eras";
import type { Locale } from "@/lib/i18n";
import { TimelineItem } from "./work-item-embed";

interface EraTimelineProps {
  data: {
    era: Era;
    items: WorkItem[];
  }[];
  locale: Locale;
}

function formatEraBadge(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("lynx")) return "LYNX";
  if (t.includes("react")) return "REACT";
  return title.toUpperCase();
}

/**
 * Git Log / Commit History style timeline.
 * Renders eras as branch separators and work items as commits.
 */
export function EraTimeline({ data, locale }: EraTimelineProps) {
  const isFirst = (index: number) => index === 0;

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div
        className="absolute left-[11px] top-0 bottom-0 w-px bg-border/60"
        aria-hidden="true"
      />

      {data.map(({ era, items }, eraIndex) => (
        <div
          key={era.id}
          className={cn("relative", !isFirst(eraIndex) && "mt-8")}
        >
          {/*
            Layout strategy:
            1. Sticky badge row takes up h-6 (24px) in normal flow
            2. Header row uses -mt-6 to pull up and overlap, aligning with badge
            3. Both use h-6 containers so they align vertically
          */}

          {/* Sticky badge row - normal flow, explicit height for alignment */}
          <div className="sticky top-4 z-20 h-6 flex items-center pointer-events-none">
            <div className="inline-flex items-center bg-background/80 backdrop-blur px-3 py-0.5 border border-border rounded-full shadow-sm">
              <span className="font-mono text-xs font-medium text-foreground tracking-wide leading-none">
                {isFirst(eraIndex)
                  ? "HEAD"
                  : formatEraBadge(getLocalizedEraTitle(era, locale))}
              </span>
            </div>
          </div>

          {/* HEAD marker for current era - pulled up to align with sticky badge */}
          {isFirst(eraIndex) && (
            <div className="h-6 flex items-center mb-6 -mt-6">
              {/* Spacer for the sticky badge - matches badge width */}
              <div className="w-[72px] shrink-0" />
              <span className="font-mono text-xs text-muted-foreground/60">
                {locale === "zh" ? "当前" : "Current"}
                {" · "}
                {getLocalizedEraTitle(era, locale)}
              </span>
            </div>
          )}

          {/* Era Separator Header (for non-first eras) - pulled up to align */}
          {!isFirst(eraIndex) && (
            <div className="h-6 flex items-center mb-6 -mt-6">
              {/* Spacer for the sticky badge */}
              <div className="w-[72px] shrink-0" />
              <span className="flex-1 border-t border-dashed border-border/40" />
              <span className="font-mono text-[10px] text-muted-foreground/50 tracking-wide ml-3">
                {formatEraDateRange(era, locale)}
              </span>
            </div>
          )}

          {/* Work items for this era */}
          <div className="space-y-0">
            {items.map((item, itemIndex) => (
              <TimelineItem
                key={item.id}
                item={item}
                locale={locale}
                isFirst={isFirst(eraIndex) && itemIndex === 0}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
