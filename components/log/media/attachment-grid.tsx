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
 *   └────────┘ └────────┘      Cover and caption are one control: the same
 *    SOURCE      SOURCE        `<a>`, so hovering the title washes the art.
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

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { PictureInPicture2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TYPE } from "@/lib/typography";
import { t, type Locale } from "@/lib/i18n";
import { useLocale } from "@/services";
import {
  useOptionalAttachments,
  type AttachmentSet,
  type AttachmentsApi,
} from "@/systems/attachments";
import { mediaToTrack, useOptionalTheaterStage } from "@/systems/theater";
import { isSlidesMedia, isVideoMedia, type StripItem } from "@/lib/log";
import { resolveSlidesEmbedUrl } from "@/lib/slides";
import { AttachmentTile, resolveTile, type TileSlot } from "./attachment-tile";
import { MediaMark, newTabMark, SURFACE_CHIP } from "./media-mark";
import { videoEmbedUrl } from "./video";

export interface AttachmentGridProps {
  /** Tiles, in authored order — the row's own strip items. */
  items: StripItem[];
  set?: AttachmentSet | null;
  className?: string;
}

/**
 * A phone's feed runs edge to edge: back over the page gutter and, on the
 * left, over the rail column too (`TimelineCommit`'s icon `w-5` and
 * `gap-x-2`; the hash is hidden at this width). The caption stays in the
 * column.
 */
const PHONE_BLEED =
  "-ml-[calc(var(--page-gutter)+1.75rem)] -mr-[var(--page-gutter)]";

const SOURCE = cn(
  TYPE.labelSm,
  "flex items-center gap-1.5 min-w-0 transition-colors duration-200",
  "group-hover/thumb:text-muted-foreground",
);
const TITLE = "text-xs leading-4 text-foreground";

/** The caption's first line, with the way out written in when it leaves. */
function SourceLine({ slot, locale }: { slot: TileSlot; locale: Locale }) {
  return (
    <div className={SOURCE}>
      <span className="min-w-0 truncate">{slot.caption.source}</span>
      {slot.leaves && <MediaMark inline mark={newTabMark(locale)} />}
    </div>
  );
}

/** Source, title, blurb — the caption in its three places.
 *
 *  Always a child of the tile's `<a>` (`footer`), never its own click
 *  target. Hovering the copy is hovering the cover: the source and blurb
 *  rise a tier and the artwork washes, so the unit reads as one door.
 */
function Caption({
  slot,
  locale,
  lines,
  strong = false,
  className,
}: {
  slot: TileSlot;
  locale: Locale;
  /** How many lines the blurb may take. */
  lines: 2 | 3 | 4;
  strong?: boolean;
  className?: string;
}) {
  const { caption } = slot;
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <SourceLine slot={slot} locale={locale} />
      {caption.title ? (
        <div className={cn(TITLE, "line-clamp-2", strong && "font-medium")}>
          {caption.title}
        </div>
      ) : null}
      {caption.description && (
        <p
          className={cn(
            TYPE.captionQuiet,
            "transition-colors duration-200 group-hover/thumb:text-muted-foreground",
            lines === 2 ? "line-clamp-2" : lines === 3 ? "line-clamp-3" : "line-clamp-4",
          )}
        >
          {caption.description}
        </p>
      )}
    </div>
  );
}

/** A recording's or a deck's one line: the source, and a deck's title. */
function PlayableLine({ slot, className }: { slot: TileSlot; className?: string }) {
  const { media, caption } = slot;
  return (
    <div className={cn(SOURCE, className)}>
      <span className="shrink-0">{caption.source}</span>
      {isSlidesMedia(media) && caption.title && (
        <span className={cn("min-w-0 truncate normal-case tracking-normal", TITLE)}>
          {caption.title}
        </span>
      )}
    </div>
  );
}

