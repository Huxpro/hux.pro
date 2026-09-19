"use client";

/**
 * AttachmentGrid — a commit's attachment object at the `patch` density.
 *
 * The feeds this page borrows from (X, LinkedIn, Instagram) all agree on one
 * thing about media in a post: the media has a footprint, and the count
 * changes how the footprint is tiled, never how big the post is. Here the
 * unit is half the column, and every tile is that size whatever the commit
 * carries — one, two, or three. So a video next to a card is two equal
 * tiles, a commit with one card is not twice the height of a commit with
 * two, and every tile on the page has the same right edge as its neighbour.
 *
 * The count decides only what the text does:
 *
 *   ┌────────┐ ┌────────┐      two (or four) — a pair of tiles, each with
 *   │        │ │        │      the same two caption lines under it: where
 *   └────────┘ └────────┘      it is from, and what it is.
 *    SOURCE      SOURCE
 *    Title       Title
 *
 *   ┌────────┐  SOURCE         one (or a third) — the tile with its caption
 *   │        │  Title           beside it, the description included: the
 *   └────────┘  Description…    unfurl a chat app prints for a link, which
 *                               is what a lone attachment is.
 *
 * Captions are fixed at their line counts rather than clamped to whatever a
 * publisher wrote, so a pair's two tiles are the same height by
 * construction, not by luck. The full text is a hover away in the peek and
 * a click away in the surface.
 *
 * Below `@sm` (a phone) the grid is still two across: a pair stays a pair,
 * and a lone tile spans the column with its caption under it, which is the
 * card the phone always had.
 */

import { Fragment } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { Media } from "@/lib/log";
import { AttachmentTile, tileCaption } from "./attachment-tile";

export interface AttachmentGridProps {
  /** Tiles, in authored order — each with the cover the caller resolved. */
  items: { media: Media; image: string }[];
  set?: AttachmentSet | null;
  className?: string;
}

const SOURCE = cn(TYPE.labelSm, "truncate");
const TITLE = "text-xs leading-4 text-foreground";

export function AttachmentGrid({ items, set, className }: AttachmentGridProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();
  if (items.length === 0) return null;

  const openOf = (media: Media) => {
    const index = set && attachments ? set.items.indexOf(media) : -1;
    return index >= 0 && set && attachments
      ? () => attachments.open(set, index)
      : undefined;
  };

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-2.5 gap-y-3 items-start",
        className,
      )}
    >
      {items.map(({ media, image }, i) => {
        const caption = tileCaption(media, locale);
        const lone = items.length % 2 === 1 && i === items.length - 1;
        const open = openOf(media);
        const tile = (
          <AttachmentTile
            media={media}
            image={image}
            size="cell"
            locale={locale}
            label={caption.title || caption.source}
            set={set}
            attachments={attachments}
          />
        );

        if (!lone) {
          return (
            <figure key={`${media.url}-${i}`} className="min-w-0">
              {tile}
              <figcaption className="mt-1.5 min-w-0 space-y-0.5">
                <div className={SOURCE}>{caption.source}</div>
                <div className={cn(TITLE, "truncate")}>{caption.title}</div>
              </figcaption>
            </figure>
          );
        }

        // A lone tile: the caption moves beside it, and gets the room to say
        // more. On a phone the pair of cells stacks — tile, then caption.
        return (
          <Fragment key={`${media.url}-${i}`}>
            <div className="col-span-2 @sm:col-span-1 min-w-0">{tile}</div>
            <div
              className={cn(
                "col-span-2 @sm:col-span-1 min-w-0 self-center space-y-1",
                open && "cursor-pointer",
              )}
              onClick={open}
            >
              <div className={SOURCE}>{caption.source}</div>
              <div className={cn(TITLE, "font-medium line-clamp-2")}>
                {caption.title}
              </div>
              {caption.description ? (
                <p className={cn(TYPE.captionQuiet, "line-clamp-3")}>
                  {caption.description}
                </p>
              ) : (
                caption.action && (
                  <div className={cn("inline-flex items-center gap-1 pt-0.5", TYPE.rowMeta)}>
                    <caption.action.icon
                      className="size-3"
                      strokeWidth={2.25}
                      fill={caption.action.fill ? "currentColor" : "none"}
                    />
                    {caption.action.label}
                  </div>
                )
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
