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
 * Three sizes, one per form (lib/log-view.ts, docs/system-attachments.md):
 *
 *  - `thumbs` — `brief`: 56px tall, the glyph chip. A thumbnail beside text.
 *  - `covers` — `covers`: 112px tall, the glyph chip. A cover you can
 *    recognise a slide or a screenshot at.
 *  - `cell`   — `feed`: the width of its grid cell. The feed writes the
 *    caption out, so the chip is the glyph alone on a recording or a deck
 *    (a play mark is an affordance, not information) and nothing on a card.
 *
 * The tile is an anchor even when the attachment system takes the click:
 * ⌘-click, middle-click and "copy link address" keep working, and there is a
 * real destination when no provider is mounted. Which door the click takes
 * is the caller's: `open` (the policy's home — the sheet on a phone) for the
 * folded forms, `act` (the native action — the stage, the page) for the feed,
 * which has already shown everything the sheet would.
 */

import type { MouseEvent } from "react";
import { Play, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { t, type Locale } from "@/lib/i18n";
import { getDomainLabel } from "@/lib/og-core";
import {
  getMediaThumbnail,
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
  isVideoMedia,
  VIDEO_PLATFORM_LABEL,
  type Media,
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

export type AttachmentTileSize = "thumbs" | "covers" | "cell";

const TILE_SIZE: Record<AttachmentTileSize, { box: string; chip: MediaMarkSize }> = {
  thumbs: { box: "h-14", chip: "mini" },
  covers: { box: "h-28", chip: "mini" },
  cell: { box: "w-full", chip: "compact" },
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
  /**
   * What pressing it does, for a kind with no blurb — the same word the
   * attachment page's primary button wears (`Watch`, `Slides`), so the row
   * and the sheet name the act the same way.
   */
  action?: MediaMarkSpec;
}

/**
 * The caption for one piece of media, in the viewer's locale. The strips
 * print none of it (the chip is enough at that size); the feed prints it.
 */
export function tileCaption(media: Media, locale: Locale): TileCaption {
  if (isVideoMedia(media)) {
    return {
      source: VIDEO_PLATFORM_LABEL[media.platform],
      title: t(locale, "logRecording"),
      action: { icon: Play, label: t(locale, "logWatch"), fill: true },
    };
  }
  if (isSlidesMedia(media)) {
    return {
      source: t(locale, "logSlides"),
      title: media.title || "",
      action: { icon: Presentation, label: t(locale, "logSlides") },
    };
  }
  if (isLinkMedia(media)) {
    const preview = media.previews?.[locale] ?? media.preview;
    return {
      source: media.internal ? "/writing" : getDomainLabel(media.url),
      title: preview?.title || getDomainLabel(media.url),
      description: preview?.description,
    };
  }
  return {
    source: getDomainLabel(media.url),
    title: isImageMedia(media) ? media.alt || "" : "",
  };
}

/** The cover for one piece of media, in the viewer's locale; null when it
 *  has none (a pill, a live embed), in which case it is not a tile. */
export function tileImage(media: Media, locale: Locale): string | null {
  if (isLinkMedia(media)) {
    return media.present === "card"
      ? ((media.previews?.[locale] ?? media.preview)?.image ?? null)
      : null;
  }
  // A video's cover may be derived (YouTube's, from the id) rather than
  // authored; a deck's and a still's are what `getMediaThumbnail` says.
  if (isVideoMedia(media) || isSlidesMedia(media) || isImageMedia(media)) {
    return getMediaThumbnail(media);
  }
  return null;
}

/**
 * Where a tile's click will land, and the chip that says so: a page that
 * refuses to be framed opens a tab, and the tile says `New tab` before the
 * click rather than after.
 */
export function tileMark(
  media: Media,
  locale: Locale,
  set: AttachmentSet | null | undefined,
  attachments: AttachmentsApi | null | undefined,
): { mark: MediaMarkSpec | null; leaves: boolean } {
  const index = set && attachments ? set.items.indexOf(media) : -1;
  const leaves =
    index >= 0 && set && attachments
      ? attachments.homeOf(set, index) === "tab"
      : false;
  return { mark: leaves ? newTabMark(locale) : markFor(media, locale), leaves };
}

export interface AttachmentTileProps {
  media: Media;
  image: string;
  size: AttachmentTileSize;
  locale: Locale;
  /** The tile's tooltip and accessible name. */
  label: string;
  /**
   * The set this media belongs to and the provider that opens it. With both,
   * the click goes through the system; without, the anchor navigates.
   */
  set?: AttachmentSet | null;
  attachments?: AttachmentsApi | null;
  /** Which door the click takes — see the note above. Default `open`. */
  mode?: "open" | "act";
  /** The chip, overriding the size's: `none` for a card in the feed. */
  chip?: MediaMarkSize | "none";
  /** Square the corners — a phone's edge-to-edge feed. */
  flush?: boolean;
  className?: string;
}

export function AttachmentTile({
  media,
  image,
  size,
  locale,
  label,
  set,
  attachments,
  mode = "open",
  chip,
  flush = false,
  className,
}: AttachmentTileProps) {
  const stop = TILE_SIZE[size];
  const { mark, leaves } = tileMark(media, locale, set, attachments);
  const index = set && attachments ? set.items.indexOf(media) : -1;
  const chipSize = chip ?? stop.chip;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // A click on a cover is the cover's business: without this the row would
    // fold underneath you as you left for the video.
    e.stopPropagation();
    // Modified clicks belong to the browser — never hijack them.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (index < 0 || !set || !attachments) return;
    e.preventDefault();
    if (mode === "act") attachments.act(set, index);
    else attachments.open(set, index);
  };

  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      title={leaves ? `${label} · ${t(locale, "linkOpensInTab")}` : label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative block aspect-[2/1] shrink-0 overflow-hidden",
        "bg-muted/30 transition-colors duration-200",
        flush
          ? "rounded-none"
          : "rounded-md border border-border/50 hover:border-border focus-visible:border-border",
        stop.box,
        className,
      )}
    >
      <ExternalImage
        src={image}
        alt=""
        className="block h-full w-full object-cover"
      />
      {chipSize !== "none" && <MediaMark mark={mark} size={chipSize} />}
    </a>
  );
}
