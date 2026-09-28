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
import type { Media, StripItem } from "@/lib/log";
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
   * The guest as a commit. Under its covers it prints what it is, its title
   * and where it was given, over a rule that spans them all when there are
   * several, so each reads as the guest's. Its hash and date are for a
   * closer look: on a pointer, a cover's peek ends with them.
   */
  owner?: {
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
        return (
          // A guest's covers stand together over one caption. With several,
          // a rule spans them so each reads as the guest's; one needs none.
          <div key={run.key} className="flex shrink-0 snap-start flex-col">
            <div className="flex gap-2">{covers}</div>
            {owner && (
              <div
                className={cn(
                  "mt-1.5 w-0 min-w-full",
                  covers.length > 1 && "border-t border-border/60 pt-1",
                )}
              >
                <div className={cn("truncate", TYPE.rowMeta, "text-muted-foreground")}>
                  {owner.title}
                </div>
                {owner.venue && (
                  <div className={cn("mt-0.5 truncate", TYPE.hash)}>{owner.venue}</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The last line of a guest cover's peek: whose it is, as a row prints it. */
function GuestFootnote({ owner }: { owner: NonNullable<StripGuest["owner"]> }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={cn("min-w-0 flex-1 truncate", TYPE.rowMeta, "text-muted-foreground")}>
        {owner.title}
      </span>
      <span className={cn("shrink-0", TYPE.hash)}>{owner.hash}</span>
      <span className={cn("shrink-0", TYPE.hash)}>{owner.date}</span>
    </div>
  );
}
