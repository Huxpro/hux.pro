import type { Locale } from "@/lib/i18n";
import {
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
  isSocialEmbedMedia,
  isVideoMedia,
  type Media,
} from "@/lib/log";
import { pickInternalLink } from "@/lib/og-enrich";
import type { AttachmentHome } from "./types";

// =============================================================================
// Attachments — the policy: where a piece of attached media opens.
//
// The site is a small operating system with places already built for the
// things a commit attaches: a theater for anything that plays, a window
// manager for anything that is a page, a router for its own pages. On a
// desktop an attachment goes to its native home — the click on a video cover
// lands in the theater, the click on a link card in an in-app browser window.
//
// A phone has none of those homes in a usable shape: the theater is a PiP the
// size of a thumb, a window is the whole screen. There every attachment opens
// the same way, in a bottom sheet that pages through the commit's attachments
// and offers each one's native action as a button. Two rules, one function,
// so a cover on the contact strip and the player in the expanded body never
// disagree about what a tap does.
// =============================================================================

export interface HomeContext {
  /** A phone-class viewport (below `sm`): the sheet takes everything. */
  compact: boolean;
  /** The theater can put up its stage (tablet+, and tall enough). */
  theaterAvailable: boolean;
  /** A window manager is mounted to open a page in. */
  windows: boolean;
  locale: Locale;
}

/**
 * The URL a link opens — the viewer's locale variant where the card has one,
 * the matching post for an internal writing link.
 */
export function linkTarget(media: Media, locale: Locale): string {
  if (!isLinkMedia(media)) return media.url;
  if (media.internal) {
    return pickInternalLink(media.internal, locale).url ?? media.url;
  }
  return media.urls?.[locale] ?? media.url;
}

/** True when the link points at one of this site's own pages. */
export function isInternalLink(media: Media): boolean {
  return isLinkMedia(media) && (!!media.internal || media.url.startsWith("/"));
}

/**
 * The attachment's native home — what its primary action does, whatever
 * surface the action is offered from. This is also where a desktop click
 * lands directly for the kinds that have one.
 */
export function nativeHomeFor(media: Media, ctx: HomeContext): AttachmentHome {
  if (isVideoMedia(media)) return "theater";
  // A deck in a phone's PiP is unreadable; reveal.js wants the tab there.
  if (isSlidesMedia(media)) return ctx.theaterAvailable ? "theater" : "tab";
  if (isLinkMedia(media)) {
    if (isInternalLink(media)) return "route";
    // A page that refuses to be framed (X-Frame-Options, frame-ancestors —
    // read at snapshot time) would open a window showing a refusal.
    if (media.preview?.frame === "deny") return "tab";
    return ctx.windows && !ctx.compact ? "window" : "tab";
  }
  return "tab";
}

/**
 * Where a click on the attachment lands. A phone opens the surface for
 * everything; elsewhere a video or a deck goes to the theater, a link to its
 * window, and the kinds with no native home of their own — an image, a
 * social widget — open the surface in its desktop shape.
 */
export function homeFor(media: Media, ctx: HomeContext): AttachmentHome {
  if (ctx.compact) return "surface";
  if (isVideoMedia(media)) return "theater";
  if (isSlidesMedia(media)) return ctx.theaterAvailable ? "theater" : "surface";
  if (isLinkMedia(media)) return nativeHomeFor(media, ctx);
  if (isImageMedia(media) || isSocialEmbedMedia(media)) return "surface";
  return "surface";
}
