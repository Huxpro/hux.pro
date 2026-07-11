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
import { commitIcons, commitIconOverrides } from "./icons";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import {
  LinkIcon,
  Description,
  Commentary,
  TagBadges,
  Stats,
} from "./embeds/shared";
import { MediaRenderer } from "./media";
import { useSlidesPlayer } from "./media/slides-player";
import { resolveSlidesEmbedUrl } from "./media/slides";

/**
 * Fallback handle for the expanded author block when a commit has no
 * resolvable identity (e.g. personal talks / recognitions with
 * `attachedTo: null`). The subtitle-row byline stays blank for those
 * rows, but the author block still names the person once opened.
 */
const DEFAULT_AUTHOR_HANDLE = "hux";

export interface BeamSpec {
  /** Source hash, or null for a target-only spec — the latter
   *  activates every connector that targets `toHash` (used so hovering
   *  a role lights up all its incoming connectors, not just the first
   *  attachment that happened to stash a spec on its slot). */
  fromHash: string | null;
  toHash: string;
  roleId: string;
}

interface TimelineCommitProps {
  data: NormalizedCommit;
  cursorPreview?: ReactNode;
  /** Extra class for the cursor-preview panel (e.g. flush poster framing). */
  cursorPreviewPanelClassName?: string;
  defaultExpanded?: boolean;
  /** Page-level "expand/collapse all" command. When its value flips, the
   *  row syncs its expanded state to it; undefined leaves the row
   *  self-controlled (card / bare contexts). */
  expandAll?: boolean;
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
  /** Git-author-style byline. Pre-localized in the timeline.
   *
   *  Layout: the handle sits right-aligned in the subtitle row, under
   *  the row's date column. The row is reserved (same font-size /
   *  line-height as a meta line) even when there's no left-side meta
   *  to print, so vertical rhythm stays consistent across rows.
   *
   *  Sparse: `isClusterHead` rows render the byline at full opacity;
   *  non-head rows render it transparent and fade in on cluster hover,
   *  so the timeline reads as "one author per chapter" instead of
   *  repeating the same `<jsx@fb.com>` on every line in a tenure run.
   *
   *  Expanded: the `expanded` payload feeds a `git log --pretty=fuller`
   *  style block at the top of the row's expanded body. */
  byline?: {
    handle: string;
    isClusterHead: boolean;
    /**
     * Effective team subtitle for a project row (set only when this is
     * the first row in a same-team run). Rendered as the subtitle-row
     * left cell when the commit has no venue meta of its own.
     */
    subtitle?: string;
    expanded: {
      title: string;
      company: string;
      location?: string;
      description?: string;
    };
  } | null;
  inspecting?: boolean;
  isSelected?: boolean;
  isUnlisted?: boolean;
  onInspectCommit?: () => void;
  onInspectMedia?: (media: Media) => void;
  selectedMedia?: Media | null;
}