export function AttachmentGrid({ items, set, className }: AttachmentGridProps) {
  const attachments = useOptionalAttachments();
  const { locale } = useLocale();
  // Once per item, not once per tile per render: the set lookup, the policy
  // question, the chip and the caption.
  const slots = useMemo(
    () => items.map((item) => resolveTile(item, locale, set, attachments)),
    [items, locale, set, attachments],
  );
  if (slots.length === 0) return null;

  const compact = attachments?.compact ?? false;

  const tileOf = (
    slot: TileSlot,
    extra?: {
      flush?: boolean;
      footer?: ReactNode;
      className?: string;
      imageClassName?: string;
    },
  ) => (
    <AttachmentTile
      slot={slot}
      size="cell"
      locale={locale}
      set={set}
      attachments={attachments}
      mode="act"
      // The glyph on what plays — a recording, a deck, a talks-host card —
      // and nothing on a page: the caption has said what it is.
      chip={slot.mark ? "mini" : "none"}
      flush={extra?.flush}
      footer={extra?.footer}
      className={extra?.className}
      imageClassName={extra?.imageClassName}
    />
  );

  // ---------------------------------------------------------------------
  // Phone: the stack.
  // ---------------------------------------------------------------------
  if (compact) {
    return (
      <div className={cn("space-y-4", className)}>
        {slots.map((slot, i) =>
          isVideoMedia(slot.media) || isSlidesMedia(slot.media) ? (
            <InlinePlayable
              key={`${slot.media.url}-${i}`}
              slot={slot}
              set={set}
              attachments={attachments}
              locale={locale}
            />
          ) : (
            <div key={`${slot.media.url}-${i}`} className="min-w-0">
              {tileOf(slot, {
                flush: true,
                imageClassName: PHONE_BLEED,
                footer: (
                  <Caption
                    slot={slot}
                    locale={locale}
                    lines={3}
                    strong
                    className="mt-2"
                  />
                ),
              })}
            </div>
          ),
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Desk: the grid.
  // ---------------------------------------------------------------------
  return (
    <div className={cn("grid grid-cols-2 gap-x-2.5 gap-y-4", className)}>
      {slots.map((slot, i) => {
        const { media } = slot;
        const lone = i % 2 === 0 && i === slots.length - 1;

        if (!lone) {
          return (
            <div key={`${media.url}-${i}`} className="min-w-0">
              {tileOf(slot, {
                footer: (
                  <Caption
                    slot={slot}
                    locale={locale}
                    lines={2}
                    className="mt-1.5"
                  />
                ),
              })}
            </div>
          );
        }

        // A lone recording or deck takes the column; a deck names itself
        // under it, a recording is named by the row.
        if (isVideoMedia(media) || isSlidesMedia(media)) {
          return (
            <div key={`${media.url}-${i}`} className="col-span-2 min-w-0">
              {tileOf(slot, {
                footer:
                  isSlidesMedia(media) && slot.caption.title ? (
                    <PlayableLine slot={slot} className="mt-1.5" />
                  ) : undefined,
              })}
            </div>
          );
        }

        // A lone card: the caption beside it, with the room to say more.
        return (
          <Fragment key={`${media.url}-${i}`}>
            {tileOf(slot, {
              className: "col-span-2 grid grid-cols-2 gap-x-2.5 items-center",
              footer: (
                <Caption
                  slot={slot}
                  locale={locale}
                  lines={4}
                  strong
                  className="self-center space-y-1"
                />
              ),
            })}
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
 *
 * While the item is on the stage, its place here says so — a dark wash and
 * the PiP mark over the cover, the way a music app marks the track that is
 * playing elsewhere — and pressing it brings playback back: the stage
 * closes and the player mounts here again.
 */
function InlinePlayable({
  slot,
  set,
  attachments,
  locale,
}: {
  slot: TileSlot;
  set?: AttachmentSet | null;
  attachments: AttachmentsApi | null;
  locale: Locale;
}) {
  const { media, caption, index } = slot;
  const [playing, setPlaying] = useState(false);
  const embed = isVideoMedia(media)
    ? videoEmbedUrl(media.url, media.platform)
    : isSlidesMedia(media)
      ? resolveSlidesEmbedUrl(media.url)
      : null;
  // Is this item the one on the stage? Asked of the track the theater would
  // build for it, so the grid never learns how a track's URL is made.
  const stage = useOptionalTheaterStage();
  const onStage =
    !!stage &&
    stage.mode !== "closed" &&
    !!stage.track &&
    stage.track.url === mediaToTrack(media, { id: media.url, title: caption.label })?.url;
  const toStage =
    index >= 0 && set && attachments
      ? () => {
          setPlaying(false);
          attachments.act(set, index);
        }
      : undefined;

  let cover: ReactNode;
  if (playing && embed && !onStage) {
    cover = (
      <div className="relative aspect-video bg-black">
        <iframe
          src={embed}
          title={caption.label}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  } else {
    cover = (
      <AttachmentTile
        slot={slot}
        size="cell"
        locale={locale}
        set={set}
        attachments={attachments}
        mode="act"
        flush
        // 16:9 rather than the tiles' 2:1, because the player that
        // replaces it is 16:9 and the swap should move nothing.
        className="aspect-video"
        onPress={embed ? () => setPlaying(true) : undefined}
      />
    );
  }

  return (
    <div className="min-w-0">
      <div className={cn(PHONE_BLEED, "relative")}>
        {cover}
        {onStage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              stage.close();
              setPlaying(true);
            }}
            aria-label={t(locale, "theaterReturnPip")}
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/55 text-white/90"
          >
            <PictureInPicture2 className="size-6" strokeWidth={1.75} />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {t(locale, "theaterSurfacePip")}
            </span>
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <PlayableLine slot={slot} className="min-w-0 flex-1" />
        {toStage && !onStage && (
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
              SURFACE_CHIP,
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
