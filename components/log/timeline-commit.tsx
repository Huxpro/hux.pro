"use client";

/**
 * TimelineCommit — Dense git-log style commit row for /works timeline.
 *
 * Summary: hash · icon · title · [link-icons] ··· date
 * Expanded: description, links, commentary, media, author fields
 *
 * 3-column grid: [hash | icon | content]. Hash column collapses on small containers.
 * Uses the same shared primitives as CommitCard to ensure visual sync.
 * Consumes NormalizedCommit — fully type-agnostic.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Media } from "@/lib/log";
import { DEFAULT_FORM, rowFormFor, type LogForm } from "@/lib/log-view";
import type { Byline } from "./bylines";
import type { NormalizedCommit } from "./commit-data";
import { CommitIcon } from "./icons";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import {
  LinkIcon,
  Description,
  Commentary,
  AuthorFields,
} from "./embeds/shared";
import { MediaRenderer } from "./media";
import { AttachmentGrid } from "./media/attachment-grid";
import { MediaStrip } from "./media/media-strip";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import { IdentityHover, useOptionalIdentityCard } from "@/systems/identity";
import { useInputCapability } from "@/services";

import { TYPE } from "@/lib/typography";

/**
 * The gutter — hash, rail icon, and the two gaps between them and the title —
 * has a fixed width from `lg` up, so the whole row can be pulled left by it
 * and the title sits on the page column's left edge (see the hash cell).
 *
 *   hash 3.5rem + gap 0.5rem + icon 1.25rem + gap 0.5rem = 5.75rem
 *
 * plus the row's own 0.75rem of padding, which is what `-mx-3` already
 * subtracts on the right. Below `lg` the page has no margin to hang it in
 * and the gutter stays inside the column as it always did.
 */