export function TimelineCommit({
  data,
  cursorPreview,
  cursorPreviewPanelClassName,
  defaultExpanded = false,
  expandAll,
  className,
  hideDate = false,
  rail,
  isRole = false,
  beamSpec = null,
  onBeamSet,
  onBeamClear,
  byline = null,
  inspecting = false,
  isSelected = false,
  isUnlisted = false,
  onInspectCommit,
  onInspectMedia,
  selectedMedia = null,
}: TimelineCommitProps) {
  const slidesPlayer = useSlidesPlayer();
  const Icon =
    (data.iconOverride && commitIconOverrides[data.iconOverride]) ||
    commitIcons[data.type];
  const isEvent = data.type === "event";
  const [isExpandedState, setIsExpanded] = useState(defaultExpanded);
  const isExpanded = inspecting ? isSelected : isExpandedState;

  const hasExpandableContent = !!(
    data.description ||
    data.commentary ||
    data.tags.length > 0 ||
    data.stats ||
    data.expandedMedia.length > 0 ||
    data.pinnedMedia.length > 0 ||
    byline
  );

  // Pinned items render once in a stable spot beneath the row (visible
  // folded *and* expanded), so toggling never remounts them. The expanded
  // block renders the rest; normalizeCommit has already excluded pinned
  // items from `expandedMedia`, so no further filtering is needed here.
  const pinnedMedia = data.pinnedMedia as Media[];
  const expandedMedia = data.expandedMedia;

  // Sync to the page-level "expand/collapse all" command without an effect:
  // store the last seen value and reconcile during render when it flips, so
  // a row toggled by hand stays put until the *next* global command. Rows
  // with nothing to expand are left collapsed — expanding them shows nothing
  // yet would suppress their hover peek (see `showCursorPreview`).
  // (React's "adjusting state when a prop changes" pattern.)
  const [lastExpandAll, setLastExpandAll] = useState(expandAll);
  if (expandAll !== lastExpandAll) {
    setLastExpandAll(expandAll);
    if (expandAll !== undefined) {
      setIsExpanded(expandAll && hasExpandableContent);
    }
  }

  const handleToggleExpanded = useCallback(() => {
    if (!hasExpandableContent) return;
    setIsExpanded((prev) => !prev);
  }, [hasExpandableContent]);

  const rowOnClick = inspecting
    ? onInspectCommit
    : hasExpandableContent
      ? handleToggleExpanded
      : undefined;

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

  // Git-graph rail drawn THROUGH the icon column as two separate
  // absolutely-positioned segments — one above the icon, one below —
  // each stopping a few px short of the icon's center so the icon sits
  // in a natural gap on the line. No bg-mask needed; the line literally
  // doesn't exist where the icon does. computeRail emits `┐` (role
  // anchor — segment below only), `│` (mid — both), `┘` (segment end —
  // segment above only), `""` (no rail).
  const hasRailAbove = rail === "│" || rail === "┘";
  const hasRailBelow = rail === "│" || rail === "┐";
  // A role row shows its anchor ring whenever it's part of a tenure
  // cluster (i.e. has a rail char). The role might sit at the top
  // (rail="┐"), bottom (rail="┘"), or middle (rail="│") of its cluster
  // depending on `sortBy`; either way the ring marks it as the anchor.
  const isRoleAnchor = isRole && rail !== "";
  // Distance from icon center where the line stops. Members: icon is
  // 12px (h-3) so 6px radius + 1px breathing room. Role: ring is 16px
  // (h-4) so 8px radius + 2px breathing room. Events: tiny 3px dot
  // sits close to the line for visual continuity.
  const iconGapPx = isEvent ? 3 : isRoleAnchor ? 10 : 7;

  const rowContent = (
    <div className="grid grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
      <span
        className={cn(
          "hidden @sm:inline font-mono text-xs select-all",
          // Events render the hash transparent — no link, no reference,
          // hash is noise. Keeping it occupies the column so titles
          // stay aligned with adjacent commit rows. Leading also drops
          // to text-xs's natural 16px so the event row stays compact.
          isEvent ? "text-transparent leading-4" : "text-muted-foreground/40 leading-5",
        )}
      >
        {data.hash}
      </span>

      <span
        // data-rail-icon lets cross-row attachment lines measure this
        // span's center to anchor their geometry (see TimelineConnector).
        data-rail-icon
        className={cn(
          "relative inline-flex items-center justify-center w-5",
          // Match the icon-span HEIGHT to the title row's line-height
          // so the dot/icon sits on the title's vertical center.
          // text-sm has line-height 20px (h-5); text-xs has 16px (h-4).
          // WIDTH stays w-5 across all rows so the rail's x-center
          // (left-1/2 of this span) is identical for every row —
          // otherwise the event's narrower span would shift the line
          // 2px left of the surrounding rail.
          isEvent ? "h-4" : "h-5",
        )}
      >
        {hasRailAbove && (
          <span
            aria-hidden
            data-rail-above
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px transition-colors duration-200 bg-muted-foreground/10"
            style={{ top: "-1000px", bottom: `calc(50% + ${iconGapPx}px)` }}
          />
        )}
        {hasRailBelow && (
          <span
            aria-hidden
            data-rail-below
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 w-px transition-colors duration-200 bg-muted-foreground/10"
            style={{ top: `calc(50% + ${iconGapPx}px)`, bottom: "-1000px" }}
          />
        )}
        {isEvent ? (
          // Events get a tiny CSS dot — quieter than any lucide icon
          // and reads as "node on the rail" rather than "category icon".
          <span
            aria-hidden
            className="block w-[3px] h-[3px] rounded-full bg-muted-foreground/30"
          />
        ) : (
          // All icons live in the same-size invisible wrapper (w-5 h-5)
          // so positions stay identical; the role's `ring-inset` draws a
          // thin circle INSIDE the wrapper, keeping bounding boxes equal
          // and signalling ownership purely through the ring. The 20px
          // wrapper gives the ring node 3px clearance from the 12px icon
          // so it reads as a distinct circle rather than a tight outline.
          <span
            className={cn(
              "inline-flex items-center justify-center w-5 h-5 rounded-full transition-[box-shadow] duration-200",
              isRoleAnchor && [
                "ring-1 ring-inset",
                "ring-muted-foreground/15",
                "group-hover/tenure:ring-muted-foreground/40",
                "group-focus-within/tenure:ring-muted-foreground/40",
                "group-has-[[data-expanded]]/tenure:ring-muted-foreground/40",
              ],
            )}
          >
            <Icon className="w-3 h-3 text-muted-foreground/50" />
          </span>
        )}
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "min-w-0 flex-1",
            // Events drop a tier in hierarchy: secondary/meta style.
            // Font per script: CJK uses mono (matches meta line, no
            // italic — italic on CJK reads as emphasis). English uses
            // serif italic (the traditional typographic aside). Parens
            // stay as a quiet stage-direction marker for both.
            isEvent
              ? cn(
                  "text-xs text-muted-foreground/40",
                  /[぀-ヿ一-鿿]/.test(data.title)
                    ? "font-mono"
                    : "italic font-serif",
                )
              : "text-sm text-foreground",
          )}
        >
          {isEvent ? `(${data.title})` : data.title}
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
          {data.links.map((link, i) => {
            const className =
              "inline-flex items-center gap-1 text-muted-foreground/40 hover:text-foreground transition-colors";
            const label = isExpanded && !link.redundantWhenExpanded && (
              <span className="hidden @sm:inline text-xs">{link.label}</span>
            );

            if (link.playSlides && slidesPlayer.hasProvider) {
              return (
                <button
                  key={`link-${i}`}
                  type="button"
                  onClick={() =>
                    slidesPlayer.open({
                      url: resolveSlidesEmbedUrl(link.url),
                      title: link.label,
                    })
                  }
                  className={className}
                  aria-label={`Play slides: ${link.label}`}
                >
                  <LinkIcon icon={link.icon} />
                  {label}
                </button>
              );
            }

            return (
              <a
                key={`link-${i}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                <LinkIcon icon={link.icon} />
                {label}
              </a>
            );
          })}
        </div>

        {hideDate ? (
          data.dateSlotOverride && (
            <span className="font-mono text-xs text-muted-foreground/50 shrink-0 ml-auto">
              {data.dateSlotOverride}
            </span>
          )
        ) : (
          <span
            className={cn(
              "font-mono text-xs shrink-0 ml-auto",
              // Date stays — the year is the meaning for life events
              // (`moved to US, 2017`) — but pushed a tier quieter than
              // siblings so the row reads as background context.
              isEvent
                ? "text-muted-foreground/30"
                : "text-muted-foreground/50",
            )}
          >
            {data.date}
          </span>
        )}
      </div>

      {/*
        Subtitle row: meta on the left, author byline right-aligned under
        the date column. The row is rendered whenever EITHER half exists
        — and importantly, when only the byline exists (project commit
        without a venue meta), the empty left side still reserves the
        full row height so vertical rhythm stays consistent across the
        timeline.

        Sparse byline: cluster-head rows print the handle at full
        opacity; subsequent rows in the same author run render it with
        opacity 0 and fade in on per-row hover (the row's own `group`
        scope, not the cluster) so a stray cursor over one commit
        doesn't light up the whole tenure. An expanded row keeps its
        byline fully visible so the cluster's authorial context stays
        on-screen while you read.
      */}
      {(data.meta || byline) && (
        <div className="col-start-2 @sm:col-start-3 mt-1 text-xs font-mono text-muted-foreground/40 flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate">
            {data.meta ? (
              data.metaUrl ? (
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
              )
            ) : (
              // Project subtitle fallback — set only on the first row
              // of a same-team run so repeats stay blank (sparse). The
              // left cell still exists to preserve baseline alignment
              // with the right-aligned byline.
              byline?.subtitle
            )}
          </span>
          {byline && (
            <span
              className={cn(
                "shrink-0 text-muted-foreground/55 transition-opacity duration-200",
                byline.isClusterHead || isExpanded
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100",
              )}
            >
              {byline.handle}
            </span>
          )}
        </div>
      )}

      {/* Pinned items: rendered once here whether the row is folded or
          expanded, so toggling never remounts them. */}
      {pinnedMedia.length > 0 && (
        <div
          className="col-start-2 @sm:col-start-3 mt-2"
          onClick={(e) => e.stopPropagation()}
        >
          <MediaRenderer
            media={pinnedMedia}
            layout="stack"
            size="default"
            inspecting={inspecting}
            onInspect={onInspectMedia}
            selectedMedia={selectedMedia}
          />
        </div>
      )}

      {isExpanded && (
        // `data-row-body` marks the expanded content so the row's hover
        // background can suppress itself while the cursor is inside it
        // (see the `not-has-` clause on the outer row). Keeps the
        // hover/active highlight tied to the fold/unfold trigger only.
        <div
          data-row-body
          className="col-start-2 @sm:col-start-3 mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150"
        >
          {/*
            Author block — abbreviated `git log --pretty=fuller`:
              Author:  <handle>
              Role:    Title @ Company [· Location]
                       Optional role description.
            Rendered for every artifact-type row (project / talk / post
            / social). When no employer identity resolved (personal
            talks, awards), the Author line falls back to a bare
            `<hux>` — the byline slot in the subtitle already stays
            blank for those, but the expanded view still names the
            person so digging in never leaves the reader wondering.
            Role / description only when a resolved role provides them.
          */}
          {data.type !== "role" && data.type !== "event" && (
            <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-xs font-mono pb-2.5 mb-1 border-b border-border/25">
              <span className="text-muted-foreground/40">Author:</span>
              <span className="text-muted-foreground/65">
                &lt;{byline?.handle ?? DEFAULT_AUTHOR_HANDLE}&gt;
              </span>

              {byline?.expanded.title && (
                <>
                  <span className="text-muted-foreground/40">Role:</span>
                  <span className="text-muted-foreground/60">
                    {byline.expanded.title}
                    <span className="text-muted-foreground/35"> @ </span>
                    {byline.expanded.company}
                    {byline.expanded.location && (
                      <>
                        <span className="text-muted-foreground/30"> · </span>
                        {byline.expanded.location}
                      </>
                    )}
                  </span>
                </>
              )}

              {byline?.expanded.description && (
                <>
                  <span />
                  <span className="text-muted-foreground/50 mt-1 leading-relaxed">
                    {byline.expanded.description}
                  </span>
                </>
              )}
            </div>
          )}

          {data.subtitle && (
            <div className="text-xs text-muted-foreground/60">
              {data.subtitle}
            </div>
          )}

          {/* Remaining media — everything that wasn't hoisted above the fold. */}
          {expandedMedia.length > 0 && (
            <div onClick={(e) => e.stopPropagation()}>
              <MediaRenderer
                media={expandedMedia}
                layout="stack"
                size="default"
                inspecting={inspecting}
                onInspect={onInspectMedia}
                selectedMedia={selectedMedia}
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
    <div
      id={data.hash}
      data-rail-row
      data-role-row={isRoleAnchor ? "" : undefined}
      className={className}
    >
      <MagneticPreview
        preview={cursorPreview}
        enabled={showCursorPreview}
        panelClassName={cursorPreviewPanelClassName}
      >
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
          // `data-expanded` lets the tenure wrapper's group-has variant
          // brighten the rail while the row is open — mobile-friendly,
          // survives losing focus after a tap-to-expand.
          data-expanded={isExpanded ? "" : undefined}
          // Clip the rail segments vertically so they can't leak past the
          // tenure cluster's last row — but only on the block axis. The
          // inline axis stays visible so a three-card media rail can bleed
          // into the page gutter (see MediaRenderer). `overflow-y: clip`
          // keeps the vertical clip without turning the row into a scroll
          // container; the cursor preview is `position: fixed`, so it was
          // never clipped here anyway.
          className={cn(
            "group relative -mx-3 px-3 rounded-lg transition-colors duration-150 overflow-y-clip",
            // Events get tighter vertical padding so they sit between
            // commits as ambient annotations rather than as full rows.
            isEvent ? "py-1" : "py-2.5",
            rowOnClick ? "cursor-pointer" : "cursor-default",
            "@container",
            // Hover/active highlight is tied to the fold/unfold trigger
            // only — when the cursor moves into the expanded body
            // ([data-row-body]) the row no longer paints, so hovering a
            // LinkCard / Video / Description doesn't drag the entire
            // commit's background with it. `:has()` raises specificity
            // enough that the negated form wins over the simple `:hover`.
            "[&:hover:not(:has([data-row-body]:hover))]:bg-muted/20",
            "[&:active:not(:has([data-row-body]:active))]:bg-muted/30",
            inspecting && "hover:ring-1 hover:ring-inset hover:ring-sky-500/35",
            isUnlisted && "opacity-55",
            isSelected &&
              "bg-sky-500/[0.06] ring-1 ring-inset ring-sky-500/70 hover:ring-sky-500/70",
          )}
        >
          {rowContent}
        </div>
      </MagneticPreview>
    </div>
  );
}
