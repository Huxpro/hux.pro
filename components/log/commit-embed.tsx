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

import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";
import type { Commit as CommitData } from "@/lib/log";
import { getCommitThumbnail, localize } from "@/lib/log";
import { cn } from "@/lib/utils";
import { normalizeCommit } from "./commit-data";
import { TimelineCommit, type BeamSpec } from "./timeline-commit";
import { CommitCompact } from "./commit-compact";

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
  hideDate?: boolean;
  /** Pre-computed git-graph rail char for the timeline gutter. */
  rail?: string;
  /** The role commit's id that owns this row's rail segment. */
  segmentId?: string | null;
  /** True when the parent timeline currently highlights this segment. */
  isSegmentActive?: boolean;
  /** The beam this row emits when hovered. */
  beamSpec?: BeamSpec | null;
  /** Notify the parent the row would like its beam rendered. */
  onBeamSet?: (spec: BeamSpec) => void;
  /** Notify the parent the row no longer wants its beam rendered.
   *  Parent should ignore stale clears that don't match the current beam. */
  onBeamClear?: (spec: BeamSpec) => void;
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
  hideDate = false,
  rail,
  segmentId,
  isSegmentActive = false,
  beamSpec = null,
  onBeamSet,
  onBeamClear,
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
  const preview = buildCommitPreview(commit, locale);

  switch (variant) {
    case "timeline":
      return (
        <TimelineCommit
          data={data}
          cursorPreview={preview?.node ?? null}
          cursorPreviewPanelClassName={preview?.panelClassName}
          defaultExpanded={defaultExpanded}
          className={className}
          hideDate={hideDate}
          rail={rail}
          isRole={commit.type === "role"}
          segmentId={segmentId ?? null}
          isSegmentActive={isSegmentActive}
          beamSpec={beamSpec}
          onBeamSet={onBeamSet}
          onBeamClear={onBeamClear}
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
          <TimelineCommit
            data={data}
            defaultExpanded={defaultExpanded}
            hideDate={hideDate}
          />
        </div>
      );

    case "bare":
      return <CommitCompact data={data} className={className} />;
  }
}

// =============================================================================
// Preview Content (for MagneticPreview)
// =============================================================================

interface CommitPreview {
  node: ReactNode;
  /** Extra class merged into the cursor-preview panel. */
  panelClassName?: string;
}

/**
 * Build the cursor-preview for a commit, or `null` when there is nothing
 * worth showing (so the hover never renders an empty card).
 *
 * - With a thumbnail: a flush "poster" — just the image, framed by the
 *   panel's own border for a hint of depth. No description, no padding.
 * - Otherwise: the description text, if any.
 */
function buildCommitPreview(
  commit: CommitData,
  locale: Locale,
): CommitPreview | null {
  const thumbnail = getCommitThumbnail(commit);

  if (thumbnail) {
    return {
      // Drop the panel padding so the image sits flush; clip to the
      // rounded frame so the border reads as the poster's edge.
      panelClassName: "p-0 overflow-hidden",
      node: (
        <img
          src={thumbnail}
          alt=""
          className="block w-56 aspect-video object-cover"
          loading="lazy"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (target.src.includes("maxresdefault")) {
              target.src = target.src.replace("maxresdefault", "hqdefault");
            }
          }}
        />
      ),
    };
  }

  const description = localize(commit.description, locale);
  if (!description) return null;

  return {
    node: (
      <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed max-w-[14rem]">
        {description}
      </p>
    ),
  };
}
