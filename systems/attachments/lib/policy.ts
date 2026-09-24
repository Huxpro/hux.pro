import type { Locale } from "@/lib/i18n";
import {
  isImageMedia,
  isLinkMedia,
  isSlidesMedia,
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
// A phone has fewer of those homes in a usable shape: the stage is a PiP
// there, and a window is the whole screen. There every attachment
// opens the same way, in a bottom sheet that pages through the commit's
// attachments and offers each one's native action as a button. A page still
// has its home there — a window on a phone is a sheet (systems/windows), so
// `Visit` stacks the in-app browser over the attachment sheet the way a link
// in a mobile app opens in its own in-app browser, and only a page that
// refuses to be framed leaves for a tab. Two rules, one function, so a cover
// on the contact strip and the player in the expanded body never disagree
// about what a tap does.
// =============================================================================

export interface HomeContext {
  /** A phone-class viewport (below `sm`): the sheet takes everything. */
  compact: boolean;
  /** A window manager is mounted to open a page in. */
  windows: boolean;
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

/**
 * True when a press on the media leaves the site for a tab wherever a window
 * manager is mounted: a page that refuses to be framed. The hover peek asks
 * this without a provider, since a peek only exists where windows do.
 */
export function leavesSite(media: Media): boolean {
  return (
    isLinkMedia(media) && !isInternalLink(media) && media.preview?.frame === "deny"
  );
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
  // The stage, whatever shape it takes here: the theater where it fits, a
  // PiP where it does not. A deck is no different from a recording in this.
  if (isVideoMedia(media) || isSlidesMedia(media)) return "theater";
  // A still is read, not played: its home is the lightbox, where a poster
  // can be zoomed until its footnotes are legible.
  if (isImageMedia(media)) return "lightbox";
  if (isLinkMedia(media)) {
    if (isInternalLink(media)) return "route";
    // A page that refuses to be framed (X-Frame-Options, frame-ancestors —
    // read at snapshot time) would open a window showing a refusal.
    if (media.preview?.frame === "deny") return "tab";
    // The in-app browser, on every viewport: a window is a sheet on a phone.
    return ctx.windows ? "window" : "tab";
  }
  return "tab";
}

/**
 * Where a click on the attachment lands. A phone opens the surface for
 * everything, and the surface's button sends the item on (`nativeHomeFor`);
 * elsewhere a video or a deck goes to the theater, an image to the lightbox, a
 * link to its window, and the kind with no native home of its own — a social
 * widget — opens the surface in its desktop shape.
 */
export function homeFor(media: Media, ctx: HomeContext): AttachmentHome {
  if (ctx.compact) return "surface";
  if (isLinkMedia(media)) return nativeHomeFor(media, ctx);
  if (isVideoMedia(media) || isSlidesMedia(media)) return "theater";
  if (isImageMedia(media)) return "lightbox";
  return "surface";
}
