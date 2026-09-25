/**
 * Media Component System
 *
 * Composable rendering for the media kinds attached to commits.
 *
 * Terminology:
 *  - Media:        the abstract concept of attached content.
 *  - LinkMedia:    a URL presented as either a pill (corner indicator) or a
 *                  card (OG-style preview block backed by the card pipeline).
 *  - SocialEmbed:  a native social platform widget (X / Instagram / TikTok).
 *  - VideoMedia:   YouTube / Bilibili / Vimeo iframe player with cover.
 *  - SlidesMedia:  HTML reveal.js deck played on the theater's stage.
 *  - ImageMedia:   static image asset (uses Next.js Image).
 *
 * Structure:
 *  - Router components (SocialEmbed, Video, Slides) dispatch to platform-
 *    specific implementations, each colocated in its own file.
 */

// =============================================================================
// Main Entry Points
// =============================================================================

export { MediaRenderer, type MediaRendererProps } from "./media-renderer";
export { Media, type MediaProps } from "./media";

// =============================================================================
// Router Components (dispatch to platform-specific implementations)
// =============================================================================

export {
  Video,
  VideoFromMedia,
  detectVideoPlatform,
  extractVideoId,
  type VideoProps,
  type VideoPropsFromMedia,
} from "./video";

export {
  Slides,
  SlidesFromMedia,
  isPlayableSlidesUrl,
  resolveSlidesEmbedUrl,
  type SlidesProps,
  type SlidesPropsFromMedia,
} from "./slides";

export {
  SocialEmbed,
  SocialEmbedFromMedia,
  detectSocialEmbedPlatform,
  extractSocialEmbedId,
  type SocialEmbedProps,
  type SocialEmbedPropsFromMedia,
} from "./embed";

export {
  Link,
  LinkCard,
  LinkCardFromMedia,
  type LinkProps,
  type LinkCardProps,
} from "./link";

export {
  Figure,
  FigureFromMedia,
  type FigureProps,
  type FigurePropsFromMedia,
} from "./image";

// =============================================================================
// Platform-Specific Components (for direct use when needed)
// =============================================================================

// Video platforms
export {
  YouTubeEmbed,
  extractYouTubeId,
  type YouTubeEmbedProps,
} from "./youtube";

export {
  BilibiliEmbed,
  extractBilibiliId,
  type BilibiliEmbedProps,
} from "./bilibili";

export {
  VimeoEmbed,
  extractVimeoId,
  type VimeoEmbedProps,
} from "./vimeo";

// Social embed platforms
export {
  TwitterEmbed,
  extractTweetId,
  isTwitterUrl,
  type TwitterEmbedProps,
} from "./twitter";

export {
  InstagramEmbed,
  extractInstagramId,
  isInstagramUrl,
  type InstagramEmbedProps,
} from "./instagram";

export {
  TikTokEmbed,
  extractTikTokId,
  isTikTokUrl,
  type TikTokEmbedProps,
} from "./tiktok";

// =============================================================================
// Re-export types from lib/log for convenience
// =============================================================================

export type {
  Media as MediaData,
  MediaKind,
  MediaPreview,
  LinkMedia,
  LinkPresent,
  SocialEmbedMedia,
  VideoMedia,
  SlidesMedia,
  ImageMedia,
  VideoPlatform,
  SocialEmbedPlatform,
} from "@/lib/log";
