"use client";

/**
 * Media Component
 *
 * Unified entry point for rendering a single external content item.
 * Auto-detects platform from URL and dispatches to the appropriate renderer.
 *
 * Usage:
 *   <Media url="https://youtu.be/..." />
 *   <Media url="https://x.com/..." as="embed" theme="light" />
 *   <Media url="https://example.com" as="link" title="My Site" />
 */

import type { MediaType, VideoPlatform, EmbedPlatform } from "@/lib/log";
import { Video, detectVideoPlatform } from "./video";
import { Embed, detectEmbedPlatform } from "./embed";
import { Link, LinkPreview } from "./link";
import { Figure } from "./image";

// =============================================================================
// Types
// =============================================================================

export interface MediaProps {
  /** URL of the media content */
  url: string;
  /** Force a specific render type (auto-detected from URL if omitted) */
  as?: MediaType;
  /** Label text for link type */
  title?: string;
  /** Theme for embed type */
  theme?: "light" | "dark";
  /** Thumbnail URL for video type */
  thumbnail?: string;
  /** Platform hint (auto-detected if omitted) */
  platform?: VideoPlatform | EmbedPlatform;
  /** Alt text for image type */
  alt?: string;
  /** Whether to show a link preview card */
  showPreview?: boolean;
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Auto-Detection Helpers
// =============================================================================

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;

function autoDetectType(url: string): MediaType {
  if (detectVideoPlatform(url)) return "video";
  if (detectEmbedPlatform(url)) return "embed";
  if (IMAGE_EXTENSIONS.test(url)) return "image";
  return "link";
}

// =============================================================================
// Main Component
// =============================================================================

export function Media({
  url,
  as,
  title,
  theme,
  thumbnail,
  platform,
  alt,
  showPreview = true,
  size = "default",
  className,
}: MediaProps) {
  const type = as ?? autoDetectType(url);

  switch (type) {
    case "video": {
      const videoPlatform = (platform as VideoPlatform) ?? detectVideoPlatform(url);
      if (!videoPlatform) {
        return <LinkPreview url={url} size={size} className={className} />;
      }
      return (
        <Video
          url={url}
          platform={videoPlatform}
          thumbnail={thumbnail}
          size={size}
          className={className}
        />
      );
    }

    case "embed": {
      const embedPlatform = (platform as EmbedPlatform) ?? detectEmbedPlatform(url) ?? undefined;
      return (
        <Embed
          url={url}
          platform={embedPlatform}
          theme={theme}
          size={size}
          className={className}
        />
      );
    }

    case "image":
      return (
        <Figure url={url} alt={alt} size={size} className={className} />
      );

    case "link":
    default:
      if (showPreview) {
        return (
          <LinkPreview url={url} title={title} size={size} className={className} />
        );
      }
      return <Link url={url} label={title} className={className} />;
  }
}

