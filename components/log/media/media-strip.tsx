"use client";

/**
 * MediaStrip — a commit's contact sheet.
 *
 * The `brief` and `covers` forms print one of these under each folded row:
 * every cover the commit is carrying, as a row of tiles in authored order,
 * at the form's size (`thumbs`, `covers` — attachment-tile.tsx). It is the
 * answer to the /works paradox — folded, the page is a perfect two-screen
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
 * When the covers are wider than the column the strip scrolls — and its
 * track runs to the edge of the page, not the edge of the column, so a cover
 * is only ever cut by the screen. A row of covers cut mid-page reads as a
 * mistake; the same row running under the edge reads as a rail there is more
 * of, which is what it is.
 */

import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { StripItem } from "@/lib/log";
import { isSlidesMedia } from "@/lib/log";
import { getDomainLabel } from "@/lib/og-core";
import {
  AttachmentTile,
  tileMark,
  type AttachmentTileSize,
} from "./attachment-tile";
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
  /** The form's tile size: `thumbs` for `brief`, `covers` for `covers`. */
  size?: Extract<AttachmentTileSize, "thumbs" | "covers">;
  /** Whether a cover peeks on hover (the form's `peek`, lib/log-view.ts). */
  peek?: boolean;
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

export function MediaStrip({
  items,
  set,
  size = "covers",
  peek = true,
  className,
}: MediaStripProps) {
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
        // wider; past that it stops growing and scrolls instead. The cap is
        // the column plus the page gutter, and the track bleeds by the same
        // gutter (`-mr-6`, `<main>`'s `px-6`), so the scroll edge is the
        // screen's edge and the last cover has the gutter to rest in
        // (`pr-6`). Layout only: the clicks are the covers' own, so an empty
        // stretch of this band is the row's to take.
        "flex w-max max-w-[calc(100%+1.5rem)] -mr-6 gap-2 pr-6",
        "overflow-x-auto overscroll-x-contain",
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
        const spec = peek ? mediaPeek(item.media, locale, { leaves }) : null;
        return (
          <MagneticPreview
            key={`${item.media.url}-${i}`}
            preview={spec?.node}
            enabled={!!spec}
            panelClassName={spec?.panelClassName}
            className="shrink-0 snap-start"
          >
            <AttachmentTile
              media={item.media}
              image={item.image}
              size={size}
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
