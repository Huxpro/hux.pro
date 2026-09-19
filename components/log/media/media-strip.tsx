"use client";

/**
 * MediaStrip — a commit's contact sheet.
 *
 * The `stat` density prints one of these under each folded row: every cover
 * the commit is carrying, at 56px tall, in authored order. It is the answer
 * to the /works paradox — folded, the page is a perfect two-screen overview
 * and none of the media exists; unfolded, the media is all there and the
 * overview is gone. The strip keeps one row per commit and still puts the
 * work on screen.
 *
 * It is not a picture of the row: the thumbs are the real affordances, wired
 * to the same door the expanded block opens — the attachment system, which
 * sends a video to the theater, a deck to the stage, a card to an in-app
 * window on a desktop, and everything to the attachment sheet on a phone.
 * Nothing here needs a pointer, which is the other half of the point — the
 * hover peek this stands beside has never existed on a phone.
 *
 * Deliberately chrome-light: rounded covers, a mini play mark where one is
 * warranted, nothing else. Titles live on the row above and the commit's own
 * description sits beside the covers (TimelineCommit lays the two out as one
 * media object); a caption under every thumbnail on top of that would undo
 * the density the strip exists for.
 */

import { MagneticPreview } from "@/components/motion-primitives/magnetic-preview";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { Media, StripItem } from "@/lib/log";
import { isSlidesMedia } from "@/lib/log";
import { getDomainLabel } from "@/lib/og-core";
import { ExternalImage } from "./external-image";
import { mediaPeek } from "./media-peek";
import { MediaMark, mediaKindOf } from "./media-mark";

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
function labelFor({ media }: StripItem): string {
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

  /** Open `media` through the attachment system. Reports whether it took the
   *  click, so the caller knows whether to suppress the anchor. */
  const openInSite = (media: Media): boolean => {
    if (!attachments || !set) return false;
    const index = set.items.indexOf(media);
    if (index < 0) return false;
    attachments.open(set, index);
    return true;
  };

  return (
    <div
      // Content inside the row that is not the row's fold trigger — see the
      // `data-row-body` note in TimelineCommit. Hovering a cover brightens
      // that cover, not the whole commit, exactly as hovering an expanded
      // LinkCard or player does.
      data-row-body
      className={cn(
        // `w-max` so the track is as wide as the covers it draws and no
        // wider; `max-w-full` so past the column width it stops growing and
        // scrolls instead, which is how a phone handles a commit carrying
        // four covers. Both are layout: the clicks are the covers' own (see
        // the anchor below), so an empty stretch of this band is the row's
        // to take, whatever width it happens to have.
        "flex w-max max-w-full gap-1.5 overflow-x-auto overscroll-x-contain",
        "snap-x snap-proximity no-scrollbar",
        className,
      )}
    >
      {items.map((item, i) => {
        const label = labelFor(item);
        const index = set ? set.items.indexOf(item.media) : -1;
        // Where the click will land; a tab means the page refuses to be
        // framed, and the peek says so before the click does.
        const leavesSite =
          attachments && set && index >= 0
            ? attachments.homeOf(set, index) === "tab"
            : false;
        const peek = mediaPeek(item.media, locale, {
          note: leavesSite ? t(locale, "linkOpensInTab") : undefined,
        });

        return (
          // The row itself stops peeking once it prints its covers (see
          // `showCursorPreview` in TimelineCommit); each cover peeks instead,
          // in the same vocabulary, showing what it is at a readable size.
          <MagneticPreview
            key={`${item.media.url}-${i}`}
            preview={peek?.node}
            enabled={!!peek}
            panelClassName={peek?.panelClassName}
            className="shrink-0 snap-start"
          >
            {/* An anchor even when the attachment system will take the
                click: that keeps ⌘-click, middle-click and "copy link
                address" working, and leaves a real destination when the
                provider isn't mounted. */}
            <a
              href={item.media.url}
              target="_blank"
              rel="noopener noreferrer"
              title={leavesSite ? `${label} · ${t(locale, "linkOpensInTab")}` : label}
              aria-label={label}
              onClick={(e) => {
                // A click on a cover is the cover's business: without this
                // the row would fold underneath you as you left for the
                // video. On the anchor rather than the track, so it is the
                // cover that takes the click and not every pixel of the band
                // around it.
                e.stopPropagation();
                // Modified clicks belong to the browser — never hijack them.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                if (openInSite(item.media)) e.preventDefault();
              }}
              className={cn(
                "group/strip relative block",
                // 16:9 at h-14 → ~100px wide, so five fit the content column.
                // A 56px cover is still big enough to recognize a talk slide
                // or a product screenshot; 40px is not.
                "h-14 aspect-video rounded-md overflow-hidden",
                "border border-border/50 bg-muted/30",
                "transition-colors duration-200",
                "hover:border-border focus-visible:border-border",
              )}
            >
              <ExternalImage
                src={item.image}
                alt=""
                className="block h-full w-full object-cover"
              />
              <MediaMark kind={mediaKindOf(item.media)} size="mini" />
            </a>
          </MagneticPreview>
        );
      })}
    </div>
  );
}
