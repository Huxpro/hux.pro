"use client";

/**
 * AttachmentTile — one cover in a commit's attachment object.
 *
 * Every cover on /works is this: a 2:1 crop of the artwork wearing its chip,
 * and nothing else on it. 2:1 because it is the aspect the covers already
 * come in — an OG image is 1.91:1, and a 16:9 video poster loses a sliver
 * top and bottom, which the hover peek and the surface show whole. One aspect
 * for every kind is what lets a row of them line up, and what lets a video
 * sit beside a card without one towering over the other.
 *
 * Two sizes, one per form (lib/log-view.ts, docs/system-attachments.md):
 *
 *  - `covers` — `covers`: 112px tall, the glyph chip. A cover you can
 *    recognise a slide or a screenshot at; two of them and the handle fill
 *    the column, which is how the height was chosen.
 *  - `cell`   — `feed`: the width of its grid cell. The feed writes the
 *    caption out, so the chip is the glyph alone on a recording or a deck
 *    (a play mark is an affordance, not information) and nothing on a card.
 *
 * A tile is drawn from a `TileSlot`: everything the strip or the grid needs
 * to know about one item — its place in the set, where its click lands, its
 * chip, its caption — resolved once per item by the caller (`resolveTile`)
 * rather than once per tile per render. The tile does no lookups of its own.
 *
 * The tile is an anchor even when the attachment system takes the click:
 * ⌘-click, middle-click and "copy link address" keep working, and there is a
 * real destination when no provider is mounted. Which door the click takes
 * is the caller's: `open` (the policy's home — the sheet on a phone) for the
 * folded form, `act` (the native action — the stage, the page) for the feed,
 * which has already shown everything the sheet would.
 *
 * In the feed the caption is the rest of the same control, not a second
 * click target that happens to do the same thing. Pass it as `footer` and
 * the cover wash, the copy wash, the cursor and the door all belong to
 * one `<a>` — a press on the title dims the artwork *and* the title, the
 * way a chat unfurl does. Folding a commit is a different press: a muted
 * fill on the row, never this dim.
 */

import type { MouseEvent, ReactNode } from "react";
import { COVER_WASH, COPY_WASH } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { getDomainLabel, isGithubSocialImage } from "@/lib/og-core";
import {
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
  isVideoMedia,
  VIDEO_PLATFORM_LABEL,
  type Media,
  type StripItem,
} from "@/lib/log";
import type { AttachmentSet, AttachmentsApi } from "@/systems/attachments";
import { ExternalImage } from "./external-image";
import {
  markFor,
  MediaMark,
  newTabMark,
  type MediaMarkSize,
  type MediaMarkSpec,
} from "./media-mark";

type AttachmentTileSize = "covers" | "cell";

const TILE_SIZE: Record<AttachmentTileSize, string> = {
  covers: "h-28",
  cell: "w-full",
};

/** What a tile says under (or beside) itself, when the form prints it. */
export interface TileCaption {
  /** Where it is from: the platform, the domain, `Slides`. */
  source: string;
  /** What it is: the page's title, the deck's; a recording has none but
   *  the word. Always a string, so a caption always has its first two lines. */
  title: string;
  /** A page's blurb. */
  description?: string;
  /** The tile's one name — its tooltip and accessible name. */
  label: string;
}

/**
 * The caption for one piece of media, in the viewer's locale. The strip
 * prints none of it (the chip is enough at that size); the feed prints it;
 * both name the tile by it.
 */
export function tileCaption(media: Media, locale: Locale): TileCaption {
  const named = (source: string, title: string, description?: string) => ({
    source,
    title,
    description,
    label: title || source,
  });
  if (isVideoMedia(media)) {
    return named(VIDEO_PLATFORM_LABEL[media.platform], t(locale, "logRecording"));
  }
  if (isSlidesMedia(media)) {
    return named(t(locale, "logSlides"), media.title || "");
  }
  if (isLinkMedia(media)) {
    const preview = media.previews?.[locale] ?? media.preview;
    const domain = getDomainLabel(media.url);
    // GitHub's social image already is the repo card. Keep the domain (and
    // the accessible name); drop the title and blurb so the caption does
    // not reprint what the cover says.
    if (isGithubSocialImage(preview?.image)) {
      return {
        source: media.internal ? "/writing" : domain,
        title: "",
        description: undefined,
        label: preview?.title || domain,
      };
    }
    return named(
      media.internal ? "/writing" : domain,
      preview?.title || domain,
      preview?.description,
    );
  }
  return named(getDomainLabel(media.url), isImageMedia(media) ? media.alt || "" : "");
}

