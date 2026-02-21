/**
 * Log System Components
 *
 * Git Log / Commit History style visualization of career history.
 *
 * Terminology:
 * - Commit: A work item (project, talk, post, role, social)
 * - Media: Attached external content (video, embed, link, image)
 * - Embed: Specifically the native social platform widgets (Twitter, Instagram, TikTok)
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

export { CommitCard } from "./commit-card";
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
  Embed,
  Link,
  LinkPreview,
  Figure,
  YouTubeEmbed,
  BilibiliEmbed,
  VimeoEmbed,
  TwitterEmbed,
  InstagramEmbed,
  TikTokEmbed,
  detectVideoPlatform,
  detectEmbedPlatform,
  type MediaProps,
  type MediaRendererProps,
  type MediaThumbnailProps,
  type VideoProps,
  type EmbedProps,
  type LinkProps,
  type LinkPreviewProps,
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
