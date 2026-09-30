"use client";

/**
 * TimelineCommit — Dense git-log style commit row for /works timeline.
 *
 * Summary: hash · icon · title ··· [📎 n in the index] venue date
 *          + description (clamped) and the strip of covers (`covers`)
 * Expanded: description whole, media, commentary, author fields
 *
 * Every fact on the row has one place, in every form and every state: the
 * title line is the same line folded and open, and opening a row only adds
 * below it. See "The title line" in docs/system-attachments.md.
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
import { ProjectMark } from "./project-mark";
import { QuietLine } from "./quiet-line";
import {
  GraphInCell,
  HASH_NUDGE,
  LANE,
  type RowGraph,
  type RowLit,
} from "./timeline-lane";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { Description, Commentary, AuthorFields } from "./embeds/shared";
import { Paperclip } from "lucide-react";
import { MediaRenderer } from "./media";
import { AttachmentGrid } from "./media/attachment-grid";
import { MediaStrip } from "./media/media-strip";
import type { AttachmentSet } from "@/systems/attachments";
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
 * subtracts on the right.
 *
 * The hash exists only where it can hang. Below `lg` the page has no margin
 * wide enough (the gutter wants ~120px of it: a 680px column needs a ~872px
 * viewport), and a hash kept inside the column would push every title in
 * from the page's left edge — off the line the page title sits on, and out
 * of the width the reading needs. So there the row is a phone's: the icon on
 * the column's edge, no hash. A tablet reads as a desk held landscape, and
 * as a phone held portrait.
 */
