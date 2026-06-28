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
import type { Media } from "@/lib/log";
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
  /** Notify the parent the row would like its beam rendered. */
  onBeamSet?: (spec: BeamSpec) => void;
  /** Notify the parent the row no longer wants its beam rendered. The
   *  parent should ignore the call if its current beam doesn't match
   *  this spec — guards against React effect-ordering race conditions
   *  where a sibling's stale clear would otherwise overwrite a fresh
   *  hover on another row. */
  onBeamClear?: (spec: BeamSpec) => void;
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
  onBeamSet,
  onBeamClear,
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

  // Embeds flagged `defaultShown` render once in a stable spot beneath the row
  // (visible folded *and* expanded), so toggling never remounts them. The
  // expanded block then renders only the remaining media — the rest of the
  // embeds plus any video/image — so every embed is still seen once expanded.
  const foldedEmbeds = data.foldedEmbeds as Media[];
  const expandedMedia = data.nonLinkMedia.filter((m) => !foldedEmbeds.includes(m));

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

  // Any row that has its own beam spec drives that beam when hovered
  // or expanded. Roles emit a "comprehensive" beam (segmentEnd → role),
  // members emit their own (this commit → role).
  //
  // Touch caveat: tapping a row fires a synthetic mouseenter that
  // sticks isHovered=true and never unsticks on the same row (mouseleave
  // only fires when the user taps elsewhere). That left the beam
  // pinned on after collapsing on mobile. We use pointer events with
  // a pointerType guard so only mouse/pen drive the hover state —
  // touch is ignored and isExpanded becomes the sole signal on phones.
  const participatesInSegment = !!beamSpec;
  const [isHovered, setIsHovered] = useState(false);
  const handleSegmentPointerEnter = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!participatesInSegment) return;
      if (e.pointerType === "touch") return;
      setIsHovered(true);
    },
    [participatesInSegment],
  );
  const handleSegmentPointerLeave = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!participatesInSegment) return;
      if (e.pointerType === "touch") return;
      setIsHovered(false);
    },
    [participatesInSegment],
  );

  useEffect(() => {
    if (!participatesInSegment || !beamSpec) return;
    if (isHovered || isExpanded) {
      onBeamSet?.(beamSpec);
    } else {
      // Pass our own spec so the parent can guard against a stale clear
      // (a sibling's later effect overwriting a fresh set on another row).
      onBeamClear?.(beamSpec);
    }
  }, [participatesInSegment, beamSpec, isHovered, isExpanded, onBeamSet, onBeamClear]);

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
            // Widen the gap only where the labels appear (@sm); on mobile the
            // labels stay hidden, so keep the icons tight even when expanded.
            isExpanded ? "gap-1.5 @sm:gap-3" : "gap-1.5",
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

      {/* Default-shown embeds: rendered once here whether folded or expanded,
          so toggling the row never remounts them. */}
      {data.foldedEmbeds.length > 0 && (
        <div
          className="col-start-2 @sm:col-start-3 mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <MediaRenderer media={data.foldedEmbeds} layout="stack" size="default" />
        </div>
      )}

      {isExpanded && (
        <div className="col-start-2 @sm:col-start-3 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {data.subtitle && (
            <div className="text-xs text-muted-foreground/60">
              {data.subtitle}
            </div>
          )}

          {/* Remaining media — embeds not already shown above, plus video/image. */}
          {expandedMedia.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <MediaRenderer
                media={expandedMedia}
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
          onPointerEnter={
            participatesInSegment ? handleSegmentPointerEnter : undefined
          }
          onPointerLeave={
            participatesInSegment ? handleSegmentPointerLeave : undefined
          }
          className={cn(
            "group relative -mx-3 px-3 py-2.5 rounded-lg transition-colors duration-150",
            rowOnClick ? "cursor-pointer" : "cursor-default",
            "@container hover:bg-muted/20 active:bg-muted/30",
          )}
        >
          {rowContent}
        </div>
      </MagneticPreview>
    </div>
  );
}
