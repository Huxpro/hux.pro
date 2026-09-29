"use client";

/**
 * MediaStrip — a commit's contact sheet.
 *
 * The `covers` form prints one of these under each folded row: every cover
 * the commit is carrying, as a row of `covers` tiles (attachment-tile.tsx)
 * in authored order. It is the answer to the /works paradox — folded, the page is a perfect two-screen
 * overview and none of the media exists; unfolded, the media is all there
 * and the overview is gone. The strip keeps one row per commit and still
 * puts the work on screen.
 *
 * It is not a picture of the row: the thumbs are the real affordances, wired
 * to the same door the expanded block opens — the attachment system, which
 * sends a video to the theater, a deck to the stage, a card to an in-app
 * window on a desktop, and everything to the attachment sheet on a phone.
 * Nothing here needs a pointer, which is the other half of the point — the
 * hover peek this stands beside has never existed on a phone.
 *
 * Deliberately chrome-light: the tiles and their chips, nothing else. Titles
 * live on the row above and the commit's own description sits over the
 * covers; a caption under every thumbnail on top of that would undo the
 * density the strip exists for.
 *
 * When the covers are wider than the column the strip runs on past it,
 * under the page's bleed (`--page-bleed`, globals.css): to the gutter's
 * edge on a phone, where it scrolls, and into the margin on a desk, where
 * three covers simply fit. A cover is only ever cut by the screen. A row of
 * covers cut mid-page reads as a mistake; the same row running under the
 * edge reads as a rail there is more of, which is what it is.
 */

import { useMemo } from "react";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { ARTWORK_CHIP_REST } from "@/lib/glass";
import { TYPE } from "@/lib/typography";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { CommitType, Media, StripItem } from "@/lib/log";
import { CommitIcon } from "../icons";
import { AttachmentTile, resolveTile } from "./attachment-tile";
import { InspectableMedia } from "./inspectable";
import { mediaPeek } from "./media-peek";

export interface MediaStripProps {
  /**
   * The covers to print, already resolved against the viewer's locale by
   * `getMediaStripItems`. The caller derives them (rather than this
   * component) so a row can ask "is there a strip?" — which decides whether
   * the hover peek is redundant — without building the list twice.
   */
  items: StripItem[];
  /**
   * The commit's attachments as one set (see systems/attachments). A cover
   * opens the set at its own item; without a set, or outside the provider,
   * covers are plain outbound links.
   */
  set?: AttachmentSet | null;
  /**
   * Whether a cover peeks on hover: the form's `peek` (lib/log-view.ts)
   * and a pointer to hover with. Off, no peek tree is built — a phone would
   * build and discard one per cover otherwise.
   */
  peek?: boolean;
  className?: string;
  /** Editor inspect: the same handle the leftover renderer wears. */
  inspecting?: boolean;
  onInspect?: (media: Media) => void;
  selectedMedia?: Media | null;
  /**
   * Other commits' covers on this strip (lib/log-hosts.ts): a talk's other
   * telling, the talk that introduced a project. Each run opens its own
   * commit's set, and its first cover wears its name (`中文`,
   * `React Conf 2021`) at the corner the chip leaves free. `before` runs
   * print ahead of the commit's own covers, the rest after them.
   */
  guests?: readonly StripGuest[];
}

export interface StripGuest {
  key: string;
  label?: string;
  items: StripItem[];
  set?: AttachmentSet | null;
  before?: boolean;
  /**
   * The guest as a commit. Under its covers it prints what it is, in one
   * line: the mark its row wears in the gutter (it is a commit, not an
   * attachment), its title and where it was given, over a rule that spans
   * its covers when there are several. Its hash and date are for a closer
   * look: on a pointer, a cover's peek ends with them.
   */
  owner?: {
    type: CommitType;
    icon?: string;
    title: string;
    venue?: string;
    hash: string;
    date: string;
  };
}

