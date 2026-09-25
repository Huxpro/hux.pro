"use client";

/**
 * Media — unified MDX entry point for a single piece of attached content.
 *
 * Detects the kind from the URL and routes to the appropriate renderer.
 * Authors can force a kind with `as`, and a card vs. pill presentation for
 * link kinds with `present`.
 *
 * Usage:
 *   <Media url="https://youtu.be/..." />                       (video)
 *   <Media url="https://x.com/..." as="social-embed" />        (social widget)
 *   <Media url="https://example.com" as="link" present="card" /> (OG card)
 *   <Media url="https://example.com" as="link" present="pill" title="Site" />
 */

import type { MediaKind, VideoPlatform, SocialEmbedPlatform } from "@/lib/log";

/**
 * Prose keeps both dressings for a link: an inline pill reads as part of a
 * sentence's paragraph, where a card would break it. The log's schema is
 * card-only (`LinkPresent`); this is the MDX component's own choice.
 */
type MediaPresent = "pill" | "card";
import { Video, detectVideoPlatform } from "./video";
import { SocialEmbed, detectSocialEmbedPlatform } from "./embed";
import { Link, LinkCard } from "./link";
import { Figure } from "./image";
import { Slides, isPlayableSlidesUrl } from "./slides";

// =============================================================================
// Types
// =============================================================================

export interface MediaProps {
  /** URL of the media content. */
  url: string;
  /** Force a specific kind (auto-detected from URL if omitted). */
  as?: MediaKind;
  /** For `link` kind: pill (default) or card. */
  present?: MediaPresent;
  /** Label text for pill links. */
  title?: string;
  /** Theme for the social-embed kind. */
  theme?: "light" | "dark";
  /** Thumbnail URL for the video / slides kinds. */
  thumbnail?: string;
  /** Platform hint (auto-detected if omitted). */
  platform?: VideoPlatform | SocialEmbedPlatform;
  /** Alt text for the image kind. */
  alt?: string;
  /** Size variant. */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes. */
  className?: string;
}

// =============================================================================
// Auto-Detection Helpers
// =============================================================================

const IMAGE_EXTENSIONS = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;

function autoDetectKind(url: string): MediaKind {
  if (detectVideoPlatform(url)) return "video";
  if (detectSocialEmbedPlatform(url)) return "social-embed";
  if (isPlayableSlidesUrl(url)) return "slides";
  if (IMAGE_EXTENSIONS.test(url)) return "image";
  return "link";
}

// =============================================================================
// Main Component
// =============================================================================

export function Media({
  url,
  as,
  present = "pill",
  title,
  theme,
  thumbnail,
  platform,
  alt,
  size = "default",
  className,
}: MediaProps) {
  const kind = as ?? autoDetectKind(url);

  switch (kind) {
    case "video": {
      const videoPlatform =
        (platform as VideoPlatform) ?? detectVideoPlatform(url);
      if (!videoPlatform) {
        // Misclassified URL — degrade to a card rather than silently failing.
        return <LinkCard url={url} size={size} className={className} />;
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

    case "slides":
      return (
        <Slides
          url={url}
          thumbnail={thumbnail}
          title={title}
          size={size}
          className={className}
        />
      );

    case "social-embed": {
      const socialPlatform =
        (platform as SocialEmbedPlatform) ??
        detectSocialEmbedPlatform(url) ??
        undefined;
      return (
        <SocialEmbed
          url={url}
          platform={socialPlatform}
          theme={theme}
          size={size}
          className={className}
        />
      );
    }

    case "image":
      return <Figure url={url} alt={alt} size={size} className={className} />;

    case "link":
    default:
      if (present === "card") {
        return (
          <LinkCard
            url={url}
            title={title}
            size={size}
            className={className}
          />
        );
      }
      return <Link url={url} label={title} className={className} />;
  }
}
