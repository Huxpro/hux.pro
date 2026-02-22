"use client";

/**
 * Commit — Unified entry point for rendering commits.
 *
 * Normalizes type-specific commit data via the adapter, then dispatches
 * to the appropriate variant renderer:
 * - "timeline": Dense git-log row (TimelineCommit)
 * - "card": TimelineCommit in a border frame container
 * - "bare": Minimal compact for widgets (CommitCompact)
 */

import type { Locale } from "@/lib/i18n";
import type { Commit as CommitData } from "@/lib/log";
import { getCommitPrimaryUrl } from "@/lib/log";
import { cn } from "@/lib/utils";
import { normalizeCommit } from "./commit-data";
import { TimelineCommit } from "./timeline-commit";
import { CommitCompact } from "./commit-compact";
import { CommitCursorPreview } from "./embeds";

// =============================================================================
// Types
// =============================================================================

export type CommitVariant = "timeline" | "card" | "bare";

export interface CommitProps {
  commit: CommitData;
  locale?: Locale;
  variant?: CommitVariant;
  defaultExpanded?: boolean;
  className?: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function Commit({
  commit,
  locale = "en",
  variant = "card",
  defaultExpanded = false,
  className,
}: CommitProps) {
  // Runtime guard: MDX/JSON inputs can bypass static typing.
  if (
    !commit ||
    (commit.type !== "project" &&
      commit.type !== "talk" &&
      commit.type !== "post" &&
      commit.type !== "role" &&
      commit.type !== "social")
  ) {
    return null;
  }

  const data = normalizeCommit(commit, locale);
  const primaryUrl = getCommitPrimaryUrl(commit) ?? undefined;
  const cursorPreview = <CommitCursorPreview commit={commit} locale={locale} />;

  switch (variant) {
    case "timeline":
      return (
        <TimelineCommit
          data={data}
          primaryUrl={primaryUrl}
          cursorPreview={cursorPreview}
          defaultExpanded={defaultExpanded}
          className={className}
        />
      );

    case "card":
      return (
        <div
          className={cn(
            "rounded-lg border border-border bg-muted/5 overflow-hidden",
            "p-4",
            className,
          )}
        >
          <TimelineCommit data={data} defaultExpanded={defaultExpanded} />
        </div>
      );

    case "bare":
      return <CommitCompact data={data} className={className} />;
  }
}