export function MediaStrip({
  items,
  set,
  peek = true,
  className,
  inspecting = false,
  onInspect,
  selectedMedia = null,
  guests,
}: MediaStripProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();
  // Once per item, not once per tile per render (attachment-tile.tsx). The
  // strip in runs: the commit's own covers one by one, and each guest's as
  // one group, every cover carrying the set it opens.
  const runs = useMemo(() => {
    const tiles = (runItems: StripItem[], runSet: AttachmentSet | null | undefined) =>
      runItems.map((item) => ({
        slot: resolveTile(item, locale, runSet, attachments),
        set: runSet,
      }));
    const guest = (g: StripGuest) => ({ key: g.key, guest: g, tiles: tiles(g.items, g.set) });
    return [
      ...(guests ?? []).filter((g) => g.before && g.items.length > 0).map(guest),
      { key: "own", guest: undefined, tiles: tiles(items, set) },
      ...(guests ?? []).filter((g) => !g.before && g.items.length > 0).map(guest),
    ];
  }, [items, locale, set, attachments, guests]);
  const slots = runs.flatMap((r) => r.tiles);

  if (slots.length === 0) return null;

  return (
    <div
      // Content inside the row that is not the row's fold trigger — see the
      // `data-row-body` note in TimelineCommit. Hovering a cover brightens
      // that cover, not the whole commit, exactly as hovering an expanded
      // tile does.
      data-row-body
      className={cn(
        // `w-max` so the track is as wide as the covers it draws and no
        // wider; past that it stops growing and scrolls instead. The cap is
        // the column plus the page's bleed, and the track bleeds by the
        // same, so the scroll edge is the screen's edge and the last cover
        // has a gutter to rest in (`pr-6`). Layout only: the clicks are the
        // covers' own, so an empty stretch of this band is the row's to take.
        "flex w-max max-w-[calc(100%+var(--page-bleed))] gap-2 pr-6",
        "[margin-right:calc(var(--page-bleed)*-1)]",
        "overflow-x-auto overscroll-x-contain",
        "snap-x snap-proximity no-scrollbar",
        className,
      )}
    >
      {runs.map((run) => {
        const covers = run.tiles.map(({ slot, set: slotSet }, i) => {
          const owner = run.guest?.owner;
          // A guest's cover peeks as any cover does, and then says whose it is.
          const spec = peek
            ? mediaPeek(slot.media, locale, {
                leaves: slot.leaves,
                footer: owner && <GuestFootnote owner={owner} />,
              })
            : null;
          const label = i === 0 ? run.guest?.label : undefined;
          return (
            <MagneticPreview
              key={`${slot.media.url}-${i}`}
              preview={spec?.node}
              enabled={!!spec}
              panelClassName={spec?.panelClassName}
              className="relative shrink-0 snap-start"
            >
              <InspectableMedia
                media={slot.media}
                inspecting={inspecting}
                selected={selectedMedia === slot.media}
                onInspect={onInspect}
              >
                <AttachmentTile
                  slot={slot}
                  size="covers"
                  locale={locale}
                  set={slotSet}
                  attachments={attachments}
                />
              </InspectableMedia>
              {label && (
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5",
                    "font-mono text-[10px] leading-none whitespace-nowrap backdrop-blur-sm",
                    ARTWORK_CHIP_REST,
                  )}
                >
                  {label}
                </span>
              )}
            </MagneticPreview>
          );
        });
        const owner = run.guest?.owner;
        if (!run.guest) return covers;
        // Several covers of one guest lie in a pile, one cover wide: the
        // first on top, the rest tucked behind it (GuestDeck). A pile is one
        // thing, so its caption needs no rule to say the covers belong
        // together.
        const deck = covers.length > 1;
        return (
          <div key={run.key} className="flex shrink-0 snap-start flex-col">
            {deck ? <GuestDeck covers={covers} /> : <div className="flex gap-2">{covers}</div>}
            {owner && (
              <div className="mt-1.5 w-0 min-w-full">
                <GuestName owner={owner} className="line-clamp-2" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// How far each cover behind the first shows past its right edge, at rest
// and while the pile is hovered; and how much smaller each layer is, so the
// pile stays inside the strip's height (the strip scrolls sideways, which
// clips anything taller than a cover).
const DECK_REST = 10;
const DECK_OPEN = 22;
const DECK_SHRINK = 0.08;

/**
 * A guest's covers as a pile: the first cover on top, the others behind it
 * a step smaller, each showing a sliver past the one in front. The same
 * idea as the row's stacked peek (commit-embed.tsx), laid flat so it fits
 * the strip: the lesser media (a recap post behind a recording) is there
 * but out of the way. Hovering the pile fans the slivers out; each sliver
 * is its own cover, pressed and peeked as any cover is. On a phone the
 * sheet pages through the pile like the rest of the row.
 */
function GuestDeck({ covers }: { covers: React.ReactNode[] }) {
  const behind = covers.length - 1;
  return (
    <div
      // Room for the slivers, fanned where a pointer can fan them, so they
      // stay clear of the next cover; at rest on a touch screen.
      className="group/deck relative pr-[var(--rest-room)] [@media(hover:hover)]:pr-[var(--open-room)]"
      style={
        {
          "--rest-room": `${DECK_REST * behind}px`,
          "--open-room": `${DECK_OPEN * behind}px`,
        } as React.CSSProperties
      }
    >
      <div className="relative rounded-lg shadow-raised" style={{ zIndex: covers.length }}>
        {covers[0]}
      </div>
      {covers.slice(1).map((cover, i) => {
        const depth = i + 1;
        return (
          <div
            key={depth}
            className={cn(
              // Faded a step per layer, as the stacked peek's back cards are,
              // so a dark cover behind a dark cover still reads as a card.
              "absolute inset-y-0 left-0 origin-right transition-[transform,opacity] duration-200 ease-out",
              "opacity-[var(--fade)] group-hover/deck:opacity-100",
              "[transform:translateX(var(--rest))_scale(var(--scale))]",
              "group-hover/deck:[transform:translateX(var(--open))_scale(var(--scale))]",
              "motion-reduce:transition-none",
            )}
            style={
              {
                zIndex: covers.length - depth,
                "--rest": `${DECK_REST * depth}px`,
                "--open": `${DECK_OPEN * depth}px`,
                "--scale": 1 - DECK_SHRINK * depth,
                "--fade": 1 - 0.3 * depth,
              } as React.CSSProperties
            }
          >
            {cover}
          </div>
        );
      })}
    </div>
  );
}

/**
 * A guest named as a commit: the mark its row wears in the gutter, then its
 * title and where it was given, in the row's meta voice.
 */
export function GuestName({
  owner,
  venue = true,
  className,
}: {
  owner: NonNullable<StripGuest["owner"]>;
  /** Off where the venue is already on screen (a cover's peek). */
  venue?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-baseline gap-1.5", TYPE.rowMeta)}>
      <CommitIcon
        type={owner.type}
        override={owner.icon}
        className="h-3 w-3 shrink-0 translate-y-0.5 text-quaternary-foreground"
      />
      <span className={cn("min-w-0", className)}>
        <span className="text-muted-foreground">{owner.title}</span>
        {venue && owner.venue && (
          // A venue breaks onto the next line whole, not inside its name.
          <>
            {" · "}
            <span className="whitespace-nowrap">{owner.venue}</span>
          </>
        )}
      </span>
    </span>
  );
}

/** The last line of a guest cover's peek: whose it is, as a row prints it. */
function GuestFootnote({ owner }: { owner: NonNullable<StripGuest["owner"]> }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="min-w-0 flex-1">
        <GuestName owner={owner} venue={false} className="truncate" />
      </span>
      <span className={cn("shrink-0", TYPE.hash)}>{owner.hash}</span>
      <span className={cn("shrink-0", TYPE.hash)}>{owner.date}</span>
    </div>
  );
}
