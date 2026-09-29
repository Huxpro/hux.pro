"use client";

/**
 * Versions — one work, several tellings, one row.
 *
 * A work in several versions (lib/log-editions.ts) is one row on /works,
 * and the versions are alternatives of each other. In the covers form the
 * row's strip lays them across, a captioned column each
 * (media/segmented-strip.tsx). Where there is no strip (the index), they are
 * named here, where the title line already names a variant of the work,
 * the language badge:
 *
 *   React for Two Threads  EN · 中文                         Sep 2025
 *
 * One badge per version. When the versions differ by language, the badge is
 * the language, in the badge's own words (`EN`, `中文`); otherwise it is the
 * version's label (`Revised`, `Re-run`). The one the row is reading is lit,
 * and pressing another makes the row read it.
 */

import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";

export interface VersionView {
  id: string;
  /** What the badge says: `EN`, `中文`, `Revised`. */
  badge: string;
  /** The version in full, for the badge's tooltip: `SEE Conf 2025 · 中文版`. */
  line: string;
}

export function VersionBadges({
  versions,
  selected,
  onSelect,
}: {
  versions: readonly VersionView[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  // Inline, not a flex row: separated by ordinary spaces, so when the
  // badges wrap under a long title the next line starts at the column's
  // edge rather than indented by a margin.
  return (
    <span role="group" className={cn("align-baseline", TYPE.rowMeta)}>
      {versions.map((v, i) => (
        <span key={v.id}>
          {" "}
          {/* The separator travels with the badge after it, so a wrap never
              leaves a dot at the end of a line. */}
          <span className="whitespace-nowrap">
            {i > 0 && (
              <span aria-hidden className="mr-1.5 text-quaternary-foreground">
                ·
              </span>
            )}
            <button
              type="button"
              // A press inside the row that is not the row's press.
              onClick={(e) => {
                e.stopPropagation();
                onSelect(v.id);
              }}
              onKeyDown={(e) => e.stopPropagation()}
              aria-pressed={v.id === selected}
              title={v.line}
              className={cn(
                "whitespace-nowrap transition-colors",
                v.id === selected
                  ? "text-muted-foreground"
                  : "hover:text-muted-foreground",
              )}
            >
              {v.badge}
            </button>
          </span>
        </span>
      ))}
    </span>
  );
}
