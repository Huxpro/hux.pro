"use client";

/**
 * TimelineCommit: dense git-log style commit row for /works timeline.
 *
 * Covers:  hash · icon · title ··· [📎 n in the index] venue date
 *          + the text (description and commentary, whole) and the
 *          strip of covers under it
 * Opened:  + the notes under the covers: the details. A row with none
 *          has no press. (The author fields are the feed's alone.)
 *
 * Every fact on the row has one place, in every form and every state: the
 * title line is the same line folded and open, and opening a row only adds
 * below it. See "The title line" in docs/system-attachments.md.
 *
 * 3-column grid: [hash | icon | content]. Hash column collapses on small containers.
 * Uses the same shared primitives as CommitCard to ensure visual sync.
 * Consumes NormalizedCommit, so it is type-agnostic.
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
import { MagicLink } from "@/components/magic-link/magic-link";
import { InlineText } from "./inline-text";
import {
  Description,
  Commentary,
  Details,
  AuthorFields,
} from "./embeds/shared";
import { Paperclip } from "lucide-react";
import { MediaRenderer } from "./media";
import { AttachmentGrid } from "./media/attachment-grid";
import { MediaStrip } from "./media/media-strip";
import type { AttachmentSet } from "@/systems/attachments";
import { IdentityHover, useOptionalIdentityCard } from "@/systems/identity";
import { useInputCapability } from "@/services";

import { TYPE } from "@/lib/typography";

/**
 * The gutter (hash, rail icon, and the two gaps between them and the title)
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
 * from the page's left edge, off the line the page title sits on and out
 * of the width the reading needs. So below `lg` the row is laid out as on a
 * phone: the icon on the column's edge, no hash. A tablet gets the desk
 * layout held landscape and the phone layout held portrait.
 */
export const HASH_CELL = "lg:w-14 lg:text-right";
export const GUTTER_PULL = "lg:-ml-[6.5rem]";

