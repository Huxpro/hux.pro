import { Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
  isSocialEmbedMedia,
  isVideoMedia,
  type Media,
} from "@/lib/log";
import { isVideoLinkHost } from "@/lib/og-core";
import { PlayBadge, type PlayBadgeSize, type PlayBadgeTone } from "./play-badge";

// =============================================================================
// MediaMark — what pressing this cover does, said once, the same way everywhere.
//
// A cover on the site is one of a few kinds of thing, and each kind opens in a
// different place: a video and a deck on the theater's stage, a page in the
// in-app browser, a post on its own route. The cover has to say which before
// it is pressed, and it used to say so in three vocabularies at once — a play
// disc on anything that played, a `Slides` chip on a deck (over the play
// disc), a browser glyph here and there — each drawn in place by whichever
// component was holding the cover. This is the one vocabulary:
//
//   video   a play disc, centred        — it plays, on the stage
//   slides  a `Slides` chip, bottom-left — it presents, on the stage
//   web     nothing                      — it is a page; the card is the hint,
//                                          and the action says `Visit`
//   post    nothing                      — a page of this site; `Read`
//   image / social  nothing              — what you see is the thing
//
// A deck wears its chip and not the disc: a play disc says "press to watch"
// and a deck is not watched. `mediaKindOf` reads the kind off a media item
// (a link to YouTube is a video, whatever its `kind` field says), so a cover
// never has to know why it wears what it wears.
//
// The mark is absolutely positioned: the parent must be `relative`. Sizes
// follow PlayBadge's three stops — `mini` for the /works contact strip, whose
// covers are 56px tall (the chip drops its word there and keeps the glyph),
// `compact` for rail thumbs and dense cards, `default` for a full cover.
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

export type MediaMarkSize = PlayBadgeSize;
export type MediaMarkTone = PlayBadgeTone;

const CHIP_SIZE: Record<MediaMarkSize, { box: string; icon: string; word: boolean }> = {
  mini: { box: "bottom-1 left-1 h-4 px-1 rounded", icon: "h-2.5 w-2.5", word: false },
  compact: { box: "bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md", icon: "h-3 w-3", word: true },
  default: { box: "bottom-2 left-2 px-1.5 py-0.5 rounded-md", icon: "h-3 w-3", word: true },
};

/** The `Slides` chip: a caption at the corner, where a badge on a cover goes. */
function KindChip({
  size,
  icon: Icon,
  label,
}: {
  size: MediaMarkSize;
  icon: typeof Presentation;
  label: string;
}) {
  const stop = CHIP_SIZE[size];
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inline-flex items-center gap-1",
        "bg-black/55 font-mono text-[10px] uppercase tracking-wide text-white/90 ring-1 ring-white/15 backdrop-blur-sm",
        stop.box,
      )}
    >
      <Icon className={stop.icon} />
      {stop.word && label}
    </span>
  );
}

export function MediaMark({
  kind,
  size = "default",
  tone = "dark",
  className,
}: {
  kind: MediaKind;
  size?: MediaMarkSize;
  /** The play disc's material — dark on log covers, glass on the stage's. */
  tone?: MediaMarkTone;
  /** Merged into the play disc (e.g. a hover scale); the chip takes none. */
  className?: string;
}) {
  switch (kind) {
    case "video":
      return <PlayBadge size={size} tone={tone} className={className} />;
    case "slides":
      return <KindChip size={size} icon={Presentation} label="Slides" />;
    default:
      return null;
  }
}
