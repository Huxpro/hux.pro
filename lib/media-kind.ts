import type { MediaKind, VideoPlatform } from "./log";
import { detectSocialEmbedPlatform } from "./og-core";
import { isPlayableSlidesUrl } from "./slides";

// =============================================================================
// Media kind: what a bare URL is, read off the URL.
//
// One reading for every place that has only a URL: <Media /> choosing what
// to render, a magic link choosing what to peek and open
// (components/magic-link), the badge-site rule and the card snapshot
// (scripts/og-snapshot.ts) choosing what has a page card at all. Plain
// TypeScript with no React and no file system, so the scripts share it.
// =============================================================================

/** A URL that is an image file. */
export const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;

/** The video platform a URL is on, or null. */
export function detectVideoPlatform(url: string): VideoPlatform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return "youtube";
    }
    if (hostname.includes("bilibili.com")) return "bilibili";
    if (hostname.includes("vimeo.com")) return "vimeo";
    return null;
  } catch {
    return null;
  }
}

/** What a URL is: a video, a social post, a deck, an image, or a page. */
export function detectMediaKind(url: string): MediaKind {
  if (detectVideoPlatform(url)) return "video";
  if (detectSocialEmbedPlatform(url)) return "social-embed";
  if (isPlayableSlidesUrl(url)) return "slides";
  if (IMAGE_EXTENSIONS.test(url)) return "image";
  return "link";
}
