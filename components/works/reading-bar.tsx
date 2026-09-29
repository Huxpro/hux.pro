"use client";

import { useReducedMotion } from "motion/react";
import { pageOffsetOf, scrollPageTo } from "vitre";
import { CommitIcon } from "@/components/log/icons";
import { Divider, PinnedCapsule } from "@/components/log/works-toolbar";
import { HeaderAction } from "@/components/ui/controls";
import { t, type Locale } from "@/lib/i18n";
import { getCommitTypePluralLabel, type CommitType } from "@/lib/log";
import { WORKS_READINGS, type WorksReading } from "@/lib/log-view";
import { cn } from "@/lib/utils";

// =============================================================================
// The /works bar, in the projects reading — and the switch both readings share.
//
//   projects  log │ ▣ Projects 12  ◔ Talks 19  ◌ Press 3
//   └─ reading ─┘   └──────────── on this page ───────────┘
//
// The switch is the quietest thing that can be a switch: two mono words, the
// one you are reading filled (HeaderAction, as /writing's `EN  All`). In the
// log it leads the log's own toolbar (WorksToolbar `leading`), in the same
// place, so the way back is where the way in was.
//
// After it, what the reading holds, wearing the marks and the words the
// log's chips wear. Here they do not filter — nothing on this page is
// hidden — they go to their section, the way the log's chapter pill goes to
// its chapter. Icons only on a phone, as in the log. (The projects count
// one more than the log's chip: the Flash years are a role there and a
// project here, which is the difference between the two readings.)
//
// Pinned as the log's bar is, on the same capsule of glass (PinnedCapsule).
// =============================================================================

const READING_KEY = {
  projects: "worksReadingProjects",
  log: "worksReadingLog",
} as const;

/** Clears the pinned bar with room to read the heading above the rows —
 *  the log's permalinks come to rest at the same height (use-commit-anchor). */
const HEADROOM = 96;

export function ReadingSwitch({
  locale,
  reading,
  onChange,
  compact = false,
}: {
  locale: Locale;
  reading: WorksReading;
  onChange: (reading: WorksReading) => void;
  /**
   * On a phone, print only the way out. The log's bar is already a full
   * row at 375px (see WorksToolbar), and its ref already says you are in
   * the log — `main`, `HEAD` — so the lit half of the switch is the one
   * word on it that tells you nothing.
   */
  compact?: boolean;
}) {
  return (
    <span
      role="group"
      aria-label={t(locale, "worksReadingLabel")}
      className="inline-flex shrink-0 items-center gap-0.5 font-mono text-xs select-none"
    >
      {WORKS_READINGS.map((r) => (
        <HeaderAction
          key={r}
          active={reading === r}
          onClick={() => onChange(r)}
          className={cn(
            "px-1.5",
            compact && reading === r && "hidden sm:inline-flex",
          )}
        >
          {t(locale, READING_KEY[r])}
        </HeaderAction>
      ))}
    </span>
  );
}

export interface WorksSection {
  /** The section's element id (components/works/works-index.tsx). */
  id: string;
  /** The type whose mark and name it wears. */
  type: CommitType;
  count: number;
}

export function ProjectsToolbar({
  locale,
  onReadingChange,
  sections,
}: {
  locale: Locale;
  onReadingChange: (reading: WorksReading) => void;
  sections: readonly WorksSection[];
}) {
  const reduced = useReducedMotion() ?? false;

  const toSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    scrollPageTo(Math.max(0, pageOffsetOf(el) - HEADROOM), {
      behavior: reduced ? "auto" : "smooth",
    });
  };

  return (
    <div className="relative isolate w-max max-w-full">
      <PinnedCapsule />
      <div className="flex items-center gap-2 font-mono text-xs text-tertiary-foreground sm:gap-3">
        <ReadingSwitch
          locale={locale}
          reading="projects"
          onChange={onReadingChange}
        />
        <Divider />
        <nav
          aria-label={t(locale, "worksSectionsLabel")}
          className="flex min-w-0 items-center gap-0.5"
        >
          {sections.map(({ id, type, count }) => {
            const label = getCommitTypePluralLabel(type, locale);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toSection(id)}
                aria-label={`${label} (${count})`}
                title={label}
                className="pressable inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-tertiary-foreground transition-colors duration-200 hover:text-foreground"
              >
                <CommitIcon type={type} className="h-3 w-3 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
                <span className="tabular-nums">{count}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
