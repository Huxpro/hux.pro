"use client";

/**
 * MediaStrip — a commit's contact sheet.
 *
 * The `stat` density prints one of these under each folded row: every cover
 * the commit is carrying, as a row of `strip`-sized tiles in authored order.
 * It is the answer to the /works paradox — folded, the page is a perfect
 * two-screen overview and none of the media exists; unfolded, the media is
 * all there and the overview is gone. The strip keeps one row per commit and
 * still puts the work on screen.
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
 * density the strip exists for. The size is the tile's (attachment-tile.tsx):
 * tall enough to recognise a talk slide or a product screenshot, and three
 * of them fill the column.
 */

import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { StripItem } from "@/lib/log";
import { isSlidesMedia } from "@/lib/log";
import { getDomainLabel } from "@/lib/og-core";
import { AttachmentTile, tileMark } from "./attachment-tile";
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
  className?: string;
}

/** Tooltip / screen-reader text for one cover. */
export function tileLabel({ media }: StripItem): string {
  if (isSlidesMedia(media)) return media.title || "Slides";
  if (media.kind === "image") return media.alt || "Image";
  if (media.kind === "link") {
    return media.preview?.title || getDomainLabel(media.url);
  }
  return getDomainLabel(media.url);
}

export function MediaStrip({ items, set, className }: MediaStripProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();

  if (items.length === 0) return null;

  return (
    <div
      // Content inside the row that is not the row's fold trigger — see the
      // `data-row-body` note in TimelineCommit. Hovering a cover brightens
      // that cover, not the whole commit, exactly as hovering an expanded
      // tile does.
      data-row-body
      className={cn(
        // `w-max` so the track is as wide as the covers it draws and no
        // wider; `max-w-full` so past the column width it stops growing and
        // scrolls instead, which is how a phone handles a commit carrying
        // three covers. Both are layout: the clicks are the covers' own, so
        // an empty stretch of this band is the row's to take.
        "flex w-max max-w-full gap-2 overflow-x-auto overscroll-x-contain",
        "snap-x snap-proximity no-scrollbar",
        className,
      )}
    >
      {items.map((item, i) => {
        // The row itself stops peeking once it prints its covers (see
        // `showCursorPreview` in TimelineCommit); each cover peeks instead,
        // in the same vocabulary, showing what it is at a readable size —
        // and whole, where the tile crops.
        const { leaves } = tileMark(item.media, locale, set, attachments);
        const peek = mediaPeek(item.media, locale, { leaves });
        return (
          <MagneticPreview
            key={`${item.media.url}-${i}`}
            preview={peek?.node}
            enabled={!!peek}
            panelClassName={peek?.panelClassName}
            className="shrink-0 snap-start"
          >
            <AttachmentTile
              media={item.media}
              image={item.image}
              size="strip"
              locale={locale}
              label={tileLabel(item)}
              set={set}
              attachments={attachments}
            />
          </MagneticPreview>
        );
      })}
    </div>
  );
}
