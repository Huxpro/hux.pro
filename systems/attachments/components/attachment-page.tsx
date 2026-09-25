"use client";

import { ExternalImage } from "@/components/log/media/external-image";
import { SocialEmbed } from "@/components/log/media/embed";
import { mediaKindOf } from "@/components/log/media/media-mark";
import { PeekCover } from "@/components/log/media/peek-cover";
import { COVER_WASH } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import {
  getMediaThumbnail,
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
  isSocialEmbedMedia,
  isVideoMedia,
  type AttachmentOrigin,
} from "@/lib/log";
import { getDomainLabel } from "@/lib/og-core";
import { TYPE } from "@/lib/typography";
import {
  GLASS_ACTION,
  GLASS_CLUSTER,
  GLASS_PILL,
} from "@/systems/theater/lib/chrome";
import {
  ArrowUpRight,
  BookOpen,
  Globe,
  Image as ImageIcon,
  Play,
  Presentation,
  ZoomIn,
} from "lucide-react";
import type { ReactNode } from "react";
import { isInternalLink, linkTarget } from "../lib/policy";
import type { AttachmentHome, AttachmentSet } from "../lib/types";
import { useAttachments } from "../provider";

// =============================================================================
// AttachmentPage — one attachment, at full width, with its native action.
//
// A page is the attachment shown large — the cover of a video or a deck, the
// whole of a link card, an image, a live social widget — over a title line
// and a row of actions. The first action is the thing itself (`Watch`,
// `Slides`, `Read`, `Visit`): the provider's `act`, which sends the item to
// its native home from wherever the surface is standing. The second is the
// way out to the source, always a real link.
//
// Chrome is the theater's (lib/chrome.ts): a frosted cluster holding mono
// uppercase actions, the primary one lifted on the glass pill, the same
// material the PiP bar and the Live Activity wear. The surface and the stage
// are one system, and their controls should say so.
//
// The cover wears no chip here (media-mark.tsx): the page prints the domain,
// the title and a labelled button, and the button's glyph already says what
// the item is and where it goes — a chip on the cover would repeat it.
// The button's glyph is what the item is: a play mark, the deck glyph, a
// globe for the in-app browser, a book for a post, the arrow out for a tab.
// =============================================================================

interface AttachmentPageProps {
  set: AttachmentSet;
  index: number;
}

/** A cover the page action opens — a stage-shaped 16:9 box. */
function Cover({
  image,
  label,
  onOpen,
}: {
  image: string | null;
  label: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className={cn(
        "group/thumb relative block w-full aspect-video overflow-hidden rounded-xl",
        "border border-border/50 bg-muted/20 text-left",
        "pressable outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
      )}
    >
      {image ? (
        <ExternalImage
          src={image}
          alt=""
          loading="eager"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center">
          <Presentation className="h-10 w-10 text-tertiary-foreground" />
        </span>
      )}
      <span className={COVER_WASH} />
    </button>
  );
}

/** The glyph on the primary action: what the item is, and where it goes. */
function homeIcon(home: AttachmentHome, kind: ReturnType<typeof mediaKindOf>): ReactNode {
  if (kind === "slides") return <Presentation className="h-3.5 w-3.5" />;
  if (kind === "video") {
    return <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />;
  }
  if (home === "lightbox") return <ZoomIn className="h-3.5 w-3.5" />;
  if (home === "route") return <BookOpen className="h-3.5 w-3.5" />;
  if (home === "window") return <Globe className="h-3.5 w-3.5" />;
  return <ArrowUpRight className="h-3.5 w-3.5" />;
}

/** The action row: the primary action on the pill, the way out beside it. */
function Actions({
  primary,
  href,
  hrefLabel,
}: {
  primary: { label: string; icon: ReactNode; onSelect: () => void };
  /** The attachment's own address — a real link, for the browser's gestures. */
  href: string;
  hrefLabel: string;
}) {
  return (
    <div className={cn(GLASS_CLUSTER, "system-chrome")}>
      <button
        type="button"
        onClick={primary.onSelect}
        className={cn(GLASS_ACTION, GLASS_PILL, "h-8 px-3.5 text-foreground")}
      >
        {primary.icon}
        {primary.label}
      </button>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(GLASS_ACTION, "h-8 px-3")}
      >
        <span className="max-w-[10rem] truncate">{hrefLabel}</span>
        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
      </a>
    </div>
  );
}

