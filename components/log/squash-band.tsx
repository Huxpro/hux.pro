"use client";

/**
 * SquashBand — the level nested under a squashed row's header.
 *
 * A squashed row (lib/log-squash.ts) is two levels, not one flattened one.
 * The header is the row as it always was — title line, meta line, prose —
 * saying only what every member shares. This band is the second level: the
 * members, side by side, each saying only what is its own.
 *
 * Side by side is the point. The first version of this pooled every
 * member's media into the lead's strip, which was compact and lied about
 * whose each cover was; the second gave every member its own line and its
 * own covers, which was honest and was two rows again. The band keeps the
 * one line an ordinary row's strip already occupies, and binds each run of
 * covers to its own member with a bracket and a caption — so the
 * association is spatial, costs a caption's height rather than a row's,
 * and reads as "these, within that".
 *
 * One band, three densities, following the form's atoms (lib/log-view.ts):
 *
 *   index   `media: none`   — no pictures, so the members are a line of
 *                              chips: what each one is, flowing across.
 *   covers  `media: covers` — the strip, grouped: each member a bracketed
 *                              run of covers with its caption hung under it.
 *   feed    `media: grid`   — the members as cards, two up on a desk and a
 *                              swipeable rail on a phone: covers at full
 *                              size, and each member's own prose under them.
 *
 * A member's prose prints wherever the row prints its prose whole
 * (`description: "full"`) — the feed, or a covers row the reader pressed —
 * because a description is detail about ONE member, and the header must not
 * borrow one to speak for the group.
 */

import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { indexOfMedia, type Media, type StripItem } from "@/lib/log";
import type { RowForm } from "@/lib/log-view";
import { useLocale } from "@/services";
import {
  useOptionalAttachments,
  type AttachmentSet,
} from "@/systems/attachments";
import type { SimpleLink, SquashMemberView, SquashView } from "./commit-data";
import { LinkIcon } from "./embeds/shared";
import { CommitIcon } from "./icons";
import { MediaRenderer } from "./media";
import { AttachmentTile, resolveTile } from "./media/attachment-tile";
import { InspectableMedia } from "./media/inspectable";
import { MediaStrip, type StripGroup } from "./media/media-strip";

export interface SquashBandProps {
  squash: SquashView;
  /** The row's density — which of the three bands to draw. */
  rowForm: RowForm;
  /** Under a parent, the parent's own covers: the head of the band, bare. */
  ownItems?: StripItem[];
  /**
   * The row's own address. A group of peers sits at its newest member, so
   * the row already carries that member's hash as its `id` — and the
   * connector finds the row by it and looks inside for the rail icon. That
   * member's run must not claim the same id a second time.
   */
  rowHash: string;
  set?: AttachmentSet | null;
  peek?: boolean;
  onSelectHash?: (hash: string) => void;
  inspecting?: boolean;
  onInspectMedia?: (media: Media) => void;
  onInspectMember?: (commitId: string) => void;
  selectedMemberId?: string | null;
  selectedMedia?: Media | null;
}

export function SquashBand(props: SquashBandProps) {
  const { rowForm } = props;
  if (rowForm.media === "none") return <Chips {...props} />;
  if (rowForm.media === "covers") return <Runs {...props} />;
  return <Cards {...props} />;
}

// =============================================================================
// Shared pieces
// =============================================================================

/** A member's anchor — its hash, unless the row itself already answers to
 *  it (see `rowHash`). One id, one element. */
function anchorOf(hash: string, rowHash: string): string | undefined {
  return hash === rowHash ? undefined : hash;
}

/** The editor's handle on a member: select it, and ring it when selected. */
function inspectProps(
  commitId: string,
  { onInspectMember, selectedMemberId }: SquashBandProps,
) {
  return {
    className: cn(
      onInspectMember && "cursor-pointer rounded-md",
      selectedMemberId === commitId &&
        "ring-1 ring-offset-4 ring-offset-background ring-sky-500/70",
    ),
    wrapperProps: onInspectMember
      ? {
          "data-editor-interactive": "",
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            onInspectMember(commitId);
          },
        }
      : undefined,
  };
}

