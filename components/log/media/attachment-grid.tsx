"use client";

/**
 * AttachmentGrid — a commit's attachment object in the `feed` form.
 *
 * The feed is the reading with everything in it, so this is where the
 * captions are written out and where nothing needs a second step: a video
 * plays, a card goes to its page, and no cover peeks or opens a sheet. The
 * chip that stands in for a caption elsewhere is down to the glyph on a
 * recording or a deck (a play mark is an affordance) and gone from a card.
 *
 * Two layouts, one per viewport, because a feed is a different thing on a
 * phone and on a desk:
 *
 * Desk — the feeds this borrows from (X, LinkedIn) agree that media has a
 * footprint and the count changes how it is tiled, never how big the post
 * is. The unit is half the column, and the count decides only what the text
 * does:
 *
 *   ┌────────┐ ┌────────┐      a pair — two tiles, each captioned under:
 *   │        │ │        │      where it is from, what it is, and its blurb.
 *   └────────┘ └────────┘
 *    SOURCE      SOURCE
 *    Title       Title
 *    Blurb…      Blurb…
 *
 *   ┌────────┐  SOURCE         a lone card — the tile with its caption
 *   │        │  Title           beside it and the room to say more: the
 *   └────────┘  Blurb…          unfurl a chat app prints for a link.
 *
 *   ┌───────────────────┐      a lone recording or deck — nothing to say
 *   │                   │      beside it (the row above is its caption), so
 *   └───────────────────┘      it takes the column, as a video post does.
 *
 * Phone — a feed: one thing under the next, each running edge to edge like
 * Instagram's or a landscape video on YouTube's, with the text back in the
 * column under it. A video plays in place; the rest go straight to their
 * native home (the in-app browser, the stage) — never the attachment sheet,
 * which would be a drawer opening on what is already on screen.
 */

import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import { isSlidesMedia, isVideoMedia, type Media } from "@/lib/log";
import {
  AttachmentTile,
  tileCaption,
  tileMark,
  type TileCaption,
} from "./attachment-tile";
import { MediaMark, newTabMark } from "./media-mark";
import { Video } from "./video";

export interface AttachmentGridProps {
  /** Tiles, in authored order — each with the cover the caller resolved. */
  items: { media: Media; image: string }[];
  set?: AttachmentSet | null;
  className?: string;
}

/**
 * A phone's feed runs edge to edge: back over the page gutter (`<main>`'s
 * `px-6`) and, on the left, over the rail column too (`TimelineCommit`'s
 * icon `w-5` and `gap-x-2`; the hash is hidden at this width). The caption
 * stays in the column.
 */
const PHONE_BLEED = "-ml-[3.25rem] -mr-6";

const SOURCE = cn(TYPE.labelSm, "flex items-center gap-1.5 min-w-0");
const TITLE = "text-xs leading-4 text-foreground";

/** A recording or a deck: the kinds with a glyph and no blurb. */
const isPlayable = (m: Media) => isVideoMedia(m) || isSlidesMedia(m);