/** Everything a tile needs, resolved once per item — see the note above. */
export interface TileSlot {
  media: Media;
  image: string;
  /** Its place in the set, or -1 when there is no set or provider. */
  index: number;
  /** The click will open a tab — a page that refuses to be framed. */
  leaves: boolean;
  /** The chip the cover wears: `New tab` when it leaves, else its kind's. */
  mark: MediaMarkSpec | null;
  caption: TileCaption;
}

export function resolveTile(
  item: StripItem,
  locale: Locale,
  set: AttachmentSet | null | undefined,
  attachments: AttachmentsApi | null | undefined,
): TileSlot {
  const index = set && attachments ? set.items.indexOf(item.media) : -1;
  const leaves =
    index >= 0 && set && attachments
      ? attachments.homeOf(set, index) === "tab"
      : false;
  return {
    media: item.media,
    image: item.image,
    index,
    leaves,
    mark: leaves ? newTabMark(locale) : markFor(item.media, locale),
    caption: tileCaption(item.media, locale),
  };
}

export interface AttachmentTileProps {
  slot: TileSlot;
  size: AttachmentTileSize;
  locale: Locale;
  set?: AttachmentSet | null;
  attachments?: AttachmentsApi | null;
  /** Which door the click takes — see the note above. Default `open`. */
  mode?: "open" | "act";
  /** Take the click instead of either door — the feed's inline player. */
  onPress?: () => void;
  /** The chip: the glyph by default; `none` for a card in the feed. */
  chip?: MediaMarkSize | "none";
  /** Square the corners — a phone's edge-to-edge feed. */
  flush?: boolean;
  /**
   * Copy under or beside the cover. Mounted inside the same `<a>`, so the
   * caption is the cover's label, not a sibling that also happens to open
   * the attachment. The cover box keeps the crop; this sits outside it.
   */
  footer?: ReactNode;
  /**
   * Wrapper around the crop — the phone feed's edge-to-edge bleed. It is a
   * wrapper, not a class on the crop: the crop is `w-full overflow-hidden`,
   * and negative margins on that box only shift a column-width picture.
   * Width auto plus the bleed is what actually runs to the screen's edge;
   * the caption stays in the column because it is a sibling, not a child
   * of this wrapper.
   */
  imageClassName?: string;
  className?: string;
}

export function AttachmentTile({
  slot,
  size,
  locale,
  set,
  attachments,
  mode = "open",
  onPress,
  chip = "mini",
  flush = false,
  footer,
  imageClassName,
  className,
}: AttachmentTileProps) {
  const { media, image, index, leaves, mark, caption } = slot;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // A click on a cover is the cover's business: without this the row would
    // fold underneath you as you left for the video.
    e.stopPropagation();
    // Modified clicks belong to the browser — never hijack them.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (onPress) {
      e.preventDefault();
      onPress();
      return;
    }
    if (index < 0 || !set || !attachments) return;
    e.preventDefault();
    if (mode === "act") attachments.act(set, index);
    else attachments.open(set, index);
  };

  const coverClassName = cn(
    "relative block aspect-[2/1] shrink-0 overflow-hidden",
    "bg-muted/30 transition-colors duration-200",
    flush
      ? "rounded-none"
      : "rounded-md border border-border/50 group-hover/thumb:border-border group-focus-visible/thumb:border-border",
    TILE_SIZE[size],
    !footer && !imageClassName && className,
  );

  const cover = (
    <>
      <ExternalImage
        src={image}
        alt=""
        className="block h-full w-full object-cover"
      />
      <span className={COVER_WASH} />
      {chip !== "none" && <MediaMark mark={mark} size={chip} />}
    </>
  );

  const crop =
    footer || imageClassName ? (
      <span className={coverClassName}>{cover}</span>
    ) : (
      cover
    );

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      title={leaves ? `${caption.label} · ${t(locale, "linkOpensInTab")}` : caption.label}
      aria-label={caption.label}
      onClick={onClick}
      className={cn(
        "group/thumb pressable",
        footer || imageClassName
          ? cn("block min-w-0", className)
          : coverClassName,
      )}
    >
      {imageClassName ? <span className={cn("block", imageClassName)}>{crop}</span> : crop}
      {footer ? <span className={COPY_WASH}>{footer}</span> : null}
    </a>
  );
}
