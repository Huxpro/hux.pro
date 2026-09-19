import {
  ArrowUpRight,
  AtSign,
  BookOpen,
  Globe,
  Image as ImageIcon,
  Play,
  Presentation,
  type LucideIcon,
} from "lucide-react";
import { ARTWORK_CHIP } from "@/lib/glass";
import type { Locale } from "@/lib/i18n";
import { t } from "@/lib/i18n";
import {
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
  isSocialEmbedMedia,
  isVideoMedia,
  type Media,
  type SocialEmbedPlatform,
  type VideoPlatform,
} from "@/lib/log";
import { getDomainLabel, isVideoLinkHost, videoLinkHostLabel } from "@/lib/og-core";
import { cn } from "@/lib/utils";

// =============================================================================
// MediaMark — what this cover is, said once, in one chip.
//
// A cover on the site is one of a few kinds of thing, and each kind opens in
// a different place: a recording and a deck on the theater's stage, a page in
// the in-app browser, a post on its own route. The cover says which before it
// is pressed, and it used to say so in three vocabularies at once — a play
// disc stamped on anything that played, a caption chip over the disc on a
// deck, a line of prose under a card that would leave for a tab. This is the
// one vocabulary: a chip at the cover's bottom-left corner, the same chip a
// wallpaper tile wears for Live / Preset (`ARTWORK_CHIP`), with a glyph and
// a word.
//
//   video    ▶ YouTube · bilibili · Vimeo — the platform, so a talk says
//            where it was recorded. A recording that lives on a page (a
//            GitNation talk) is the same chip with the host's name: the chip
//            says what the thing is, and it is a recording; where it opens —
//            the stage for a video, the in-app browser for that page — is the
//            policy's business (systems/attachments), never the chip's.
//   slides   ▤ Slides
//   new tab  ↗ New tab — a page that refuses to be framed, whatever its kind
//
// Who wears one is the surface's call, in three tiers:
//
//   /works (the strip, the expanded body)   a recording, a deck, and a page
//            that will leave. A card is its own hint (domain, title), and a
//            chip on every card would be noise.
//   the hover peek                          every kind (`all`): a page says
//            Web, a post Writing, an image Image, a social widget its
//            platform. The peek is a glance, and the chip is its caption.
//   the attachment sheet's page, the home    none. Each already says what the
//   widgets' covers, the theater's rail      thing is beside the cover — a
//            labelled button, the widget's line, the rail's title — and a
//            chip there would only repeat it.
//
// `markFor` reads the chip off a media item; `MediaMark` draws whatever it
// is handed, so a cover never has to know why it wears what it wears.
//
// The chip is absolutely positioned: the parent must be `relative`. At
// `mini` — the /works contact strip, whose covers are 56px tall — the chip
// keeps its glyph and drops its word, the wallpaper tile's small badge.
// =============================================================================

export type MediaKind = "video" | "slides" | "web" | "post" | "image" | "social";

export const MEDIA_KINDS: readonly MediaKind[] = [
  "video",
  "slides",
  "web",
  "post",
  "image",
  "social",
];

/** The kind a link stands for: a recording on a video host, a page, a post. */
export function linkKindOf(url: string, internal = false): MediaKind {
  if (internal) return "post";
  return isVideoLinkHost(url) ? "video" : "web";
}

/** The kind a media item stands for — what pressing its cover opens. */
export function mediaKindOf(media: Media): MediaKind {
  if (isVideoMedia(media)) return "video";
  if (isSlidesMedia(media)) return "slides";
  if (isLinkMedia(media)) {
    return linkKindOf(media.url, !!media.internal || media.url.startsWith("/"));
  }
  if (isImageMedia(media)) return "image";
  if (isSocialEmbedMedia(media)) return "social";
  return "web";
}

/** What the chip says: a glyph and a word. */
export interface MediaMarkSpec {
  icon: LucideIcon;
  label: string;
  /** A filled glyph (the play mark). */
  fill?: boolean;
}

export const PLATFORM_LABEL: Record<VideoPlatform, string> = {
  youtube: "YouTube",
  bilibili: "bilibili",
  vimeo: "Vimeo",
};