export function AttachmentGrid({ items, set, className }: AttachmentGridProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();
  if (items.length === 0) return null;

  const compact = attachments?.compact ?? false;

  const tileOf = (media: Media, image: string, caption: TileCaption, flush = false) => (
    <AttachmentTile
      media={media}
      image={image}
      size="cell"
      locale={locale}
      label={caption.title || caption.source}
      set={set}
      attachments={attachments}
      mode="act"
      chip={isPlayable(media) ? "mini" : "none"}
      flush={flush}
    />
  );

  /** The caption's first line, with the way out written in when it leaves. */
  const sourceLine = (media: Media, caption: TileCaption) => {
    const { leaves } = tileMark(media, locale, set, attachments);
    return (
      <div className={SOURCE}>
        <span className="truncate">{caption.source}</span>
        {leaves && <MediaMark inline mark={newTabMark(locale)} />}
      </div>
    );
  };

  /** What pressing the caption does: the same door as the tile. */
  const actOf = (media: Media) => {
    const index = set && attachments ? set.items.indexOf(media) : -1;
    return index >= 0 && set && attachments
      ? () => attachments.act(set, index)
      : undefined;
  };

  // ---------------------------------------------------------------------
  // Phone: the stack.
  // ---------------------------------------------------------------------
  if (compact) {
    return (
      <div className={cn("space-y-4", className)}>
        {items.map(({ media, image }, i) => {
          const caption = tileCaption(media, locale);
          // The bleed is on a wrapper rather than the cover: a facade is a
          // `<button>`, which sizes to its content even as a block, so it
          // fills the wrapper (`w-full`) and the wrapper does the reaching.
          const cover: ReactNode = (
            <div className={PHONE_BLEED}>
              {isVideoMedia(media) ? (
                // No `onPlay`: the facade plays here, in the row.
                <Video
                  url={media.url}
                  platform={media.platform}
                  thumbnail={media.thumbnail}
                  chip="mini"
                  className="rounded-none border-0"
                />
              ) : (
                tileOf(media, image, caption, true)
              )}
            </div>
          );
          // A recording's caption is the row above it. A deck names itself;
          // a card says where it goes and what it says.
          const lines = isVideoMedia(media)
            ? null
            : isSlidesMedia(media)
              ? (
                  <div className={cn(SOURCE, TYPE.labelSm)}>
                    <span className="truncate">{caption.source}</span>
                    {caption.title && (
                      <span className={cn("truncate normal-case tracking-normal", TITLE)}>
                        {caption.title}
                      </span>
                    )}
                  </div>
                )
              : (
                  <div className="space-y-0.5">
                    {sourceLine(media, caption)}
                    <div className={cn(TITLE, "font-medium line-clamp-2")}>
                      {caption.title}
                    </div>
                    {caption.description && (
                      <p className={cn(TYPE.captionQuiet, "line-clamp-3")}>
                        {caption.description}
                      </p>
                    )}
                  </div>
                );
          const act = actOf(media);
          return (
            <div key={`${media.url}-${i}`} className="min-w-0">
              {cover}
              {lines && (
                <div
                  className={cn("mt-2 min-w-0", act && "cursor-pointer")}
                  onClick={act}
                >
                  {lines}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Desk: the grid.
  // ---------------------------------------------------------------------
  return (
    <div className={cn("grid grid-cols-2 gap-x-2.5 gap-y-4", className)}>
      {items.map(({ media, image }, i) => {
        const caption = tileCaption(media, locale);
        const tile = tileOf(media, image, caption);
        const lone = i % 2 === 0 && i === items.length - 1;
        const act = actOf(media);

        if (!lone) {
          return (
            <figure key={`${media.url}-${i}`} className="min-w-0">
              {tile}
              <figcaption className="mt-1.5 min-w-0 space-y-0.5">
                {sourceLine(media, caption)}
                <div className={cn(TITLE, "line-clamp-2")}>{caption.title}</div>
                {caption.description && (
                  <p className={cn(TYPE.captionQuiet, "line-clamp-2")}>
                    {caption.description}
                  </p>
                )}
              </figcaption>
            </figure>
          );
        }

        // A lone recording or deck takes the column; a deck names itself
        // under it, a recording is named by the row.
        if (isPlayable(media)) {
          return (
            <figure key={`${media.url}-${i}`} className="col-span-2 min-w-0">
              {tile}
              {isSlidesMedia(media) && caption.title && (
                <figcaption className={cn("mt-1.5", SOURCE)}>
                  <span className="truncate">{caption.source}</span>
                  <span className={cn("truncate normal-case tracking-normal", TITLE)}>
                    {caption.title}
                  </span>
                </figcaption>
              )}
            </figure>
          );
        }

        // A lone card: the caption beside it, with the room to say more.
        return (
          <Fragment key={`${media.url}-${i}`}>
            <div className="min-w-0">{tile}</div>
            <div
              className={cn("min-w-0 self-center space-y-1", act && "cursor-pointer")}
              onClick={act}
            >
              {sourceLine(media, caption)}
              <div className={cn(TITLE, "font-medium line-clamp-2")}>
                {caption.title}
              </div>
              {caption.description && (
                <p className={cn(TYPE.captionQuiet, "line-clamp-4")}>
                  {caption.description}
                </p>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