export const HASH_CELL = "lg:w-14 lg:text-right";
export const GUTTER_PULL = "lg:-ml-[6.5rem]";

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
  className?: string;
  hideDate?: boolean;
  /** Git-graph rail char to draw on the right (`┐`, `│`, `┘` or empty). */
  rail?: string;
  /** The row's piece of the chapter graph — the trunk, and a side lane
   *  where chapters overlap (see `timeline-lane.tsx`). Given, it draws the
   *  line through the icon column in place of the tenure rail, which then
   *  only lights it. */
  graph?: RowGraph;
  /** Which of those lines a lit connector runs along. */
  graphLit?: RowLit;
  /** The row speaks in an aside's quiet voice until the reader opens it,
   *  whatever it is (the timeline's step down under a held track). */
  quiet?: boolean;
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
   * media affordance on the row — a strip cover, an expanded player or
   * card — opens this set at its own item, so a phone gets the
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
  className,
  hideDate = false,
  rail,
  graph,
  graphLit,
  quiet = false,
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

  // The row's own state is one bit, and it is about the prose only: has the
  // reader pressed this row's text? The form printed a density
  // (`rowFormFor`), and this flips it — relieved where the form clamped,
  // clamped back where the form had already printed it whole. The picture
  // stays the form's, except in the index, which prints none: there an
  // open row brings its covers too (see `rowFormFor`).
  const [textRelieved, setTextRelieved] = useState(defaultExpanded);

  // A form change is a new default, so the deviation is spent. Reconciled
  // during render rather than in an effect (React's "adjusting state when a
  // prop changes"), so the row never paints at the old density first.
  //
  // An aside is the exception, in both directions: the forms are a
  // statement about the ordinary commits, and a talk that folded itself
  // down to the conference's name has said it is not one. Entering `feed`
  // does not open it, and leaving does not close one the reader opened.
  const followsForm = !isAside;
  const [lastForm, setLastForm] = useState(form);
  if (form !== lastForm) {
    setLastForm(form);
    if (followsForm) setTextRelieved(false);
  }

  // Inspect selects; it does not invent a layout. A selected row shows its
  // prose whole so the fields being edited are on screen.
  const textOpen = inspecting ? isSelected : textRelieved;

  // Pinned items render once in a stable spot beneath the row (visible
  // folded *and* expanded), so toggling never remounts them. The expanded
  // block renders the rest; normalizeCommit has already excluded pinned
  // items from `expandedMedia`, so no further filtering is needed here.
  const pinnedMedia = data.pinnedMedia as Media[];
  const expandedMedia = data.expandedMedia;

  const handleToggleExpanded = useCallback(() => {
    if (!hasExpandableContent) return;
    setTextRelieved((prev) => !prev);
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

  // Every row keeps its press, in every form. The feed used to drop it
  // because "the feed is already every row open" — folding one commit among
  // a column of open ones was the same click as opening a caption, and
  // nothing painted the difference. They are not the same click any more:
  // this one changes the prose, the cover's opens the attachment.
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
  const rowForm = rowFormFor(form, textOpen);

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
  const isQuiet = isEvent || ((isAside || quiet) && !textOpen);
  const displayTitle = isQuiet && data.foldedTitle ? data.foldedTitle : data.title;
  const showStrip =
    !isQuiet && rowForm.media === "covers" && data.stripItems.length > 0;
  const showStatDescription =
    !isQuiet && rowForm.description === "clamp" && !!data.description;
  // Where the handle signs: the foot of the strip, when a single cover
  // leaves it the room — on any viewport. Two covers may already be the
  // width of a phone and the strip then scrolls under the edge, so a row
  // with more prints no handle while folded: the chapter names the company,
  // the handle is sparse by rule (cluster heads only), and an open row's
  // author fields name it in full. There is no meta line for it to fall
  // back to any more — the venue sits on the title line, so nothing stands
  // between a title and its sentence.
  const signsOnMediaLine = showStrip && data.stripItems.length === 1;

  // The venue's column on the title line: where a talk was given, where a
  // piece of press ran, where a project was built (the byline's team,
  // printed sparsely — the first row of a run). A link where the meta is
  // one. On the title line in every form and every state, so opening a row
  // moves nothing above the description.
  const besideText = data.meta ?? byline?.subtitle;
  const beside =
    !isQuiet && besideText ? (
      data.meta && data.metaUrl ? (
        <a
          href={data.metaUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex max-w-full items-center gap-1 transition-colors hover:text-foreground"
        >
          <span className="truncate">{besideText}</span>
          <span aria-hidden className="text-[0.7rem]">↗</span>
        </a>
      ) : (
        <span className="truncate">{besideText}</span>
      )
    ) : null;
  // A hover panel repeating, on top of the row, what the row now prints
  // inside itself is the one thing a strip makes redundant — and the feed
  // has no peek at all (`rowForm.peek`): it has printed everything one
  // would show. A role row follows the same rule, though its peek is the
  // identity card, which no form prints: once the row has opened into its
  // prose and covers, the whole block lighting a card under the pointer
  // gets in the way of reading them. The one-liner peeks; an open row's
  // handle still does (IdentityHover).
  const showCursorPreview =
    !!cursorPreview && rowForm.peek && !showStrip && !showStatDescription;
  // The feed's covers are the row's own strip items; what has no cover (a
  // live widget) stacks under the grid. Inspect mode keeps this layout —
  // the handle lives on the tile (InspectableMedia), not on a different
  // renderer — so the editor stays the page it is editing.
  const tiled = new Set(data.stripItems.map((item) => item.media));
  const stacked = expandedMedia.filter((m) => !tiled.has(m));
  // Every link is an attachment with a cover, so the title line carries no
  // way out of its own. Where the covers print, they are the doors; where
  // they don't (the index, folded), the line counts them, and opening the
  // row brings them.
  const attachmentCount =
    !isQuiet && rowForm.media === "none" ? expandedMedia.length : 0;

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
    if (isHovered || textOpen) {
      onBeamSet?.(beamSpec);
    } else {
      // Pass our own spec so the parent can guard against a stale clear
      // (a sibling's later effect overwriting a fresh set on another row).
      onBeamClear?.(beamSpec);
    }
  }, [participatesInSegment, beamSpec, isHovered, textOpen, onBeamSet, onBeamClear]);

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
  // (h-4) so 8px radius + 2px breathing room. A row in the quiet voice:
  // tiny 3px dot, so the line sits close for visual continuity.
  //
  // `isQuiet`, not `isAside` — the gap has to follow whatever the gutter
  // is actually drawing, and an open aside draws the 12px icon. Kept at 3
  // it would run the rail under the mark.
  //
  // A project wears its own mark (ProjectMark): 16px, filled to its edge,
  // so the rail stops where it stops for the role's 16px ring.
  const wearsMark = !isQuiet && !!data.mark;
  const iconGapPx = isQuiet ? 3 : isRoleAnchor || wearsMark ? 10 : 7;
  // A node moved onto the side lane pushes the hash left, the way a
  // `git log --graph` row makes room for its graph (see timeline-lane.tsx).
  const onSide = graph?.side === "node";
  const hashNudge = onSide
    ? { transform: `translateX(-${HASH_NUDGE}px)` }
    : undefined;

  const rowContent = (
    <div className="grid grid-cols-[auto_1fr] lg:grid-cols-[auto_auto_1fr] gap-x-2 items-start">
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
            "hidden lg:inline-block select-all",
            HASH_CELL,
            TYPE.hash,
            isQuiet ? "text-transparent leading-4" : "leading-5",
          )}
          style={hashNudge}
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
            "hidden lg:inline-block leading-5",
            HASH_CELL,
            TYPE.hash,
            "transition-colors hover:text-muted-foreground",
          )}
          style={hashNudge}
        >
          {data.hash}
        </a>
      )}

      <span
        // data-rail-icon marks the row's cell on the graph: the rail, the
        // chapter lanes and their lit paths are all drawn inside it
        // (see timeline-lane.tsx).
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
        {/* Without a chapter graph (a log outside /works), the tenure
            rail is the row's whole graph: a trunk where it runs. */}
        <GraphInCell
          graph={graph ?? { trunkAbove: hasRailAbove, trunkBelow: hasRailBelow }}
          gap={iconGapPx}
          cluster={{ above: hasRailAbove, below: hasRailBelow }}
          lit={graphLit}
        />
        {/* The node: on the trunk, or moved onto the side lane. */}
        <span
          className="inline-flex items-center justify-center"
          style={onSide ? { transform: `translateX(-${LANE}px)` } : undefined}
        >
        {isQuiet ? (
          // A row in the quiet voice gets a tiny CSS dot, quieter than any
          // lucide icon and reading as "node on the rail" rather than
          // "category icon". That is every event, and an aside while it is
          // folded — the same `isQuiet` the title and the container height
          // already read, so the three cannot disagree about which voice
          // the row is in.
          //
          // Opening an aside gives the icon back: the row is printing its
          // real title and its media by then, and the gutter saying `talk`
          // is part of that. Nothing jumps — the container is already `h-5`
          // once `isQuiet` is false, which is the height the icon wants.
          <span
            aria-hidden
            className="block w-[3px] h-[3px] rounded-full bg-graph-node"
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
                // A node on the graph, and lit with its tenure (globals.css,
                // "The graph").
                "ring-graph-node",
                "group-hover/tenure:ring-graph-lit",
                "group-focus-within/tenure:ring-graph-lit",
                "group-has-[[data-expanded]]/tenure:ring-graph-lit",
              ],
            )}
          >
            {data.mark ? (
              // A project's face where the others wear their kind's glyph
              // (see `mark`, commit-data.ts). 16px — the role ring's size,
              // so the two things in this column that fill it fill it
              // alike — with the corner a home-screen icon has at that size.
              <ProjectMark icon={data.mark} className="size-4 rounded-[4px]" />
            ) : (
              <CommitIcon
                type={data.type}
                override={data.iconOverride}
                className={cn(
                  "w-3 h-3",
                  // An open aside wears its type mark a tier quieter than an
                  // ordinary row's. It is the same ladder the aside's title
                  // already steps down (`text-tertiary-foreground` on a row
                  // that is otherwise `rowTitle`), so the gutter says what the
                  // row says: this is a work, and it is a minor one.
                  isAside ? "text-quaternary-foreground" : "text-tertiary-foreground",
                )}
              />
            )}
          </span>
        )}
        </span>
      </span>

      <div className="flex items-center gap-2 min-w-0">
        {isQuiet ? (
          // Events and folded asides drop a tier. Face is per script
          // (see QuietLine): Latin serif italic, CJK upright mono.
          <QuietLine
            text={displayTitle}
            className="min-w-0 flex-1 text-xs text-tertiary-foreground"
          />
        ) : (
          <span className={cn("min-w-0 flex-1", TYPE.rowTitle)}>
            {displayTitle}
            {data.languageBadge && (
              <span className={cn("ml-2 align-baseline", TYPE.rowMeta)}>
                {data.languageBadge}
              </span>
            )}
            {/* Below `@md` the line has no room for a second column: the
                venue takes the next line, still inside the title's block —
                and still the same place folded and open. */}
            {beside && (
              <span className={cn("flex min-w-0 mt-0.5 @md:hidden", TYPE.rowMeta)}>
                {beside}
              </span>
            )}
          </span>
        )}

        {/* The right of the line, packed to the right edge: the count, the
            venue, the date. Packed rather than spread, so what an open row
            takes away — the count, which its covers replace — leaves the
            venue and the date exactly where they were. The venue yields
            first: it truncates, the count and the date never do. */}
        <span className="ml-auto flex min-w-0 max-w-[55%] shrink items-center justify-end gap-2">
          {attachmentCount > 0 && (
            <span
              className={cn("inline-flex shrink-0 items-center gap-1", TYPE.rowMeta)}
              aria-label={
                attachmentCount === 1 ? "1 attachment" : `${attachmentCount} attachments`
              }
            >
              <Paperclip aria-hidden className="h-3 w-3" />
              {attachmentCount}
            </span>
          )}

          {beside && (
            <span
              className={cn(
                "hidden @md:inline-flex min-w-0 justify-end text-right",
                TYPE.rowMeta,
              )}
            >
              {beside}
            </span>
          )}

          {hideDate ? (
            data.dateSlotOverride && (
              <span className={cn("shrink-0", TYPE.rowMeta)}>
                {data.dateSlotOverride}
              </span>
            )
          ) : (
            <span
              className={cn(
                "font-mono text-xs shrink-0",
                // Date stays — the year is the meaning for life events
                // (`moved to US, 2017`) — but pushed a tier quieter than
                // siblings so the row reads as background context.
                "text-tertiary-foreground",
              )}
            >
              {data.date}
            </span>
          )}
        </span>
      </div>

      {/* Pinned items: rendered once here whether the row is folded or
          expanded, so toggling never remounts them. */}
      {!isQuiet && pinnedMedia.length > 0 && (
        <div
          className="col-start-2 lg:col-start-3 mt-2"
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

      {/* ── The message ────────────────────────────────────────────────
          The prose, at whatever density this row is at: the form's, or its
          opposite once the reader pressed it. One element either way — it
          used to be printed twice, clamped in the folded block and whole in
          the expanded body, which is why pressing the text had to swap
          layouts and take the picture with it.

          Deliberately NOT `data-row-body`: this is the press target. The
          text is what the row's own control acts on, so it has to stay part
          of the trigger at both densities. */}
      {!isQuiet && rowForm.description !== "none" && !!data.description && (
        <div className="col-start-2 lg:col-start-3 mt-1.5 min-w-0">
          <Description
            text={data.description}
            isExpanded={rowForm.description === "full"}
          />
        </div>
      )}

      {/* ── The attachment object ──────────────────────────────────────
          The form's, never the row's. A press on the text leaves this
          exactly where it was, which is what lets the press survive inside
          the feed: it can no longer be mistaken for opening a caption.

          `covers` — the contact strip. No handler on this cell: the strip is
          sized to its covers and stops its own clicks, so the line it sits
          on stays the row's; the empty stretch beside a single cover presses
          the row like any other part of it. */}
      {!isQuiet && rowForm.media === "covers" && data.stripItems.length > 0 && (
        <div className="col-start-2 lg:col-start-3 mt-1.5 min-w-0">
          {/* The covers get a line of their own, always. One cover used to
              tuck up beside the text and two or more dropped below it, so a
              row changed shape with its cargo — and a column of twenty-five
              of them changed shape twenty-five times. */}
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

            {/* And the room the covers leave takes the letterhead — where a
                letterhead goes, and a better use of the space than nothing.
                The meta line gives it up while this line exists, so the
                handle is still printed exactly once (`signsOnMediaLine`). */}
            {signsOnMediaLine && (
              <Handle byline={byline} className={TYPE.rowMeta} />
            )}
          </div>
        </div>
      )}

      {/* `grid` — the feed's object: half-column tiles on a desk, the
          edge-to-edge stack on a phone, captions written out, and every
          click its native one. `data-row-body` and its own click guard: a
          caption is for opening the attachment, not for pressing the row. */}
      {!isQuiet && rowForm.media === "grid" && expandedMedia.length > 0 && (
        <div
          data-row-body
          onClick={(e) => e.stopPropagation()}
          className="col-start-2 lg:col-start-3 mt-2 min-w-0 space-y-4 cursor-default"
        >
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

      {/* ── The notes ──────────────────────────────────────────────────
          Notes on the prose, so they ride with it: the same press that
          relieves the description prints these, and clamping it takes them
          away again. They come after the thing they are notes on.

          No enter animation. It used to `fade-in slide-in-from-top-1`,
          which put a 4px transform and an opacity ramp on a block whose
          first line is 12px mono — a transformed layer re-rasterizes small
          text, so the field stack shimmered and settled by a pixel every
          time. The row's box snaps to its new height regardless. If this
          ever wants motion, it is the height that should animate. */}
      {!isQuiet && rowForm.notes && (data.commentary || showAuthorBlock) && (
        <div
          data-row-body
          onClick={(e) => e.stopPropagation()}
          className="col-start-2 lg:col-start-3 mt-1.5 min-w-0 space-y-1.5 cursor-default"
        >
          {data.commentary && <Commentary text={data.commentary} />}

          {/* The author fields, as `git log --pretty=fuller` writes them.
              They sit at the foot because the folded row already carries
              this horizontally — the handle on the meta line, under the
              date — and the press transposes that one compact mark into the
              vertical stack.

              The labels hold their column at every width: a field stack
              whose keys vanish on a phone is not `--pretty=fuller` any
              more, it is three unlabelled lines. */}
          {showAuthorBlock && (
            <AuthorFields
              byline={byline}
              // Below `lg` the gutter hash column is hidden, so the row has
              // no permalink down there; above it the gutter already is one.
              // `onSelect` rather than an href: this page is already /works,
              // so the field makes the row the address in place.
              commit={
                onSelectHash
                  ? {
                      hash: data.hash,
                      onSelect: onSelectHash,
                      className: "lg:hidden",
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
          data-expanded={textOpen ? "" : undefined}
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
          // of room, in every engine. Cursor previews portal to `document.body`
          // (see MagneticPreview), so a clip-path here cannot trap them.
          className={cn(
            "group relative -mx-3 px-3 rounded-lg transition-colors duration-150 [clip-path:inset(0_-100vw)]",
            // The gutter as marginalia (see the hash cell): pulled left by the
            // gutter's width so the content column is the page column. The
            // hover wash follows, which is right — the hash and the rail are
            // the row's, not the margin's.
            GUTTER_PULL,
            // Events get tighter vertical padding so they sit between
            // commits as ambient annotations rather than as full rows.
            isQuiet ? "py-1" : "py-2.5",
            rowOnClick ? "pressable cursor-pointer" : "cursor-default",
            "@container",
            // Hover/active highlight is tied to the fold/unfold trigger
            // only — when the cursor moves into the expanded body
            // ([data-row-body]) the row no longer paints, so hovering a
            // LinkCard / Video / Description doesn't drag the entire
            // commit's background with it. `:has()` raises specificity
            // enough that the negated form wins over the simple `:hover`.
            // In the feed there is no fold, so there is no wash either.
            rowOnClick && "[&:hover:not(:has([data-row-body]:hover))]:bg-muted/20",
            rowOnClick && "[&:active:not(:has([data-row-body]:active))]:bg-muted/30",
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
