"use client";

/**
 * TimelineCommit — Dense git-log style commit row for /works timeline.
 *
 * Summary: hash · icon · title · [link-icons] ··· date
 * Expanded: subtitle, description, links, tags, stats, commentary, media
 *
 * 3-column grid: [hash | icon | content]. Hash column collapses on small containers.
 * Uses the same shared primitives as CommitCard to ensure visual sync.
 * Consumes NormalizedCommit — fully type-agnostic.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { NormalizedCommit } from "./commit-data";
import { commitIcons } from "./icons";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import {
  LinkIcon,
  Description,
  Commentary,
  TagBadges,
  Stats,
} from "./embeds/shared";
import { MediaRenderer } from "./media";

export interface BeamSpec {
  fromHash: string;
  toHash: string;
  roleId: string;
}

interface TimelineCommitProps {
  data: NormalizedCommit;
  cursorPreview?: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
  hideDate?: boolean;
  /** Git-graph rail char to draw on the right (`┐`, `│`, `┘` or empty). */
  rail?: string;
  /** True when this row IS the role that owns its segment. */
  isRole?: boolean;
  /** The role id that owns this row's rail segment. */
  segmentId?: string | null;
  /** True when the parent timeline currently highlights this segment. */
  isSegmentActive?: boolean;
  /** The beam this row emits when hovered (from this commit up to the
   *  role). When null, the row has nothing to beam. */
  beamSpec?: BeamSpec | null;
  /** Notify the parent which beam (if any) to render — fires with the
   *  spec on enter and null on leave/blur. */
  onBeamHover?: (spec: BeamSpec | null) => void;
}

