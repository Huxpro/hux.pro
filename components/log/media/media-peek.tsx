"use client";

import { PEEK_W } from "@/components/motion-primitives/magnetic-preview";
import { GLASS_PANEL } from "@/lib/glass";
import type { Locale } from "@/lib/i18n";
import {
  getMediaThumbnail,
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
  isVideoMedia,
  type Media,
  type PeekItem,
} from "@/lib/log";
import { isVideoLinkHost } from "@/lib/og-core";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { Presentation } from "lucide-react";
import type { ReactNode } from "react";
import { ExternalImage } from "./external-image";
import { CardFace } from "./link";
import { markFor, MediaMark, type MediaMarkSpec } from "./media-mark";

// =============================================================================
// Media peeks — what a cover shows when the pointer rests on it.
//
// /works has one hover system, the magnetic peek that follows the cursor off
// a folded row (commit-embed.tsx builds the row's). At the `stat` density the
// row prints its covers, so the row itself no longer peeks — but each cover
// can, and does: rest on a thumbnail in the contact strip and the same peek
// vocabulary shows what it is at a readable size. A link card peeks as the
// mini OG card (domain, title, description); a video, a deck or an image
// peeks as its poster with a caption saying what pressing it does.
//
// `PeekThumb` and `PeekCard` are the two primitives the row's stacked deck is
// built from too; they live here so the strip and the deck cannot drift.
// =============================================================================

// Peek items render as `<div>` (never `<a>`) so they can sit inside the
// row's own clickable wrapper without producing nested anchors.

/** Bare cover image inside a soft card frame, wearing its chip. */
export function PeekThumb({
  image,
  mark,
  className,
  onResolved,
}: {
  image: string;
  /** The chip (media-mark.tsx); a peek is the after-hover state, so raised. */
  mark?: MediaMarkSpec | null;
  className?: string;
  onResolved?: () => void;
}) {
  return (
    <div
      className={cn(
        // Border matches the card peek / panel (border/50). Shadow is
        // supplied per-use: the single video peek and the deck's front layer
        // add `shadow-raised`; deck back layers stay flat.
        "relative rounded-lg overflow-hidden border border-border/50 bg-muted/30",
        className,
      )}
    >
      {/* object-cover is safe for thumbnails: YouTube / Bilibili / Vimeo all
          serve 16:9 covers, matching the aspect-video container. */}
      <ExternalImage
        src={image}
        className="block w-full h-full object-cover"
        loading="eager"
        onResolved={onResolved}
      />
      <MediaMark mark={mark} raised />
    </div>
  );
}

/**
 * Mini OG-style card for `kind:"link", present:"card"` media — a thin
 * adapter over `CardFace` that picks the right slot shape per context:
 *  - Single-item peek: natural aspect (matches the expanded `/works`
 *    LinkCard so the hover and the row read as the same artifact).
 *  - Stacked peek:     fixed `aspect-[2/1]` + blur backdrop, because the
 *    layered `translate/rotate/scale` transforms need predictable
 *    rectangles to overlap cleanly.
 *
 * Rendering as a `<div>` (CardFace's default element) means it can sit
 * inside the row's clickable wrapper without nested anchors.
 */
export function PeekCard({
  item,
  fixedAspect = false,
  mark,
  className,
  onResolved,
}: {
  item: Extract<PeekItem, { kind: "card" }>;
  fixedAspect?: boolean;
  /** The chip on the cover — see CardFace. */
  mark?: MediaMarkSpec | null;
  className?: string;
  onResolved?: () => void;
}) {
  // Peek is purely visual — the click goes through the row's anchor — so
  // we only need the caption swap, not the locale-aware URL pick.
  const domainLabel = item.internal ? "/writing" : undefined;
  return (
    <CardFace
      url={item.url}
      title={item.title}
      description={item.description}
      image={item.image}
      size="compact"
      fixedAspect={fixedAspect}
      // Single-item peek honors the author's cover-fit; the stacked deck sets
      // `fixedAspect` above, which takes precedence (predictable rectangles).
      fit={item.fit}
      aspect={item.aspect}
      domainLabel={domainLabel}
      mark={mark}
      raisedMark
      // Peek-specific chrome — the shared panel recipe, minus the shadow: the
      // single-peek and stacked-peek branches strip the panel's own chrome
      // (BARE_PANEL_CHROME), so callers add `shadow-raised` per use (front /
      // single) and deck back layers stay flat — same opt-in convention as
      // PeekThumb.
      className={cn(GLASS_PANEL, className)}
      onImgResolved={onResolved}
    />
  );
}