const HASH_CELL = "lg:w-14 lg:text-right";
const GUTTER_PULL = "lg:-ml-[6.5rem]";

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
  byline?: Byline | null;
  /** The page's form — how much of the commit to print (lib/log-view.ts). */
  form?: LogForm;
  /**
   * Make this commit the page's address. When supplied, the hash column is
   * the permalink it always looked like — see `useCommitAnchor`.
   */
  onSelectHash?: (hash: string) => void;
  /**
   * The commit's attachments as one set (see systems/attachments). Every
   * media affordance on the row — a strip cover, an expanded player or card,
   * a rail icon — opens this set at its own item, so a phone gets the
   * attachment sheet and a desktop the theater or a window, from any of them.
   */
  attachmentSet?: AttachmentSet | null;
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
  form = DEFAULT_FORM,
  onSelectHash,
  attachmentSet = null,
  inspecting = false,
  isSelected = false,
  isUnlisted = false,
  onInspectCommit,
  onInspectMedia,
  selectedMedia = null,
}: TimelineCommitProps) {
  const attachments = useOptionalAttachments();
  const identityCard = useOptionalIdentityCard();
  const { magneticPreviewEnabled } = useInputCapability();
  const isEvent = data.type === "event";
  const isAside = data.present === "aside";
  // Folded asides borrow the event voice: muted italic line, rail
  // dot, no hash. Opening one reveals the real title and media; the
  // type is unchanged, so filters still find it.

  // Topics and stats are authored but not printed (see the expanded body),
  // so they can no longer be the reason a row is openable — a commit whose
  // only extra was a tag list would otherwise unfold onto nothing.
  const hasExpandableContent = !!(
    data.description ||
    data.commentary ||
    data.expandedMedia.length > 0 ||
    data.pinnedMedia.length > 0 ||
    byline
  );

  // Seeded from `expandAll`, not just `defaultExpanded`: the reconciliation
  // below only fires when the prop *changes*, so a row mounting with
  // `expandAll` already true (someone opened `/works?view=feed` directly, or
  // navigated in) would otherwise sit collapsed with no flip ever coming.
  const [isExpandedState, setIsExpanded] = useState(
    defaultExpanded || (expandAll === true && hasExpandableContent),
  );
  // Inspect selects; it does not invent a layout. A selected row opens so
  // its media can take a handle. The page's form still applies: `feed`
  // keeps every row open, `index` / `covers` leave the others folded.
  const isExpanded = inspecting
    ? isSelected || (expandAll === true && hasExpandableContent)
    : isExpandedState;

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

  // A role row is nothing but its identity, so with a pointer its hover peek
  // is the identity card (see `buildCommitPreview`), and with a finger a tap
  // opens the same card as a sheet instead of unfolding two lines of prose.
  const openIdentity = useCallback(
    (e: React.SyntheticEvent<HTMLElement>) => {
      if (!identityCard || !byline) return;
      e.stopPropagation();
      identityCard.open({
        identityId: byline.identityId,
        roleId: byline.roleId,
        anchor: e.currentTarget,
      });
    },
    [identityCard, byline],
  );
  const rowOpensIdentity =
    data.type === "role" && !!byline && !!identityCard && !magneticPreviewEnabled;

  const rowOnClick = inspecting
    ? onInspectCommit
    : rowOpensIdentity
      ? openIdentity
      : hasExpandableContent
        ? handleToggleExpanded
        : undefined;

  // The row's form: the page's, unless the reader opened this row, in which
  // case it is the feed for itself (`rowFormFor`, lib/log-view.ts — a form
  // is a preset of the row's atoms, and an open row is the same preset at
  // row scale). Everything below reads those atoms and nothing reads the
  // form's name, or `isExpanded` again: the feed's atoms already say
  // "no strip, no clamp, no peek".
  const rowForm = rowFormFor(form, isExpanded);

  // What the folded form adds under the title line: the description at two
  // lines, and the strip of covers. Both or either — a commit with no media
  // still gets its description, so a form is "title, what, and what it
  // looks like" rather than "title, and covers if any".
  //
  // Events and folded asides are out. Events are datelines between
  // commits, not works; asides borrow that voice until opened. Giving
  // either a caption while folded would promote a quiet line to a
  // paragraph.
  //
  // The strip is the folded form's own: while the row is open the feed's
  // grid shows the real thing, and a row of miniatures of what is directly
  // below it is noise.
  const isQuiet = isEvent || (isAside && !isExpanded);
  const displayTitle = isQuiet && data.foldedTitle ? data.foldedTitle : data.title;
  const showStrip =
    !isQuiet && rowForm.media === "covers" && data.stripItems.length > 0;
  const showStatDescription =
    !isQuiet && rowForm.description === "clamp" && !!data.description;
  // Where the handle signs: the bottom-right of the row, which is the media
  // line when a single cover leaves it the room — on any viewport — and the
  // meta line when there is more than one, since two covers may already be
  // the width of a phone and the strip then scrolls under the edge.
  const signsOnMediaLine = showStrip && data.stripItems.length === 1;
  // A hover panel repeating, on top of the row, what the row now prints
  // inside itself is the one thing a strip makes redundant — and the feed
  // has no peek at all (`rowForm.peek`): it has printed everything one
  // would show. A role row is the exception: its peek is the identity card,
  // which no form prints.
  const showCursorPreview =
    !!cursorPreview &&
    rowForm.peek &&
    (data.type === "role" || (!showStrip && !showStatDescription));
  // The feed's covers are the row's own strip items; what has no cover (a
  // live widget) stacks under the grid. Inspect mode keeps this layout —
  // the handle lives on the tile (InspectableMedia), not on a different
  // renderer — so the editor stays the page it is editing.
  const tiled = new Set(data.stripItems.map((item) => item.media));
  const stacked = expandedMedia.filter((m) => !tiled.has(m));

  // The `--pretty=fuller` header. Roles and events are excluded for the same
  // reason they always were — a role IS its own provenance, an event has none.
  const showAuthorBlock = data.type !== "role" && data.type !== "event";
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
  const iconGapPx = isEvent || isAside ? 3 : isRoleAnchor ? 10 : 7;

  const rowContent = (
    <div className="grid grid-cols-[auto_1fr] @sm:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
      {/*
        The hash is the commit's address, and now says so: clicking it puts
        `#<hash>` in the URL bar and travels the page to this row. It looked
        like a permalink from the day it was drawn — `select-all` so it could
        be copied — while pointing at nothing.

        Events and folded asides keep the transparent placeholder: no
        link, no reference, the hash is noise on a quiet line. An aside
        that has been opened is a real commit again, and the hash
        returns. The column still occupies space so titles stay aligned
        with the rows around it.

        Where the page has margins (`lg`), the hash and the rail hang in the
        left one as marginalia — a fixed width, so the row can be pulled
        left by exactly that and the title lands on the page column's own
        left edge, in line with the era markers and every other page's prose.
        A git log prints the graph and the hash before the subject too; what
        it never did was push the subject off the margin to make room.
      */}
      {isQuiet || !onSelectHash ? (
        <span
          className={cn(
            "hidden @sm:inline-block select-all",
            HASH_CELL,
            TYPE.hash,
            isQuiet ? "text-transparent leading-4" : "leading-5",
          )}
        >
          {data.hash}
        </span>
      ) : (
        <a
          href={`#${data.hash}`}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            e.stopPropagation();
            onSelectHash(data.hash);
          }}
          aria-label={`Link to commit ${data.hash}`}
          className={cn(
            "hidden @sm:inline-block leading-5",
            HASH_CELL,
            TYPE.hash,
            "transition-colors hover:text-muted-foreground",
          )}
        >
          {data.hash}
        </a>
      )}

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
          isQuiet ? "h-4" : "h-5",
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
        {isEvent || isAside ? (
          // Events and folded asides get a tiny CSS dot, quieter
          // than any lucide icon and reads as "node on the rail" rather
          // than "category icon". Asides keep the dot when open so the
          // rail does not jump.
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
            <CommitIcon
              type={data.type}
              override={data.iconOverride}
              className="w-3 h-3 text-tertiary-foreground"
            />
          </span>
        )}
      </span>

      <div className="flex items-center gap-2 min-w-0">
        <span
          className={cn(
            "min-w-0 flex-1",
            // Events and folded asides drop a tier in hierarchy:
            // secondary/meta style. Font per script: CJK uses mono
            // (matches meta line, no italic — italic on CJK reads as
            // emphasis). English uses serif italic (the traditional
            // typographic aside).
            isQuiet
              ? cn(
                  "text-xs text-tertiary-foreground",
                  /[぀-ヿ一-鿿]/.test(displayTitle)
                    ? "font-mono"
                    : "italic font-serif",
                )
              : TYPE.rowTitle,
          )}
        >
          {displayTitle}
          {!isQuiet && data.languageBadge && (
            <span className={cn("ml-2 align-baseline", TYPE.rowMeta)}>
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
          {(!isQuiet ? data.links : []).map((link, i) => {
            const className =
              cn("inline-flex items-center gap-1", TYPE.linkQuiet);
            // The label is one of the notes: the feed spells the rail out.
            const label = rowForm.notes && !link.redundantWhenExpanded && (
              <span className="hidden @sm:inline text-xs">{link.label}</span>
            );

            // A rail icon that stands for one of the commit's attachments
            // opens it through the attachment system, exactly as its cover
            // does; a plain pill (a website, a repo) stays a plain link. The
            // anchor stays either way, for ⌘-click and "copy link address".
            const attachmentIndex =
              attachments && attachmentSet && link.media
                ? attachmentSet.items.indexOf(link.media)
                : -1;

            // Inspecting, the rail selects like everything else on the row.
            // It is the only affordance a pill has — no cover, no tile — so
            // without this a pill is uneditable except by scrolling the
            // inspector, and the icon would follow its href out of the
            // editor besides (there is no set while inspecting, so the
            // branch above cannot take the press).
            const onPress =
              inspecting && link.media
                ? (e: React.MouseEvent) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    onInspectMedia?.(link.media!);
                  }
                : attachmentIndex >= 0
                  ? (e: React.MouseEvent) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      attachments!.open(attachmentSet!, attachmentIndex);
                    }
                  : undefined;

            return (
              <a
                key={`link-${i}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onPress}
                className={cn(
                  className,
                  inspecting &&
                    link.media &&
                    selectedMedia === link.media &&
                    "text-sky-600 dark:text-sky-400",
                )}
              >
                <LinkIcon icon={link.icon} />
                {label}
              </a>
            );
          })}
        </div>

        {hideDate ? (
          data.dateSlotOverride && (
            <span className={cn("shrink-0 ml-auto", TYPE.rowMeta)}>
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
              "text-tertiary-foreground",
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
      {!isQuiet && (data.meta || byline) && (
        <div className={cn("col-start-2 @sm:col-start-3 mt-1 flex items-baseline justify-between gap-2", TYPE.rowMeta)}>
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
          {/* The handle has three places it could sign and wears exactly
              one at a time. Folded with no covers under it, it is here: a
              compact mark stacked horizontally on the meta line, under the
              date. With a cover, it moves to the foot of the strip; open, it
              transposes into the vertical `Author:` / `Role:` stack at the
              foot of the body. While one of the other two is signing, this
              slot holds only the line's height — not a second, invisible
              handle with a peek of its own — so the line beneath never
              moves and the same handle is never mounted twice. */}
          {isExpanded || signsOnMediaLine ? (
            <span aria-hidden className="h-4 shrink-0" />
          ) : (
            <Handle byline={byline} className="text-tertiary-foreground" />
          )}
        </div>
      )}

      {/* Pinned items: rendered once here whether the row is folded or
          expanded, so toggling never remounts them. */}
      {!isQuiet && pinnedMedia.length > 0 && (
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
            set={attachmentSet}
          />
        </div>
      )}

      {/* Contact strip — the `covers` form's. Sits below the
          pinned block so the two read as one column of "what this commit
          contains", largest first: a pinned cover at full width, then the
          rest as thumbnails.

          No handler on this cell: the strip is sized to its covers and stops
          its own clicks, so the line it sits on stays the row's — the empty
          stretch beside a single cover folds and unfolds the commit like any
          other part of it. */}
      {(showStrip || showStatDescription) && (
        // `min-w-0` for the same reason the title row carries it: the content
        // track is `1fr`, whose automatic minimum is its content, and the
        // strip is `w-max`.
        <div className="col-start-2 @sm:col-start-3 mt-1.5 min-w-0 space-y-2">
          {/* Reads down the same left edge the title and the meta do, and
              that the feed will start it on when the row opens. */}
          {showStatDescription && <Description text={data.description} />}

          {/*
            The covers get a line of their own, always. One cover used to tuck
            up beside the text and two or more dropped below it, so a row
            changed shape with its cargo — and a column of twenty-five of them
            changed shape twenty-five times. One arrangement is worth more
            here than the vertical it saves.
          */}
          {showStrip && (
            <div className="flex items-end justify-between gap-4">
              <MediaStrip
                items={data.stripItems}
                set={attachmentSet}
                peek={rowForm.peek && magneticPreviewEnabled}
                className="min-w-0"
                inspecting={inspecting}
                onInspect={onInspectMedia}
                selectedMedia={selectedMedia}
              />

              {/*
                And the room the covers leave takes the letterhead. The handle
                signs the bottom-right of the row, which is where a letterhead
                goes and which is a better use of the space than nothing was.
                The meta line gives it up while this line exists, so it is
                still printed exactly once — and with the same sparseness it
                has always had: at rest, only the head of an author's run
                wears it. A full strip leaves no room, and the handle stays on
                the meta line (`signsOnMediaLine`).
              */}
              {signsOnMediaLine && (
                <Handle byline={byline} className={TYPE.rowMeta} />
              )}
            </div>
          )}
        </div>
      )}

      {isExpanded && (
        // `data-row-body` marks content that is inside the row but is not
        // the row's fold/unfold trigger, so the row's hover background can
        // suppress itself while the cursor is in there (see the `not-has-`
        // clause on the outer row). The expanded body and the contact strip
        // both carry it; the line the strip leaves empty deliberately does
        // not, because that stretch IS the trigger.
        // No enter animation. It used to `fade-in slide-in-from-top-1`, which
        // put a 4px transform and an opacity ramp on a block whose first line
        // is 12px mono — and a transformed/composited layer re-rasterizes
        // small text, so the field stack shimmered and settled by a pixel
        // every time a row opened. The row's own box snaps to its new height
        // regardless, so the animation was moving content around inside an
        // already-final frame: all of the artifact, none of the unfold. If
        // this ever wants motion, it is the row's height that should animate,
        // not the text inside it.
        <div
          data-row-body
          // `min-w-0` for the same reason the strip line carries it: the
          // content track is `1fr`, whose automatic minimum is its content,
          // and a caption line that does not wrap would set it. The covers
          // bleed past this box on a phone and paint there: nothing on this
          // row contains paint, which is what the body being skippable used
          // to cost (see the note on the row's clip-path).
          className="col-start-2 @sm:col-start-3 mt-2 min-w-0 space-y-1.5"
        >
          {/* The message: what it is, the thing itself, the note on it.
              Topics and stats are authored but deliberately unprinted — a row
              of uppercase keywords and a star count were decoration here. */}
          <Description text={data.description} isExpanded />

          {/* The attachment object in the feed (AttachmentGrid): the grid on
              a desk, the edge-to-edge stack on a phone, captions written
              out, and every click its native one. */}
          {expandedMedia.length > 0 && (
            <div onClick={(e) => e.stopPropagation()} className="space-y-4">
              <AttachmentGrid
                items={data.stripItems}
                set={attachmentSet}
                inspecting={inspecting}
                onInspect={onInspectMedia}
                selectedMedia={selectedMedia}
              />
              {stacked.length > 0 && (
                <MediaRenderer
                  media={stacked}
                  layout="stack"
                  size="default"
                  inspecting={inspecting}
                  onInspect={onInspectMedia}
                  selectedMedia={selectedMedia}
                  set={attachmentSet}
                />
              )}
            </div>
          )}

          {/* Liner notes come after the thing they are notes on. */}
          {rowForm.notes && data.commentary && <Commentary text={data.commentary} />}

          {/*
            The author fields, as `git log --pretty=fuller` writes them (see
            `AuthorFields`). They sit at the foot because the folded row
            already carries this information horizontally — the handle on the
            meta line, under the date — and opening the row transposes that
            one compact mark into the vertical stack.

            The labels hold their column at every width — a field stack whose
            keys vanish on a phone is not `--pretty=fuller` any more, it is
            three unlabelled lines, and the wrap that costs is cheaper than
            the form it was buying.
          */}
          {rowForm.notes && showAuthorBlock && (
            <AuthorFields
              byline={byline}
              // Below `@sm` the gutter hash column is hidden, so the row has
              // no permalink at all down there; above it, the gutter already
              // is one and a second would be a duplicate. `onSelect` rather
              // than an href: this page is already /works, so the field makes
              // the row the address in place instead of navigating to itself.
              commit={
                onSelectHash
                  ? {
                      hash: data.hash,
                      onSelect: onSelectHash,
                      className: "@sm:hidden",
                    }
                  : undefined
              }
              className="mt-3"
            />
          )}
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
          // The row's painted box — the one that carries the hover wash, a
          // gutter wider than the row's layout box on each side. The commit
          // permalink's arrival mark paints here too, so "found" and
          // "hovered" are the same shape (see globals.css).
          data-row-trigger
          // Clip the rail segments vertically so they can't leak past the
          // tenure cluster's last row — but only on the block axis. The
          // inline axis stays open so the covers can bleed past the row: the
          // feed's edge to edge on a phone, the strip to the screen's right.
          // A clip-path, not `overflow-y: clip`: WebKit paints a one-axis
          // `overflow: clip` as a clip on both axes (while still computing
          // `overflow-x: visible`), so on iOS every cover stopped at the
          // row's box, 12px in from each edge. The inset clips top and
          // bottom at the border box and leaves the sides a screen's width
          // of room, in every engine. Nothing in the row is
          // `position: fixed` (the cursor preview is the row's sibling), so
          // a clip-path clips nothing an overflow clip would not.
          className={cn(
            "group pressable relative -mx-3 px-3 rounded-lg transition-colors duration-150 [clip-path:inset(0_-100vw)]",
            // The gutter as marginalia (see the hash cell): pulled left by the
            // gutter's width so the content column is the page column. The
            // hover wash follows, which is right — the hash and the rail are
            // the row's, not the margin's.
            GUTTER_PULL,
            // Events get tighter vertical padding so they sit between
            // commits as ambient annotations rather than as full rows.
            isQuiet ? "py-1" : "py-2.5",
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

/**
 * The `<handle>` mark, wherever the row is signing.
 *
 * Sparse by rule: at rest only the head of an author's run wears it, and
 * the repeats inside a run appear on hover — a column of twenty-five rows
 * each restating the same employer is noise, and the rail already draws the
 * tenure. A slot that is not signing right now mounts nothing (the meta
 * line keeps its height with a spacer), so one handle exists per row.
 *
 * The mark is the identity card's trigger (systems/identity): hover peeks
 * the profile, a tap where there is no pointer opens it as a sheet.
 */
function Handle({
  byline,
  className,
}: {
  byline?: Byline | null;
  className?: string;
}) {
  if (!byline) return null;
  return (
    <IdentityHover
      identityId={byline.identityId}
      roleId={byline.roleId}
      wrapperClassName={cn(
        "shrink-0 transition-opacity duration-200",
        byline.isClusterHead
          ? "opacity-100"
          : "opacity-0 group-hover:opacity-100",
      )}
      className={className}
    >
      {byline.handle}
    </IdentityHover>
  );
}
