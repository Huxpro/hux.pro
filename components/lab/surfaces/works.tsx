"use client";

import { useLabStrings } from "@/app/lab/i18n";
import logData from "@/content/log.json";
import { localize, normalizeLogData, type RawLogData } from "@/lib/log";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useMemo } from "react";
import { SurfaceFrame } from "./frame";
import { SURFACE_STRINGS } from "./strings";

const log = normalizeLogData(logData as unknown as RawLogData);

/** The Works Lab at a glance: the head of the log, as a git log. */
export function WorksSurface() {
  const { locale } = useLocale();
  const S = useLabStrings(SURFACE_STRINGS);
  const recent = useMemo(
    () =>
      log.commits
        .filter((c) => c.type !== "role" && c.listed !== false)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    [],
  );

  return (
    <SurfaceFrame className="flex flex-col justify-center px-4 py-3">
      <ol className="relative space-y-1.5">
        {/* The rail the timeline draws its commits on. */}
        <span aria-hidden className="absolute bottom-1.5 left-[3px] top-1.5 w-px bg-border" />
        {recent.map((commit, i) => (
          <li key={commit.id} className="relative flex items-center gap-2.5">
            <span
              className={cn(
                "size-[7px] shrink-0 rounded-full border border-background",
                i === 0 ? "bg-foreground" : "bg-foreground/40",
              )}
            />
            <span className={cn(TYPE.rowMeta, "shrink-0 text-[10px] tabular-nums")}>{commit.date.slice(0, 7)}</span>
            <span className="truncate text-xs text-foreground">{localize(commit.title, locale)}</span>
          </li>
        ))}
      </ol>
      <p className={cn(TYPE.labelSm, "mt-2.5 pl-[17px]")}>
        {S.logSummary(log.commits.length, log.tags.length)}
      </p>
    </SurfaceFrame>
  );
}