export interface BeamSpec {
  /** Source hash, or null for a target-only spec. A target-only spec
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
  /** The row's piece of the chapter graph: the trunk, and a side lane
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
   *  this spec. This guards against React effect-ordering races where a
   *  sibling's stale clear would otherwise overwrite a fresh hover on
   *  another row. */
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
  /** The page's form: how much of the commit to print (lib/log-view.ts). */
  form?: LogForm;
  /**
   * Make this commit the page's address. When supplied, the hash column is
   * the permalink it always looked like (see `useCommitAnchor`).
   */
  onSelectHash?: (hash: string) => void;
  /**
   * The commit's attachments as one set (see systems/attachments). Every
   * media affordance on the row (a strip cover, an expanded player or
   * card) opens this set at its own item, so from any of them a phone gets
   * the attachment sheet and a desktop the theater or a window.
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
  // A title over a sentence is a heading (`TYPE.rowHeading`). A title on its
  // own line (the index) is the only thing printed and needs no weight.
  // The form decides it, not the press: a title that thickened as its row
  // opened was the one thing on the title line that moved. Decided after
  // the description is known (`printsMessage`), below.
  const isEvent = data.type === "event";
  const isAside = data.present === "aside";
  // Folded asides borrow the event voice: muted italic line, rail
  // dot, no hash. Opening one reveals the real title and media; the
  // type is unchanged, so filters still find it.

  // The `--pretty=fuller` header. Roles and events are excluded for the same
  // reason they always were: a role IS its own provenance, an event has none.
  const showAuthorBlock = data.type !== "role" && data.type !== "event";

  // Whether a press would print anything this row has: the row is pressable
  // only then. Read off the two presets rather than listed by hand, so it
  // cannot disagree with what a press does. Decoration (the author fields,
  // the hash) is in neither, so it is never the reason: when it was, every
  // row in `covers` was pressable and most presses brought only that, which
  // taught the reader that pressing was not worth it. Topics and stats are
  // authored but not printed, so they are not a reason either.
  //
  // A folded aside (or a row under a held track) is the exception: its press
  // brings the row back from its quiet line, whatever the form prints.
  // An event never opens. It is a dateline, and its press used to toggle
  // state that drew nothing.
  const atRest = rowFormFor(form, false);
  const onPress = rowFormFor(form, true);
  const hasText = !!(data.description || data.commentary);
  const hasMedia = data.expandedMedia.length > 0;
  const hasExpandableContent =
    !isEvent &&
    (((isAside || quiet) && (hasText || hasMedia)) ||
      (onPress.notes !== atRest.notes && !!data.details) ||
      (onPress.description !== atRest.description && hasText) ||
      (onPress.media !== atRest.media && hasMedia));

  // The row's own state is one bit: has the reader pressed this row? The
  // form printed a preset (`rowFormFor`), and this flips its notes (the
  // long form under the covers): printed where the form left them out,
  // folded where the form had printed them. The text, the picture and the
  // author fields stay the form's, except in the index, which prints no
  // text or picture: there an open row brings both (see `rowFormFor`).
  const [pressed, setPressed] = useState(defaultExpanded);

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
    if (followsForm) setPressed(false);
  }

  // Inspect selects; it does not invent a layout. A selected row shows its
  // notes so the fields being edited are on screen.
  const rowOpen = inspecting ? isSelected : pressed;

  // Pinned items render once in a stable spot beneath the row (visible
  // folded *and* expanded), so toggling never remounts them. The expanded
  // block renders the rest; normalizeCommit has already excluded pinned
  // items from `expandedMedia`, so no further filtering is needed here.
  const pinnedMedia = data.pinnedMedia as Media[];
  const expandedMedia = data.expandedMedia;

  const handleToggleExpanded = useCallback(() => {
    if (!hasExpandableContent) return;
    setPressed((prev) => !prev);
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
  // because "the feed is already every row open". Folding one commit among
  // a column of open ones was the same click as opening a caption, and
  // nothing painted the difference. Now they are different clicks: this one
  // changes the notes, the cover's opens the attachment.
  const rowOnClick = inspecting
    ? onInspectCommit
    : rowOpensIdentity
      ? openIdentity
      : hasExpandableContent
        ? handleToggleExpanded
        : undefined;

  // The row's form: the page's, with its notes flipped if the reader pressed
  // this row (`rowFormFor`, lib/log-view.ts: a form is a preset of the
  // row's atoms). Everything below reads those atoms and nothing reads the
  // form's name: the feed's atoms already say "no strip, no peek".
  const rowForm = rowFormFor(form, rowOpen);

  // What `covers` adds under the title line: the text, whole, and the strip
  // of covers. Both or either: a commit with no media still gets its
  // description, so a form is "title, what, and what it looks like" rather
  // than "title, and covers if any".
  //
  // Events and folded asides are out. Events are datelines between
  // commits, not works; asides borrow that voice until opened. Giving
  // either a caption while folded would promote a quiet line to a
  // paragraph.
  //
  // The strip is the folded form's own: while the row is open the feed's
  // grid shows the real thing, and a row of miniatures of what is directly
  // below it is noise.
  const isQuiet = isEvent || ((isAside || quiet) && !rowOpen);
  const displayTitle = isQuiet && data.foldedTitle ? data.foldedTitle : data.title;
  const showStrip =
    !isQuiet && rowForm.media === "covers" && data.stripItems.length > 0;
  const printsText =
    !isQuiet && rowForm.description !== "none" && !!data.description;
  // Whether the form prints a sentence under the title, which is what
  // decides the title's weight (see the note above). The form's, not the
  // row's: an index row opened onto its sentence keeps the one-liner's
  // weight, so the press only ever adds below the title line.
  const printsMessage =
    !isQuiet &&
    rowFormFor(form, false).description !== "none" &&
    !!data.description;
  // ── The signature ──────────────────────────────────────────────────
  // Who made it, as `git log --pretty=fuller` writes it: `commit`, `Author:`,
  // `Role:`, the same three fields on every row and every viewport, and
  // never at rest. They are provenance, not content (the chapter names the
  // company, the title line the team), so they neither print nor gate the
  // row's press; they come when asked for.
  //
  //  - On a desk the hash already hangs in the margin, and the other two
  //    fade in under it while the row is hovered or focused (`MarginFields`)
  //    in the margin, so nothing in the column moves.
  //  - Anywhere, a tap on the row's mark in the gutter toggles the stack:
  //    below `lg`, where there is no margin, it opens under the row as the
  //    labelled field stack; on a desk it pins the margin's. An easter egg:
  //    the mark wears no affordance and the row does not look pressable for
  //    it. The row's own press stays the notes'.
  //
  // It replaces the `@handle` that signed the foot of a single cover: one
  // mark at rest on some rows, standing for a stack nobody could reach.
  // The feed prints the fields outright (`rowForm.author`), so it has no egg.
  const signs = !isQuiet && showAuthorBlock && !rowForm.author;
  const [signed, setSigned] = useState(false);
  const toggleSignature = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setSigned((v) => !v);
  };
  // Where a finger goes looking for it: the mark in the gutter; the team
  // (`Lynx @ ByteDance`, `M.S. Capstone @ RIT`), plain text that reads like
  // it should open something and the place a reader asking "as what?" would
  // tap; and the date, the other half of the metadata line and the commit's
  // own timestamp. A venue that is a link keeps its link (a conference
  // page); one that is not becomes this. All of them look exactly as they
  // did, with no underline and no pointer of their own. An egg, not a
  // control. While the signature is out the whole line stays lit
  // (`sig-team`), the line it came from.
  const sigTap = (text: string, className?: string) => (
    <button
      type="button"
      onClick={toggleSignature}
      aria-expanded={signed}
      aria-label={`${text}: who signed this`}
      className={cn(
        "sig-team cursor-[inherit] text-left outline-none focus-visible:text-foreground",
        className,
      )}
    >
      {text}
    </button>
  );

  // The venue on the title line: where a talk was given, where a piece of
  // press ran, where a project was built (the byline's team, printed
  // sparsely: the first row of a run). A link where the meta is one. It is
  // on the title line in every form and every state, so opening a row moves
  // nothing above the description. It is never under the title: this
  // removes the line between a title and its sentence, whatever the
  // viewport. On a desk the metadata is the right of the title line,
  // `📎 n · venue · date`. Below `@md` the line has no room for it, so it
  // becomes an eyebrow: the same three, one mono line *over* the title, the
  // way an editorial kicker sits over a headline. Nothing is cut to fit a
  // column, and the title and its sentence still sit together.
  //
  // A venue with a page (a conference) is a magic link to it, not a way out:
  // it peeks the page's card under a pointer, and a press goes where a
  // /works cover's page goes (the drawer on a phone, the in-app browser on
  // a desk), through the same attachments policy. It used to leave for a
  // new tab with a `↗`, the one door the title line had of its own, a
  // 12px target beside the date. Its click stops at the venue: opening a
  // conference is not pressing the row.
  const besideText = data.meta ?? byline?.subtitle;
  const venueLink = (text: string, className?: string) => (
    <span className={cn("min-w-0", className)} onClick={(e) => e.stopPropagation()}>
      <MagicLink href={data.metaUrl} title={text} className="venue-link">
        {text}
      </MagicLink>
    </span>
  );
  const beside =
    !isQuiet && besideText ? (
      data.meta && data.metaUrl ? (
        venueLink(besideText, "text-right")
      ) : signs ? (
        sigTap(besideText, "truncate")
      ) : (
        <span className="truncate">{besideText}</span>
      )
    ) : null;
  // The same venue as running text, for the eyebrow. No truncation (the
  // line wraps if it must).
  const venueInline =
    !isQuiet && besideText ? (
      data.meta && data.metaUrl ? (
        venueLink(besideText)
      ) : signs ? (
        sigTap(besideText)
      ) : (
        <>{besideText}</>
      )
    ) : null;
  // What the date slot prints: the date, or a role's location under a
  // chapter that hides dates. Read by the title line and the eyebrow alike.
  const dateText = hideDate ? data.dateSlotOverride : data.date;

  // A strip makes one thing redundant: a hover panel repeating, on top of
  // the row, what the row now prints inside itself. The feed has no peek at
  // all (`rowForm.peek`), since it has printed everything one would show.
  // A role row follows the same rule, though its peek is the
  // identity card, which no form prints: once the row has opened into its
  // prose and covers, the whole block lighting a card under the pointer
  // gets in the way of reading them. The one-liner peeks; an open row's
  // handle still does (IdentityHover).
  const showCursorPreview =
    !!cursorPreview && rowForm.peek && !showStrip && !printsText;
  // The feed's covers are the row's own strip items; what has no cover (a
  // live widget) stacks under the grid. Inspect mode keeps this layout.
  // The handle lives on the tile (InspectableMedia), not on a different
  // renderer, so the editor stays the page it is editing.
  const tiled = new Set(data.stripItems.map((item) => item.media));
  const stacked = expandedMedia.filter((m) => !tiled.has(m));
  // Every link is an attachment with a cover, so the title line carries no
  // way out of its own. Where the covers print, they are the doors; where
  // they don't (the index, folded), the line counts them, and opening the
  // row brings them.
  const attachmentCount =
    !isQuiet && rowForm.media === "none" ? expandedMedia.length : 0;

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
  // a pointerType guard so only mouse/pen drive the hover state.
  // Touch is ignored and isExpanded becomes the sole signal on phones.
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
    if (isHovered || rowOpen) {
      onBeamSet?.(beamSpec);
    } else {
      // Pass our own spec so the parent can guard against a stale clear
      // (a sibling's later effect overwriting a fresh set on another row).
      onBeamClear?.(beamSpec);
    }
  }, [participatesInSegment, beamSpec, isHovered, rowOpen, onBeamSet, onBeamClear]);

  // Git-graph rail drawn THROUGH the icon column as two separate
  // absolutely-positioned segments, one above the icon and one below.
  // Each stops a few px short of the icon's center so the icon sits
  // in a gap on the line. No bg-mask needed; the line
  // doesn't exist where the icon does. computeRail emits `┐` (role
  // anchor: segment below only), `│` (mid: both), `┘` (segment end:
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
  // `isQuiet`, not `isAside`: the gap has to follow whatever the gutter
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
        The eyebrow, below `@md` only. Placed first, in the content
        column: grid auto-placement then starts the hash, the mark and the
        title on the next row, so the mark sits on the title's line, not
        the eyebrow's. From `@md` it is not rendered and the title line is
        the first row again. Quiet rows keep their date on the line.
      */}
      {!isQuiet && (
        <p
          className={cn(
            // `items-start`, not `items-baseline`: every cell is one 16px
            // line box, so their tops are their baselines, and the 📎
            // count, whose icon has no baseline of its own, cannot move the
            // venue when an open row takes it away. `mb-1.5`: a kicker
            // set a step off its headline, not touching it.
            "col-start-2 lg:col-start-3 @md:hidden mb-1.5 flex items-start gap-2 leading-4",
            TYPE.rowMeta,
          )}
        >
          {/* The venue on the left, the count and the date packed to the
              right edge. That is the same right edge the title line keeps on
              a desk, so the date sits in the column a reader scans down. */}
          <span className="min-w-0 flex-1">{venueInline}</span>
          <span className="ml-auto flex shrink-0 items-start gap-2">
            {attachmentCount > 0 && (
              <span
                className="inline-flex h-4 items-center gap-1"
                aria-label={
                  attachmentCount === 1 ? "1 attachment" : `${attachmentCount} attachments`
                }
              >
                <Paperclip aria-hidden className="h-3 w-3" />
                {attachmentCount}
              </span>
            )}
            {dateText && (signs ? sigTap(dateText) : <span>{dateText}</span>)}
          </span>
        </p>
      )}
      {/*
        The hash is the commit's address: clicking it puts `#<hash>` in the
        URL bar and scrolls the page to this row. From the day it was drawn
        it looked like a permalink (`select-all` so it could be copied), but
        it pointed at nothing.

        Events and folded asides keep the transparent placeholder: no
        link, no reference, the hash is noise on a quiet line. An aside
        that has been opened is a real commit again, and the hash
        returns. The column still occupies space so titles stay aligned
        with the rows around it.

        Where the page has margins (`lg`), the hash and the rail hang in the
        left one as marginalia. They have a fixed width, so the row can be
        pulled left by exactly that and the title lands on the page column's
        own left edge, in line with the era markers and every other page's prose.
        A git log prints the graph and the hash before the subject too; what
        it never did was push the subject off the margin to make room.
      */}
      {isQuiet || !onSelectHash ? (
        <span
          className={cn(
            "hidden lg:inline-block select-all",
            HASH_CELL,
            TYPE.hash,
            signs && "sig-hash",
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
          title="Open commit, or drag to Ask"
          className={cn(
            "hidden lg:inline-block leading-5",
            HASH_CELL,
            TYPE.hash,
            "transition-colors hover:text-muted-foreground",
            signs && "sig-hash",
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
          // (left-1/2 of this span) is identical for every row.
          // Otherwise the event's narrower span would shift the line
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
        {/* The node: on the trunk, or moved onto the side lane. Also the
            signature's easter egg (see "The signature"): a tap toggles it,
            and the only sign is the mark giving under the finger. */}
        <span
          className="inline-flex items-center justify-center"
          style={onSide ? { transform: `translateX(-${LANE}px)` } : undefined}
          onClick={signs ? toggleSignature : undefined}
        >
        {isQuiet ? (
          // A row in the quiet voice gets a tiny CSS dot, quieter than any
          // lucide icon and reading as "node on the rail" rather than
          // "category icon". That is every event, and an aside while it is
          // folded. It reads the same `isQuiet` as the title and the
          // container height, so the three cannot disagree about which
          // voice the row is in.
          //
          // Opening an aside gives the icon back: the row is printing its
          // real title and its media by then, and the gutter saying `talk`
          // is part of that. Nothing jumps: the container is already `h-5`
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
              // The signature's nod (globals.css): the mark hands it over.
              signs && "sig-mark",
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
              // (see `mark`, commit-data.ts). 16px is the role ring's size,
              // so the two things that fill this column fill it alike. The
              // corner radius is a home-screen icon's at that size.
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
          // Events and folded asides drop a tier in size and face, not
          // to the tertiary rung: a life event is the row's whole content,
          // and at 12px on tertiary it was 2.1:1. Face is per script (see
          // QuietLine): Latin serif italic, CJK upright mono.
          <QuietLine
            text={displayTitle}
            className="min-w-0 flex-1 text-xs text-muted-foreground"
          />
        ) : (
          <span
            className={cn(
              "min-w-0 flex-1",
              printsMessage ? TYPE.rowHeading : TYPE.rowTitle,
            )}
          >
            {displayTitle}
            {data.languageBadge && (
              <span className={cn("ml-2 align-baseline", TYPE.rowMeta)}>
                {data.languageBadge}
              </span>
            )}
            {/* `git log --decorate`: the talks that present this project,
                as refs on its title line. On trial (lib/works-talks.ts). */}
            {data.decorations && data.decorations.length > 0 && (
              <span
                className="ml-2 align-baseline font-mono text-xs text-tertiary-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                (<span className="text-quaternary-foreground">talks:</span>{" "}
                {data.decorations.map((d, i) => (
                  <span key={i}>
                    {i > 0 && ", "}
                    <InlineText text={d} />
                  </span>
                ))}
                )
              </span>
            )}
          </span>
        )}

        {/* The right of the title line: the count, the venue, the date.
            They are packed to the edge rather than spread, so what an
            open row takes away (the count, which its covers replace)
            leaves the venue and the date exactly where they were. The
            venue yields first; the count and the date never do. Below
            `@md` an ordinary row prints this as the eyebrow instead; a
            quiet row has only its date, and keeps it here. */}
        <span
          className={cn(
            "ml-auto min-w-0 max-w-[55%] shrink items-center justify-end gap-2",
            isQuiet ? "flex" : "hidden @md:flex",
          )}
        >
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
                "inline-flex min-w-0 justify-end text-right",
                TYPE.rowMeta,
              )}
            >
              {beside}
            </span>
          )}

          {dateText &&
            (signs ? (
              sigTap(dateText, "font-mono text-xs shrink-0 text-tertiary-foreground")
            ) : (
              <span
                className={cn(
                  "font-mono text-xs shrink-0",
                  // The date stays, because the year is the meaning for life
                  // events (`moved to US, 2017`), but a tier quieter than
                  // siblings so the row reads as background context.
                  "text-tertiary-foreground",
                )}
              >
                {dateText}
              </span>
            ))}
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

      {/* ── The text ───────────────────────────────────────────────────
          Everything a reader should know about the commit, above its
          covers and whole: the description, and my line on it. It used to
          be two lines with the rest behind a press, which made the page a
          thing to open row by row rather than to read by scrolling, and
          put the one sentence in my own voice behind the same press as the
          author fields. What a press brings now is only the long form,
          under the picture (the notes).

          Deliberately NOT `data-row-body`: this is the press target. The
          row's own control acts on it, so it stays part of the trigger. */}
      {printsText && (
        <div className="col-start-2 lg:col-start-3 mt-1.5 min-w-0 space-y-1.5">
          <Description text={<InlineText text={data.inline.description} />} />
          {data.inline.commentary && (
            <Commentary text={<InlineText text={data.inline.commentary} />} />
          )}
        </div>
      )}

      {/* Git trailers, one per talk that presents this project: on trial
          (lib/works-talks.ts). The tail of a commit message, in its voice. */}
      {!isQuiet && data.trailers && data.trailers.length > 0 && (
        <div className="col-start-2 lg:col-start-3 mt-1.5 min-w-0 space-y-0.5 font-mono text-xs leading-4 text-tertiary-foreground">
          {data.trailers.map((t, i) => (
            <p key={i}>
              <span className="text-quaternary-foreground">{t.key}:</span>{" "}
              <span onClick={(e) => e.stopPropagation()}>
                <InlineText text={t.value} />
              </span>
            </p>
          ))}
        </div>
      )}

      {/* ── The attachment object ──────────────────────────────────────
          The form's, never the row's. A press on the text leaves this
          exactly where it was, which is what lets the press survive inside
          the feed: it can no longer be mistaken for opening a caption.

          `covers`: the contact strip. No handler on this cell: the strip is
          sized to its covers and stops its own clicks, so the line it sits
          on stays the row's; the empty stretch beside a single cover presses
          the row like any other part of it. */}
      {!isQuiet && rowForm.media === "covers" && data.stripItems.length > 0 && (
        <div className="col-start-2 lg:col-start-3 mt-1.5 min-w-0">
          {/* The covers get a line of their own, always. One cover used to
              tuck up beside the text and two or more dropped below it, so a
              row changed shape with its cargo, and a column of twenty-five
              of them changed shape twenty-five times. */}
          <MediaStrip
            items={data.stripItems}
            set={attachmentSet}
            peek={rowForm.peek && magneticPreviewEnabled}
            className="min-w-0"
            inspecting={inspecting}
            onInspect={onInspectMedia}
            selectedMedia={selectedMedia}
          />
        </div>
      )}

      {/* `grid`: the feed's object. Half-column tiles on a desk, the
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
          The long form, which a reader asks for row by row: the details (a
          programme abstract, a thesis's particulars). Under the picture,
          because nothing here is needed to know what the work is: the text
          above the covers already said it.

          Then the author fields, which no press brings: decoration, printed
          by the feed because the feed prints everything (`rowForm.author`).

          No enter animation. It used to `fade-in slide-in-from-top-1`,
          which put a 4px transform and an opacity ramp on a block whose
          first line is 12px mono. A transformed layer re-rasterizes small
          text, so the field stack shimmered and settled by a pixel every
          time. The row's box snaps to its new height regardless. If this
          ever wants motion, it is the height that should animate. */}
      {!isQuiet &&
        ((rowForm.notes && !!data.details) ||
          (rowForm.author && showAuthorBlock)) && (
        <div
          data-row-body
          onClick={(e) => e.stopPropagation()}
          className="col-start-2 lg:col-start-3 mt-1.5 min-w-0 space-y-1.5 cursor-default"
        >
          {rowForm.notes && data.inline.details && (
            <Details text={<InlineText text={data.inline.details} />} />
          )}

          {/* The labels hold their column at every width. A field stack
              whose keys vanish on a phone is just unlabelled lines, not
              `--pretty=fuller`. */}
          {rowForm.author && showAuthorBlock && (
            <AuthorFields byline={byline} className="mt-3" />
          )}
        </div>
      )}

      {/* The signature below `lg`, when the mark or the team was tapped:
          the labelled stack, with the hash as its `commit` field (there is
          no gutter hash down here. On a desk too where the row prints no
          text (an index line), which is too short to hold the margin's.

          Always mounted, folded to no height, so opening is motion rather
          than a jump: the row opens to the stack's height (`sig-fold`) while
          the lines print in after it (`print`). The spacing above it lives
          inside the fold, so a closed one takes nothing; `inert` keeps its
          link and its card out of the tab order while it is closed.
          `data-row-body`: reading it is not pressing the row. */}
      {signs && (
        <div
          data-row-body
          onClick={(e) => e.stopPropagation()}
          inert={!signed}
          className={cn(
            "sig-fold col-start-2 lg:col-start-3 min-w-0 cursor-default",
            printsText && "lg:hidden",
          )}
        >
          <div>
            <AuthorFields
              byline={byline}
              commit={{ hash: data.hash, onSelect: onSelectHash }}
              print
              withRole={false}
              className="pt-3"
            />
          </div>
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
          // brighten the rail while the row is open. It works on mobile and
          // survives losing focus after a tap-to-expand.
          data-expanded={rowOpen ? "" : undefined}
          // The row's painted box: the one that carries the hover wash, a
          // gutter wider than the row's layout box on each side. The commit
          // permalink's arrival mark paints here too, so "found" and
          // "hovered" are the same shape (see globals.css).
          data-row-trigger
          // The signature's state, for its CSS (globals.css): a host whose
          // margin shows on hover, and open when its egg was found.
          data-sig-host={signs ? "" : undefined}
          data-sig-open={signs && signed ? "" : undefined}
          // Clip the rail segments vertically so they can't leak past the
          // tenure cluster's last row, but only on the block axis. The
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
            // hover wash follows, which is right: the hash and the rail are
            // the row's, not the margin's.
            GUTTER_PULL,
            // Events get tighter vertical padding so they sit between
            // commits as ambient annotations rather than as full rows.
            isQuiet ? "py-1" : "py-2.5",
            rowOnClick ? "pressable cursor-pointer" : "cursor-default",
            "@container",
            // Hover/active highlight is tied to the fold/unfold trigger
            // only. When the cursor moves into the expanded body
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
          {signs && printsText && (
            <MarginFields byline={byline} style={hashNudge} />
          )}
          {rowContent}
        </div>
      </MagneticPreview>
    </div>
  );
}

/**
 * The signature on a desk: the author under the hash, in the page's margin.
 * The hash is the stack's `commit` field already, so the two read as one
 * block hanging from it, right-aligned to its edge; nothing in the column
 * moves. No role: the author opens the identity card, which carries it,
 * and a role repeated on every row of a tenure restated the company the
 * handle and the team already name.
 *
 *        171252e     hash: lights to tertiary with it
 *   <jsx@fb.com>     the who: 12px, muted
 *
 * `top-8` (the row's 10px padding + the title's 20px line + 2px) puts it
 * 6px under the hash's own 16px text box. Its right edge meets the hash's
 * exactly, measured at 1024 / 1280 / 1600.
 *
 * Motion is CSS (globals.css, "The signature"): it drops in from the hash
 * on hover, after a beat of intent, or at once when the egg pinned it
 * (`data-sig-open` on the row). `data-sig-margin` keeps it out of the
 * pointer's way until it shows. It prints only where the form prints the
 * text: an index line is shorter than the block, and the row's clip-path
 * would cut it (the call site opens the labelled stack instead).
 */
function MarginFields({
  byline,
  style,
}: {
  byline?: Byline | null;
  style?: React.CSSProperties;
}) {
  const author = (
    <span className="sig-drop block font-mono text-xs leading-4 text-muted-foreground">
      &lt;{byline?.handle ?? "hux"}&gt;
    </span>
  );
  return (
    <div
      data-sig-margin
      style={style}
      className="absolute right-[calc(100%-4.25rem)] top-8 hidden w-32 text-right lg:block xl:w-44 2xl:w-52"
    >
      {byline ? (
        <IdentityHover
          identityId={byline.identityId}
          roleId={byline.roleId}
          block
          // The trigger hugs the handle, pushed to the right edge: its
          // highlight bleeds 8px past the text each side (`-mx-2 px-2`), so
          // sized to the text it washes the handle and a hair around it,
          // and the negative margin lets the text itself end on the hash's
          // edge. Spanning the margin's width, the wash ran a column of
          // empty margin to the handle's left.
          wrapperClassName="flex justify-end"
          className="text-right"
        >
          {author}
        </IdentityHover>
      ) : (
        // A personal work, signed by no identity: the same fallback the
        // field stack prints.
        author
      )}
    </div>
  );
}
