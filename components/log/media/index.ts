/**
 * Media Component System
 *
 * Composable media rendering for commits.
 * Each component is strictly typed and renders a specific media type.
 *
 * Terminology:
 * - Media: The abstract concept of attached content (video, embed, link, image)
 * - Video: YouTube/Bilibili/Vimeo iframe players
 * - Embed: Native social platform widgets (Twitter, Instagram, TikTok)
 * - Link: External link with optional OG preview
 * - Figure: Static image display (uses Next.js Image)
 *
 * Structure:
 * - Router components (Video, Embed) dispatch to platform-specific implementations
 * - Each platform has its own file with colocated logic
 */

// =============================================================================
// Main Entry Points
// =============================================================================

export { MediaRenderer, type MediaRendererProps } from "./media-renderer";
export { Media, type MediaProps } from "./media";
export { MediaThumbnail, type MediaThumbnailProps } from "./thumbnail";

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
  Embed,
  EmbedFromMedia,
  detectEmbedPlatform,
  extractEmbedId,
  type EmbedProps,
  type EmbedPropsFromMedia,
} from "./embed";

export {
  Link,
  LinkPreview,
  LinkFromMedia,
  LinkPreviewFromMedia,
  type LinkProps,
  type LinkPreviewProps,
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
  MediaType,
  VideoMedia,
  EmbedMedia,
  LinkMedia,
  ImageMedia,
  VideoPlatform,
  EmbedPlatform,
} from "@/lib/log";
