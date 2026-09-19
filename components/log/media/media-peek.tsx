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
import { getDomainLabel, isVideoLinkHost } from "@/lib/og-core";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { Presentation } from "lucide-react";
import type { ReactNode } from "react";
import { ExternalImage } from "./external-image";
import { CardFace } from "./link";
import { MediaMark, type MediaKind } from "./media-mark";

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

/** Bare cover image inside a soft card frame. Used for video / image media. */
export function PeekThumb({
  image,
  className,
  onResolved,
}: {
  image: string;
  className?: string;
  onResolved?: () => void;
}) {
  return (
    <div
      className={cn(
        // Border matches the card peek / panel (border/50). Shadow is
        // supplied per-use: the single video peek and the deck's front layer
        // add `shadow-raised`; deck back layers stay flat.
        "rounded-lg overflow-hidden border border-border/50 bg-muted/30",
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
  note,
  className,
  onResolved,
}: {
  item: Extract<PeekItem, { kind: "card" }>;
  fixedAspect?: boolean;
  /** A last line under the text — where the click will go, when it leaves. */
  note?: ReactNode;
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
      note={note}
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


/** A poster with a caption strip — a cover that says what it is. */
function PeekPoster({
  image,
  caption,
  kind,
}: {
  image: string | null;
  caption: ReactNode;
  /** The cover's mark (media-mark.tsx), the same one the row's cover wears. */
  kind?: MediaKind;
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
        {kind && <MediaMark kind={kind} tone="glass" />}
      </div>
      <div className={cn("flex items-center gap-1.5 px-3 py-2", TYPE.labelSm)}>
        {caption}
      </div>
    </div>
  );
}

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  bilibili: "bilibili",
  vimeo: "Vimeo",
};

export interface MediaPeekSpec {
  node: ReactNode;
  /** Merged into the cursor-preview panel — see MagneticPreview. */
  panelClassName: string;
}

/** The peek panel stripped bare, so the card or poster is the surface. */
const BARE = "p-0 bg-transparent border-transparent backdrop-blur-none";

/**
 * The peek for one piece of media, or null when it has nothing to show. The
 * `note` is a line the caller adds when the click will leave the site — a
 * page that refuses to be framed opens in a tab, and the peek says so
 * before the click rather than after.
 */
export function mediaPeek(
  media: Media,
  locale: Locale,
  opts: { note?: ReactNode } = {},
): MediaPeekSpec | null {
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
    };
    return {
      panelClassName: BARE,
      node: (
        <PeekCard
          item={item}
          note={opts.note}
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
        <PeekPoster
          image={image}
          kind="video"
          caption={
            <>
              <span>{PLATFORM_LABEL[media.platform] ?? media.platform}</span>
              <span className="text-quaternary-foreground">·</span>
              <span>{t(locale, "logWatch")}</span>
            </>
          }
        />
      ),
    };
  }

  if (isSlidesMedia(media)) {
    return {
      panelClassName: BARE,
      node: (
        <PeekPoster
          image={image}
          kind="slides"
          caption={
            <>
              <Presentation className="h-3 w-3" />
              <span>{t(locale, "logSlides")}</span>
              {media.title && (
                <>
                  <span className="text-quaternary-foreground">·</span>
                  <span className="truncate normal-case tracking-normal">
                    {media.title}
                  </span>
                </>
              )}
            </>
          }
        />
      ),
    };
  }

  if (isImageMedia(media)) {
    return {
      panelClassName: BARE,
      node: (
        <PeekPoster
          image={media.url}
          caption={
            <span className="truncate normal-case tracking-normal">
              {media.alt || getDomainLabel(media.url)}
            </span>
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