export function TimelineCommit({
  data,
  cursorPreview,
  defaultExpanded = false,
  className,
  hideDate = false,
  rail,
  isRole = false,
  segmentId = null,
  isSegmentActive = false,
  beamSpec = null,
  onBeamHover,
}: TimelineCommitProps) {
  const Icon = commitIcons[data.type];
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const hasExpandableContent = !!(
    data.description ||
    data.commentary ||
    data.tags.length > 0 ||
    data.stats ||
    data.nonLinkMedia.length > 0
  );

  const handleToggleExpanded = useCallback(() => {
    if (!hasExpandableContent) return;
    setIsExpanded((prev) => !prev);
  }, [hasExpandableContent]);

  const rowOnClick = hasExpandableContent ? handleToggleExpanded : undefined;

  const showCursorPreview = !!cursorPreview && !isExpanded;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
      }
    },
    [],
  );

  const hasRail = !!rail && rail !== "";
  const railBg = isSegmentActive
    ? "bg-muted-foreground/60"
    : "bg-muted-foreground/25";

  // Any row that has its own beam spec drives that beam when hovered
  // or expanded. Roles emit a "comprehensive" beam (segmentEnd → role),
  // members emit their own (this commit → role).
  const participatesInSegment = !!beamSpec;
  const [isHovered, setIsHovered] = useState(false);
  const handleSegmentMouseEnter = useCallback(() => {
    if (participatesInSegment) setIsHovered(true);
  }, [participatesInSegment]);
  const handleSegmentMouseLeave = useCallback(() => {
    if (participatesInSegment) setIsHovered(false);
  }, [participatesInSegment]);

  useEffect(() => {
    if (!participatesInSegment || !beamSpec) return;
    if (isHovered || isExpanded) {
      onBeamHover?.(beamSpec);
    } else {
      onBeamHover?.(null);
    }
  }, [participatesInSegment, beamSpec, isHovered, isExpanded, onBeamHover]);

  const rowContent = (
    <div className="grid grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
      <span className="hidden @sm:inline font-mono text-xs text-muted-foreground/40 select-all leading-5">
        {data.hash}
      </span>

      <span className="inline-flex items-center h-5">
        <Icon className="w-3 h-3 text-muted-foreground/50" />
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm text-foreground min-w-0 flex-1">
          {data.title}
          {data.languageBadge && (
            <span className="ml-2 text-xs font-mono text-muted-foreground/40 align-baseline">
              {data.languageBadge}
            </span>
          )}
        </span>

        <div
          className={cn(
            "flex items-center shrink-0",
            isExpanded ? "gap-3" : "gap-1.5",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {data.links.map((link, i) => (
            <a
              key={`link-${i}`}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <LinkIcon icon={link.icon} />
              {isExpanded && (
                <span className="hidden @sm:inline text-xs">
                  {link.label}
                </span>
              )}
            </a>
          ))}
        </div>

        {hideDate ? (
          data.dateSlotOverride && (
            <span className="font-mono text-xs text-muted-foreground/50 shrink-0 ml-auto">
              {data.dateSlotOverride}
            </span>
          )
        ) : (
          <span className="font-mono text-xs text-muted-foreground/50 shrink-0 ml-auto">
            {data.date}
          </span>
        )}
      </div>

      {data.meta && (
        <div className="col-start-2 @sm:col-start-3 mt-1 text-xs font-mono text-muted-foreground/40">
          {data.metaUrl ? (
            <a
              href={data.metaUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              {data.meta}
              <span aria-hidden className="text-[0.7rem]">↗</span>
            </a>
          ) : (
            data.meta
          )}
        </div>
      )}

      {isExpanded && (
        <div className="col-start-2 @sm:col-start-3 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {data.subtitle && (
            <div className="text-xs text-muted-foreground/60">
              {data.subtitle}
            </div>
          )}

          {data.nonLinkMedia.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <MediaRenderer
                media={data.nonLinkMedia}
                layout="stack"
                size="default"
              />
            </div>
          )}

          <Description text={data.description} isExpanded />

          {data.commentary && <Commentary text={data.commentary} />}

          {data.tags.length > 0 && <TagBadges items={data.tags} />}

          {data.stats && <Stats {...data.stats} />}
        </div>
      )}

    </div>
  );

  return (
    <div id={data.hash} className={className}>
      <MagneticPreview preview={cursorPreview} enabled={showCursorPreview}>
        <div
          role={rowOnClick ? "button" : undefined}
          tabIndex={rowOnClick ? 0 : undefined}
          onClick={rowOnClick}
          onKeyDown={rowOnClick ? handleKeyDown : undefined}
          onMouseEnter={
            participatesInSegment ? handleSegmentMouseEnter : undefined
          }
          onMouseLeave={
            participatesInSegment ? handleSegmentMouseLeave : undefined
          }
          className={cn(
            "group relative -mx-3 px-3 py-2.5 rounded-lg transition-colors duration-150",
            rowOnClick ? "cursor-pointer" : "cursor-default",
            "@container hover:bg-muted/20 active:bg-muted/30",
          )}
        >
          {rowContent}
          {/* Right-side rail rendered as CSS borders so the vertical
              connection through every row in a segment is truly
              continuous (no gap from py padding or meta lines), while
              still drawing visible corners at the role and the last
              commit. The corner sits at the title baseline (~20px from
              the row top).

                ┐  bottom-half vertical + left tick at baseline
                │  full-height vertical (both halves)
                ┘  top-half vertical + left tick at baseline

              The rail sits at /15 by default and lifts to /60 when its
              owning role is hovered (acts as a "highlight branch"
              affordance from git GUIs). */}
          {hasRail && (
            <>
              {/* Vertical, top half — for │ and ┘ */}
              {(rail === "│" || rail === "┘") && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute right-0 top-0 h-5 w-px transition-colors duration-150",
                    railBg,
                  )}
                />
              )}
              {/* Vertical, bottom half — for │ and ┐ */}
              {(rail === "│" || rail === "┐") && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute right-0 top-5 bottom-0 w-px transition-colors duration-150",
                    railBg,
                  )}
                />
              )}
              {/* Corner tick going left at the baseline — for ┐ and ┘ */}
              {(rail === "┐" || rail === "┘") && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute right-0 top-5 h-px w-1.5 transition-colors duration-150",
                    railBg,
                  )}
                />
              )}
            </>
          )}
        </div>
      </MagneticPreview>
    </div>
  );
}