/**
 * The commit's title and venue, the way the theater's top bar prints them.
 *
 * The *item's* commit, which on an ordinary set is the set's own and on a
 * squashed row is whichever member actually attached this thing. Paging
 * through such a set walks through several commits, and the header is the
 * only thing that says which one you are on.
 */
function Meta({ origin }: { origin: AttachmentOrigin }) {
  return (
    <div className="min-w-0">
      <div className={cn("truncate", TYPE.mediaTitle)}>{origin.title}</div>
      {origin.venue && (
        <div className={cn("mt-0.5 truncate", TYPE.labelWide)}>
          {origin.venue}
        </div>
      )}
    </div>
  );
}

export function AttachmentPage({ set, index }: AttachmentPageProps) {
  const { act, nativeHomeOf } = useAttachments();
  const { locale } = useLocale();
  const item = set.items[index];
  if (!item) return null;
  const { media, origin } = item;

  const open = () => act(set, index);
  const home = nativeHomeOf(set, index);

  const kind = mediaKindOf(media);

  if (isVideoMedia(media) || isSlidesMedia(media)) {
    const label = t(locale, kind === "slides" ? "logSlides" : "logWatch");
    return (
      <div className="space-y-4">
        <Cover image={getMediaThumbnail(media)} label={label} onOpen={open} />
        <Meta origin={origin} />
        <Actions
          primary={{ label, icon: homeIcon(home, kind), onSelect: open }}
          href={media.url}
          hrefLabel={getDomainLabel(media.url)}
        />
      </div>
    );
  }

  if (isLinkMedia(media)) {
    const url = linkTarget(media, locale);
    const internal = isInternalLink(media);
    const preview = media.previews?.[locale] ?? media.preview;
    const domain = internal ? "/writing" : getDomainLabel(url);
    const label = t(
      locale,
      kind === "post" ? "logRead" : kind === "video" ? "logWatch" : "logVisit",
    );
    return (
      <div className="space-y-4">
        {preview?.image ? (
          <div className="relative overflow-hidden rounded-xl border border-border/50 bg-muted/20">
            <PeekCover
              src={preview.image}
              fit={preview.fit ?? "natural"}
              aspect={preview.aspect}
              className="rounded-none border-0"
            />
          </div>
        ) : (
          <div className="flex aspect-[2/1] items-center justify-center rounded-xl border border-border/50 bg-muted/10">
            <ImageIcon className="h-8 w-8 text-quaternary-foreground" />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <div className={TYPE.labelSm}>{domain}</div>
          <div className={TYPE.mediaTitle}>{preview?.title || domain}</div>
          {preview?.description && (
            <p className={cn(TYPE.caption, "line-clamp-4")}>
              {preview.description}
            </p>
          )}
        </div>
        <Actions
          primary={{ label, icon: homeIcon(home, kind), onSelect: open }}
          href={url}
          hrefLabel={domain}
        />
      </div>
    );
  }

  if (isImageMedia(media)) {
    // The still is its own button: a tap takes it to the lightbox, where it
    // can be read at its own resolution.
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={open}
          aria-label={t(locale, "logView")}
          className={cn(
            "block w-full overflow-hidden rounded-xl border border-border/50 bg-muted/10",
            "pressable outline-none focus-visible:ring-1 focus-visible:ring-foreground/20",
          )}
        >
          <ExternalImage
            src={media.thumbnail ?? media.url}
            alt={media.alt ?? ""}
            loading="eager"
            className="block h-auto w-full"
          />
        </button>
        {media.alt && <p className={TYPE.caption}>{media.alt}</p>}
        <Actions
          primary={{
            label: t(locale, "logView"),
            icon: <ZoomIn className="h-3.5 w-3.5" />,
            onSelect: open,
          }}
          href={media.url}
          hrefLabel={
            // A file this site serves has no domain worth printing.
            media.url.startsWith("/")
              ? t(locale, "lightboxOriginal")
              : getDomainLabel(media.url)
          }
        />
      </div>
    );
  }

  if (isSocialEmbedMedia(media)) {
    return (
      <div className="space-y-4">
        <SocialEmbed url={media.url} platform={media.platform} />
        <Actions
          primary={{
            label: t(locale, "logVisit"),
            icon: <ArrowUpRight className="h-3.5 w-3.5" />,
            onSelect: open,
          }}
          href={media.url}
          hrefLabel={getDomainLabel(media.url)}
        />
      </div>
    );
  }

  return null;
}