/** A poster wearing its chip, and a caption when there is a name to print. */
function PeekPoster({
  image,
  caption,
  mark,
}: {
  image: string | null;
  caption?: ReactNode;
  /** The cover's chip (media-mark.tsx), the same one the row's cover wears. */
  mark: MediaMarkSpec | null;
}) {
  return (
    <div className={cn(PEEK_W, GLASS_PANEL, "overflow-hidden shadow-raised")}>
      <div className="relative aspect-video bg-muted/30">
        {image ? (
          <ExternalImage
            src={image}
            className="block h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center">
            <Presentation className="h-8 w-8 text-quaternary-foreground" />
          </span>
        )}
        <MediaMark mark={mark} raised />
      </div>
      {caption && (
        <div className={cn("flex items-center gap-1.5 px-3 py-2", TYPE.labelSm)}>
          {caption}
        </div>
      )}
    </div>
  );
}

export interface MediaPeekSpec {
  node: ReactNode;
  /** Merged into the cursor-preview panel — see MagneticPreview. */
  panelClassName: string;
}

/** The peek panel stripped bare, so the card or poster is the surface. */
const BARE = "p-0 bg-transparent border-transparent backdrop-blur-none";

/**
 * The peek for one piece of media, or null when it has nothing to show. The
 * peek is a glance, so its cover wears a chip whatever its kind
 * (media-mark.tsx, `all`); `leaves` says the click will open a tab — a page
 * that refuses to be framed — and the chip says so before the click rather
 * than after.
 */
export function mediaPeek(
  media: Media,
  locale: Locale,
  opts: { leaves?: boolean } = {},
): MediaPeekSpec | null {
  const mark = markFor(media, locale, { all: true, leaves: opts.leaves });
  if (isLinkMedia(media)) {
    const preview = media.previews?.[locale] ?? media.preview;
    const item: Extract<PeekItem, { kind: "card" }> = {
      kind: "card",
      url: media.url,
      title: preview?.title,
      description: preview?.description,
      image: preview?.image ?? "",
      internal: media.internal,
      fit: preview?.fit,
      aspect: preview?.aspect,
      media,
    };
    return {
      panelClassName: BARE,
      node: (
        <PeekCard
          item={item}
          mark={mark}
          className={cn(PEEK_W, "shadow-raised")}
        />
      ),
    };
  }

  const image = getMediaThumbnail(media);

  if (isVideoMedia(media)) {
    return {
      panelClassName: BARE,
      node: (
        <PeekPoster image={image} mark={mark} />
      ),
    };
  }

  if (isSlidesMedia(media)) {
    return {
      panelClassName: BARE,
      node: (
        <PeekPoster image={image} mark={mark} />
      ),
    };
  }

  if (isImageMedia(media)) {
    return {
      panelClassName: BARE,
      node: (
        <PeekPoster
          image={media.url}
          mark={mark}
          caption={
            media.alt && (
              <span className="truncate normal-case tracking-normal">
                {media.alt}
              </span>
            )
          }
        />
      ),
    };
  }

  return null;
}

/** Whether a link card's cover reads as a recording (a GitNation page). */
export function isRecordingLink(media: Media): boolean {
  return isLinkMedia(media) && isVideoLinkHost(media.url);
}
