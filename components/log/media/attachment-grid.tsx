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
 * column under it. A recording or a deck plays in place, and the bar under
 * it — there from the start, so pressing play moves nothing — names it and
 * offers the stage (`PiP`) for whoever wants to keep scrolling. A card goes
 * straight to its native home (the in-app browser). Nothing here opens the
 * attachment sheet, which would be a drawer opening on what is already on
 * screen.
 */

import { Fragment, useState } from "react";
import { PictureInPicture2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/services";
import { useOptionalAttachments, type AttachmentSet } from "@/systems/attachments";
import type { AttachmentsApi } from "@/systems/attachments";
import { isSlidesMedia, isVideoMedia, type Media } from "@/lib/log";
import { resolveSlidesEmbedUrl } from "@/lib/slides";
import {
  AttachmentTile,
  tileCaption,
  tileMark,
  type TileCaption,
} from "./attachment-tile";
import { MediaMark, newTabMark } from "./media-mark";
import { videoEmbedUrl } from "./video";

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
          if (isPlayable(media)) {
            return (
              <InlinePlayable
                key={`${media.url}-${i}`}
                media={media}
                image={image}
                caption={caption}
                set={set}
                attachments={attachments}
                locale={locale}
              />
            );
          }
          const act = actOf(media);
          return (
            <div key={`${media.url}-${i}`} className="min-w-0">
              <div className={PHONE_BLEED}>{tileOf(media, image, caption, true)}</div>
              <div
                className={cn("mt-2 min-w-0 space-y-0.5", act && "cursor-pointer")}
                onClick={act}
              >
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

/**
 * A recording or a deck in the phone's feed: a 16:9 cover that plays in
 * place when pressed — the platform's player, or the deck itself — and a
 * bar under it that is there before, during and after. The bar names the
 * item (its source, and the deck's title) and carries one control, `PiP`,
 * which hands playback to the stage (`act`: the theater, a PiP on a phone)
 * for whoever wants to keep scrolling; the inline player stops so the two
 * never play at once. Reserving the bar from the start is what keeps the
 * page still when play is pressed.
 */
function InlinePlayable({
  media,
  image,
  caption,
  set,
  attachments,
  locale,
}: {
  media: Media;
  image: string;
  caption: TileCaption;
  set?: AttachmentSet | null;
  attachments: AttachmentsApi | null;
  locale: Locale;
}) {
  const [playing, setPlaying] = useState(false);
  const embed = isVideoMedia(media)
    ? videoEmbedUrl(media.url, media.platform)
    : isSlidesMedia(media)
      ? resolveSlidesEmbedUrl(media.url)
      : null;
  const index = set && attachments ? set.items.indexOf(media) : -1;
  const toStage =
    index >= 0 && set && attachments
      ? () => {
          setPlaying(false);
          attachments.act(set, index);
        }
      : undefined;
  const title = caption.title || caption.source;

  return (
    <div className="min-w-0">
      <div className={PHONE_BLEED}>
        {playing && embed ? (
          <div className="relative aspect-video bg-black">
            <iframe
              src={embed}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : (
          <AttachmentTile
            media={media}
            image={image}
            size="cell"
            locale={locale}
            label={title}
            set={set}
            attachments={attachments}
            mode="act"
            chip="mini"
            flush
            // 16:9 rather than the tiles' 2:1, because the player that
            // replaces it is 16:9 and the swap should move nothing.
            className="aspect-video"
            onPress={embed ? () => setPlaying(true) : undefined}
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className={cn(SOURCE, "min-w-0")}>
          <span className="truncate">{caption.source}</span>
          {isSlidesMedia(media) && caption.title && (
            <span className={cn("truncate normal-case tracking-normal", TITLE)}>
              {caption.title}
            </span>
          )}
        </div>
        {toStage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toStage();
            }}
            aria-label={t(locale, "theaterReturnPip")}
            title={t(locale, "theaterReturnPip")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5",
              "font-mono text-[10px] uppercase tracking-wider leading-none",
              "bg-foreground/[0.06] text-muted-foreground ring-1 ring-border/50 dark:bg-white/[0.08]",
              "transition-colors hover:text-foreground",
            )}
          >
            <PictureInPicture2 className="size-3" strokeWidth={2.25} />
            {t(locale, "theaterSurfacePip")}
          </button>
        )}
      </div>
    </div>
  );
}