const SOCIAL_LABEL: Record<SocialEmbedPlatform, string> = {
  twitter: "X",
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** The deck's chip, for a cover that knows it is a deck without a `Media`. */
export const SLIDES_MARK: MediaMarkSpec = { icon: Presentation, label: "Slides" };

/** A recording's chip: the platform it is on. */
export function videoMark(platform: VideoPlatform): MediaMarkSpec {
  return { icon: Play, label: PLATFORM_LABEL[platform], fill: true };
}

/** The chip for a cover whose press leaves the site. */
export function newTabMark(locale: Locale): MediaMarkSpec {
  return { icon: ArrowUpRight, label: t(locale, "linkNewTab") };
}

/**
 * The chip a media item's cover wears, or null for a cover that wears none.
 *
 *   `leaves`  the press will open a tab (a page that refuses to be framed):
 *             the chip says so, whatever the kind.
 *   `all`     mark every kind, not only a recording and a deck — the hover
 *             peek's tier.
 */
export function markFor(
  media: Media,
  locale: Locale,
  opts: { all?: boolean; leaves?: boolean } = {},
): MediaMarkSpec | null {
  if (opts.leaves) return newTabMark(locale);
  if (isVideoMedia(media)) return videoMark(media.platform);
  if (isSlidesMedia(media)) return SLIDES_MARK;
  const host = isLinkMedia(media) ? videoLinkHostLabel(media.url) : null;
  if (host) return { icon: Play, label: host, fill: true };
  if (!opts.all) return null;
  if (isLinkMedia(media)) {
    const internal = !!media.internal || media.url.startsWith("/");
    return internal
      ? { icon: BookOpen, label: "Writing" }
      : { icon: Globe, label: "Web" };
  }
  if (isImageMedia(media)) return { icon: ImageIcon, label: "Image" };
  if (isSocialEmbedMedia(media)) {
    return {
      icon: AtSign,
      label: media.platform ? SOCIAL_LABEL[media.platform] : getDomainLabel(media.url),
    };
  }
  return null;
}

export type MediaMarkSize = "mini" | "compact" | "default";

/** The word chip, the wallpaper tile's; `mini` is its small glyph badge. */
const CHIP_SIZE: Record<MediaMarkSize, { box: string; icon: string; word: boolean }> = {
  mini: { box: "bottom-1 left-1 size-5 justify-center", icon: "size-2.5", word: false },
  compact: { box: "bottom-1.5 left-1.5 gap-1 px-1.5 py-0.5", icon: "size-2.5", word: true },
  default: { box: "bottom-2 left-2 gap-1 px-2 py-0.5", icon: "size-3", word: true },
};

/**
 * The same chip on a surface instead of on artwork — for a card that has no
 * cover to wear it on, where it sits in the caption's line.
 */
const SURFACE_CHIP =
  "bg-foreground/[0.06] text-muted-foreground ring-1 ring-border/50 dark:bg-white/[0.08]";

export function MediaMark({
  mark,
  size = "default",
  inline = false,
  className,
}: {
  mark: MediaMarkSpec | null | undefined;
  size?: MediaMarkSize;
  /** In the flow of a caption line rather than on a cover. */
  inline?: boolean;
  className?: string;
}) {
  if (!mark) return null;
  const stop = CHIP_SIZE[size];
  const Icon = mark.icon;
  if (inline) {
    return (
      <span
        aria-hidden
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px",
          "font-mono text-[10px] uppercase tracking-wider whitespace-nowrap leading-none",
          SURFACE_CHIP,
          className,
        )}
      >
        <Icon
          className={cn("size-2.5", mark.fill && "translate-x-px")}
          strokeWidth={2.25}
          fill={mark.fill ? "currentColor" : "none"}
        />
        {mark.label}
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-10 flex items-center rounded-full",
        "font-mono text-[10px] uppercase tracking-wider whitespace-nowrap",
        ARTWORK_CHIP,
        stop.box,
        className,
      )}
    >
      <Icon
        className={cn(stop.icon, mark.fill && "translate-x-px")}
        strokeWidth={2.25}
        fill={mark.fill ? "currentColor" : "none"}
      />
      {stop.word && mark.label}
    </span>
  );
}
