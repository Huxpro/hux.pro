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
   * The guest's own caption under its first cover: it is still a commit,
   * so it keeps its name and its address. `line` is what it is (a talk's
   * title, or where another telling was given); then its hash and date.
   */
  caption?: { line: string; hash: string; date: string };
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
  // Once per item, not once per tile per render (attachment-tile.tsx). Each
  // cover carries the set it opens and, first in a guest's run, its name.
  const slots = useMemo(() => {
    const run = (
      runItems: StripItem[],
      runSet: AttachmentSet | null | undefined,
      label?: string,
      caption?: StripGuest["caption"],
    ) =>
      runItems.map((item, i) => ({
        slot: resolveTile(item, locale, runSet, attachments),
        set: runSet,
        label: i === 0 ? label : undefined,
        caption: i === 0 ? caption : undefined,
      }));
    const guest = (g: StripGuest) => run(g.items, g.set, g.label, g.caption);
    return [
      ...(guests ?? []).filter((g) => g.before).flatMap(guest),
      ...run(items, set),
      ...(guests ?? []).filter((g) => !g.before).flatMap(guest),
    ];
  }, [items, locale, set, attachments, guests]);

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
      {slots.map(({ slot, set: slotSet, label, caption }, i) => {
        // The row itself stops peeking once it prints its covers (see
        // `showCursorPreview` in TimelineCommit); each cover peeks instead,
        // in the same vocabulary, showing what it is at a readable size —
        // and whole, where the tile crops.
        const spec = peek
          ? mediaPeek(slot.media, locale, { leaves: slot.leaves })
          : null;
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
            {caption && (
              <div className="mt-1.5 w-0 min-w-full">
                <div className={cn("truncate", TYPE.rowMeta, "text-muted-foreground")}>
                  {caption.line}
                </div>
                <div className={cn("mt-0.5 flex gap-2", TYPE.hash)}>
                  <a
                    href={`#${caption.hash}`}
                    onClick={(e) => e.stopPropagation()}
                    className="transition-colors hover:text-muted-foreground"
                  >
                    {caption.hash}
                  </a>
                  <span>{caption.date}</span>
                </div>
              </div>
            )}
          </MagneticPreview>
        );
      })}
    </div>
  );
}
