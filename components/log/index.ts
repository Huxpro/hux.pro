/**
 * Log System Components
 *
 * Git Log / Commit History style visualization of career history.
 *
 * Terminology:
 *  - Commit:      a work item (project / talk / post / role / social / event).
 *  - Media:       attached external content. Four kinds: link, social-embed,
 *                 video, image.
 *  - Link card:   `kind:"link", present:"card"` — an OG-style preview block.
 *  - SocialEmbed: native social platform widget (X / Instagram / TikTok).
 */

// =============================================================================
// Main Components
// =============================================================================

export { LogTimeline } from "./log-timeline";
export { Commit } from "./commit-embed";
export { commitIcons } from "./icons";

// =============================================================================
// Generic Commit Renderers
// =============================================================================

export { CommitCompact } from "./commit-compact";
export { TimelineCommit } from "./timeline-commit";

// =============================================================================
// Adapter
// =============================================================================

export { normalizeCommit } from "./commit-data";
export type { NormalizedCommit, SimpleLink } from "./commit-data";

// =============================================================================
// Media Components
// =============================================================================

export {
  Media,
  MediaRenderer,
  MediaThumbnail,
  Video,
  SocialEmbed,
  Link,
  LinkCard,
  Figure,
  YouTubeEmbed,
  BilibiliEmbed,
  VimeoEmbed,
  TwitterEmbed,
  InstagramEmbed,
  TikTokEmbed,
  detectVideoPlatform,
  detectSocialEmbedPlatform,
  type MediaProps,
  type MediaRendererProps,
  type MediaThumbnailProps,
  type VideoProps,
  type SocialEmbedProps,
  type LinkProps,
  type LinkCardProps,
  type FigureProps,
  type YouTubeEmbedProps,
  type BilibiliEmbedProps,
  type VimeoEmbedProps,
  type TwitterEmbedProps,
  type InstagramEmbedProps,
  type TikTokEmbedProps,
} from "./media";

// =============================================================================
// Types
// =============================================================================

export type { CommitProps, CommitVariant } from "./commit-embed";
