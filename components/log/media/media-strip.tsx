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

import { useMemo, type ReactNode } from "react";
import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { Media, StripItem } from "@/lib/log";
import { AttachmentTile, resolveTile, type TileSlot } from "./attachment-tile";
import { InspectableMedia } from "./inspectable";
import { mediaPeek } from "./media-peek";

/**
 * A run of covers that belong together — one member of a squashed row.
 *
 * The strip is still one strip: one track, one scroll, one bleed, the same
 * tiles. A group only changes what binds the covers — a bracket under the
 * run, and a caption hanging from it that is exactly as wide as the covers
 * it names. That bracket is the nesting: the row above is the group, and
 * each run is one of the commits it stands for.
 */
export interface StripGroup {
  key: string;
  items: StripItem[];
  /**
   * Hung under the run by a bracket. Absent: the covers are the row's own
   * (a parent's, at the head of its band) and print bare, as any row's do.
   */
  caption?: ReactNode;
  /** The member's anchor, so `#<hash>` lands on its run. */
  id?: string;
  /** Classes for the run's wrapper — the editor's selection ring. */
  className?: string;
  /** Props for the wrapper — the editor's inspect handle. */
  wrapperProps?: React.HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>;
  /**
   * What a run with no covers at all stands on: a member attached nothing
   * with a picture. Keeps its place in the band at a cover's height, so the
   * bracket and the caption line up with their neighbours.
   */
  placeholder?: ReactNode;
}

export interface MediaStripProps {
  /**
   * The covers to print, already resolved against the viewer's locale by
   * `getMediaStripItems`. The caller derives them (rather than this
   * component) so a row can ask "is there a strip?" — which decides whether
   * the hover peek is redundant — without building the list twice.
   *
   * Or `groups`, for a row that stands for several commits.
   */
  items?: StripItem[];
  /** Runs of covers, each bracketed and captioned — see {@link StripGroup}. */
  groups?: StripGroup[];
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
}

export function MediaStrip({
  items,
  groups,
  set,
  peek = true,
  className,
  inspecting = false,
  onInspect,
  selectedMedia = null,
}: MediaStripProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();
  const runs: StripGroup[] = useMemo(
    () => groups ?? [{ key: "own", items: items ?? [] }],
    [groups, items],
  );
  // Once per item, not once per tile per render (attachment-tile.tsx).
  const slots = useMemo(
    () =>
      runs.map((run) =>
        run.items.map((item) => resolveTile(item, locale, set, attachments)),
      ),
    [runs, locale, set, attachments],
  );

  if (!runs.some((r, i) => slots[i].length > 0 || r.caption)) return null;
  const grouped = !!groups;

  const tile = (slot: TileSlot, i: number) => {
    // The row itself stops peeking once it prints its covers (see
    // `showCursorPreview` in TimelineCommit); each cover peeks instead, in
    // the same vocabulary, showing what it is at a readable size — and
    // whole, where the tile crops.
    const spec = peek
      ? mediaPeek(slot.media, locale, { leaves: slot.leaves })
      : null;
    return (
      <MagneticPreview
        key={`${slot.media.url}-${i}`}
        preview={spec?.node}
        enabled={!!spec}
        panelClassName={spec?.panelClassName}
        // A grouped run snaps as a whole; its covers do not snap alone.
        className={cn("shrink-0", !grouped && "snap-start")}
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
            set={set}
            attachments={attachments}
          />
        </InspectableMedia>
      </MagneticPreview>
    );
  };

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
        "flex w-max max-w-[calc(100%+var(--page-bleed))] pr-6",
        // Between runs, more air than between the covers inside one — the
        // gap is itself part of how the grouping reads.
        grouped ? "items-start gap-5" : "gap-2",
        "[margin-right:calc(var(--page-bleed)*-1)]",
        "overflow-x-auto overscroll-x-contain",
        "snap-x snap-proximity no-scrollbar",
        className,
      )}
    >
      {grouped
        ? runs.map((run, r) => (
            <div
              key={run.key}
              id={run.id}
              {...run.wrapperProps}
              className={cn(
                "group/run shrink-0 snap-start flex flex-col",
                run.className,
              )}
            >
              <div className="flex gap-2">
                {slots[r].length > 0 ? slots[r].map(tile) : run.placeholder}
              </div>
              {run.caption && (
                <>
                  {/* The bracket: an open box under the run, as wide as its
                      covers, that the caption hangs from. It brightens with
                      the run, so pointing at a caption shows which covers
                      it is naming, and pointing at a cover shows its name. */}
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-1.5 rounded-b-[3px] border-x border-b",
                      "border-border transition-colors duration-150",
                      "group-hover/run:border-muted-foreground/45",
                      "group-focus-within/run:border-muted-foreground/45",
                    )}
                  />
                  {/* `w-0 min-w-full`: the caption takes the run's width
                      and wraps inside it, instead of widening the run to fit
                      its longest line. The covers decide the width; the
                      words fit under them. */}
                  <div className="mt-1.5 w-0 min-w-full">{run.caption}</div>
                </>
              )}
            </div>
          ))
        : slots[0].map(tile)}
    </div>
  );
}