/** The member's own address — a permalink, exactly as the gutter hash is. */
function MemberHash({
  hash,
  onSelectHash,
}: {
  hash: string;
  onSelectHash?: (hash: string) => void;
}) {
  // Hidden on a phone for the same reason the gutter hash is: the column is
  // too narrow to spend on an address.
  const cls = cn("shrink-0 hidden @sm:inline", TYPE.hash);
  if (!onSelectHash) return <span className={cn(cls, "select-all")}>{hash}</span>;
  return (
    <a
      href={`#${hash}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        e.stopPropagation();
        onSelectHash(hash);
      }}
      aria-label={`Link to commit ${hash}`}
      className={cn(cls, "transition-colors hover:text-muted-foreground")}
    >
      {hash}
    </a>
  );
}

/** A member's links, as the row's rail draws them — through the set when
 *  the link is one of its attachments, a plain link otherwise. */
function MemberLinks({
  links,
  set,
}: {
  links: SimpleLink[];
  set?: AttachmentSet | null;
}) {
  const attachments = useOptionalAttachments();
  if (links.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {links.map((link, i) => {
        const index =
          attachments && set && link.media ? indexOfMedia(set.items, link.media) : -1;
        return (
          <a
            key={`${link.url}-${i}`}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={link.label}
            aria-label={link.label}
            onClick={(e) => {
              e.stopPropagation();
              if (index < 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              attachments!.open(set!, index);
            }}
            className={TYPE.linkQuiet}
          >
            <LinkIcon icon={link.icon} />
          </a>
        );
      })}
    </span>
  );
}

/**
 * What a member says about itself: the fields that vary, and nothing the
 * header already said. The label first — it is what the member IS — then
 * one mono line of facts, the row's own date-line vocabulary.
 */
function MemberCaption({
  member,
  links,
  showDescription,
  clampLabel,
  onSelectHash,
  set,
}: {
  member: SquashMemberView;
  links: SimpleLink[];
  showDescription: boolean;
  clampLabel: boolean;
  onSelectHash?: (hash: string) => void;
  set?: AttachmentSet | null;
}) {
  return (
    <div className="min-w-0 space-y-0.5">
      <div
        title={member.label}
        className={cn(
          "text-xs leading-snug",
          member.quiet ? "text-tertiary-foreground" : "text-muted-foreground",
          clampLabel && "line-clamp-2",
        )}
      >
        {member.label}
      </div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-2 gap-y-0.5",
          TYPE.rowMeta,
        )}
      >
        {/* The relation leads the facts line: it is the one thing here the
            data could not have derived, and the reason the member is in
            this group at all. */}
        {member.relation && <span className={cn(TYPE.pill, "shrink-0 whitespace-nowrap")}>{member.relation}</span>}
        {member.showType && (
          <CommitIcon type={member.type} className="h-3 w-3 text-tertiary-foreground" />
        )}
        <MemberHash hash={member.hash} onSelectHash={onSelectHash} />
        {member.date && <span className="shrink-0">{member.date}</span>}
        {member.languageBadge && <span className="shrink-0">{member.languageBadge}</span>}
        <MemberLinks links={links} set={set} />
      </div>
      {showDescription && member.description && (
        <p className={cn(TYPE.caption, "pt-1")}>{member.description}</p>
      )}
    </div>
  );
}

/** Where a member with no picture stands in a run of covers: a cover-sized
 *  outline with its type mark, so its bracket lines up with the others. */
function NoCover({ member }: { member: SquashMemberView }) {
  return (
    <div className="flex h-28 w-[12.5rem] items-center justify-center rounded-lg border border-dashed border-border">
      <CommitIcon type={member.type} className="h-4 w-4 text-quaternary-foreground" />
    </div>
  );
}

// =============================================================================
// index — chips
// =============================================================================

/**
 * The members in one flowing line. No covers at this density, so the link
 * icons a cover would have stood for come back: every one of the member's
 * links, beside the member it is.
 */
function Chips({ squash, set, onSelectHash, rowHash, ...rest }: SquashBandProps) {
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", TYPE.rowMeta)}>
      {squash.members.map((m, i) => {
        const { className, wrapperProps } = inspectProps(m.commit.id, {
          squash,
          set,
          onSelectHash,
          rowHash,
          ...rest,
        });
        return (
          <span key={m.commit.id} className="inline-flex min-w-0 items-baseline gap-2">
            {i > 0 && (
              <span aria-hidden className="text-quaternary-foreground">
                /
              </span>
            )}
            <span
              id={anchorOf(m.hash, rowHash)}
              {...wrapperProps}
              className={cn("inline-flex min-w-0 items-baseline gap-1.5", className)}
            >
              {m.relation && <span className={cn(TYPE.pill, "shrink-0 whitespace-nowrap")}>{m.relation}</span>}
              {m.showType && (
                <CommitIcon
                  type={m.type}
                  className="h-3 w-3 shrink-0 self-center text-tertiary-foreground"
                />
              )}
              <MemberHash hash={m.hash} onSelectHash={onSelectHash} />
              <span
                title={m.label}
                className={cn(
                  "min-w-0 truncate",
                  m.quiet ? "text-tertiary-foreground" : "text-muted-foreground",
                )}
              >
                {m.label}
              </span>
              {m.date && <span className="shrink-0">{m.date}</span>}
              {m.languageBadge && <span className="shrink-0">{m.languageBadge}</span>}
              <span className="self-center">
                <MemberLinks links={m.links} set={set} />
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}

// =============================================================================
// covers — bracketed runs
// =============================================================================

function Runs(props: SquashBandProps) {
  const {
    squash,
    rowForm,
    ownItems = [],
    set,
    peek,
    onSelectHash,
    inspecting,
    onInspectMedia,
    selectedMedia,
  } = props;

  const groups: StripGroup[] = [
    // A parent's own covers head the band, bare — they are the row's.
    ...(ownItems.length > 0 ? [{ key: "own", items: ownItems }] : []),
    ...squash.members.map((m): StripGroup => {
      const { className, wrapperProps } = inspectProps(m.commit.id, props);
      return {
        key: m.commit.id,
        id: anchorOf(m.hash, props.rowHash),
        items: m.stripItems,
        className,
        wrapperProps,
        placeholder: <NoCover member={m} />,
        caption: (
          <MemberCaption
            member={m}
            links={m.extraLinks}
            showDescription={rowForm.description === "full"}
            // The run is a cover wide; two lines of name, and the rest is
            // one hover (`title`) or one press (the prose) away.
            clampLabel
            onSelectHash={onSelectHash}
            set={set}
          />
        ),
      };
    }),
  ];

  return (
    <MediaStrip
      groups={groups}
      set={set}
      peek={peek}
      className="min-w-0"
      inspecting={inspecting}
      onInspect={onInspectMedia}
      selectedMedia={selectedMedia}
    />
  );
}

// =============================================================================
// feed — cards
// =============================================================================

function Cards(props: SquashBandProps) {
  const {
    squash,
    rowForm,
    set,
    onSelectHash,
    inspecting,
    onInspectMedia,
    selectedMedia,
  } = props;
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();

  return (
    <div
      data-row-body
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "cursor-default",
        // A phone: a rail of cards, one and a peek of the next, swiped —
        // the strip's own gesture, and still one line of the page. Bleeds
        // to the screen's edge the way the strip does.
        "flex items-start gap-4 overflow-x-auto overscroll-x-contain pr-6",
        "snap-x snap-mandatory no-scrollbar",
        "[margin-right:calc(var(--page-bleed)*-1)]",
        // A desk: two up, the feed's own half-column grid. A third member
        // takes the next row of the grid rather than hiding past the edge —
        // the feed is the form where everything is on screen.
        "@md:grid @md:grid-cols-2 @md:gap-x-5 @md:gap-y-6",
        "@md:mr-0 @md:overflow-visible @md:pr-0",
      )}
    >
      {squash.members.map((m) => {
        const { className, wrapperProps } = inspectProps(m.commit.id, props);
        const slots = m.stripItems.map((item) =>
          resolveTile(item, locale, set, attachments),
        );
        return (
          <article
            key={m.commit.id}
            id={anchorOf(m.hash, props.rowHash)}
            {...wrapperProps}
            className={cn(
              "group/run w-[70vw] max-w-[18rem] shrink-0 snap-start",
              "@md:w-auto @md:max-w-none",
              className,
            )}
          >
            <div className="space-y-2">
              {slots.length > 0 ? (
                slots.map((slot, i) => (
                  <InspectableMedia
                    key={`${slot.media.url}-${i}`}
                    media={slot.media}
                    inspecting={!!inspecting}
                    selected={selectedMedia === slot.media}
                    onInspect={onInspectMedia}
                  >
                    <AttachmentTile
                      slot={slot}
                      size="cell"
                      locale={locale}
                      set={set}
                      attachments={attachments}
                    />
                  </InspectableMedia>
                ))
              ) : (
                <NoCover member={m} />
              )}
            </div>
            {/* The same bracket the covers density hangs its captions from,
                so a member reads as one thing at both sizes. */}
            <span
              aria-hidden
              className={cn(
                "mt-1.5 block h-1.5 rounded-b-[3px] border-x border-b border-border",
                "transition-colors duration-150 group-hover/run:border-muted-foreground/45",
              )}
            />
            <div className="mt-1.5">
              <MemberCaption
                member={m}
                links={m.extraLinks}
                showDescription={rowForm.description === "full"}
                clampLabel={false}
                onSelectHash={onSelectHash}
                set={set}
              />
            </div>
            {m.leftovers.length > 0 && (
              <div className="mt-3">
                <MediaRenderer
                  media={m.leftovers}
                  layout="stack"
                  size="default"
                  inspecting={inspecting}
                  onInspect={onInspectMedia}
                  selectedMedia={selectedMedia}
                  set={set}
                />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

