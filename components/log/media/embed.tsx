"use client";

/**
 * SocialEmbed — router for native social platform widgets.
 *
 * Renders the X / Instagram / TikTok official embed in place. Distinct from a
 * `link` card: this is a live mini-app, not OG metadata. Platform detection
 * falls back to the URL host when the author hasn't picked a platform.
 *
 * Platform-specific logic is colocated in:
 *  - ./twitter.tsx
 *  - ./instagram.tsx
 *  - ./tiktok.tsx
 */

import type { SocialEmbedMedia, SocialEmbedPlatform } from "@/lib/log";
import { detectSocialEmbedPlatform } from "@/lib/og-core";
import { useTheme } from "@/services/theme";
import { TwitterEmbed, extractTweetId } from "./twitter";
import { InstagramEmbed, extractInstagramId } from "./instagram";
import { TikTokEmbed, extractTikTokId } from "./tiktok";
import { Link } from "./link";

// =============================================================================
// Types
// =============================================================================

export interface SocialEmbedProps {
  /** URL of the post to embed. */
  url: string;
  /** Platform hint; auto-detected from URL when omitted. */
  platform?: SocialEmbedPlatform;
  /** Theme for the embed. */
  theme?: "light" | "dark";
  /** Size variant. */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes. */
  className?: string;
}

export interface SocialEmbedPropsFromMedia {
  media: SocialEmbedMedia;
  theme?: "light" | "dark";
  size?: "compact" | "default" | "large";
  className?: string;
}

// =============================================================================
// Platform Detection
// =============================================================================

// Re-export the og-core canonical detector so consumers of this module keep
// a single import point. The `isTwitterUrl` / `isInstagramUrl` / `isTikTokUrl`
// per-platform helpers stay around for components that need finer URL
// inspection (e.g. extractTweetId's path grammar).
export { detectSocialEmbedPlatform };

/** Extract a post ID for any supported platform. */
export function extractSocialEmbedId(
  url: string,
  platform: SocialEmbedPlatform,
): string | null {
  switch (platform) {
    case "twitter":
    case "x":
      return extractTweetId(url);
    case "instagram":
      return extractInstagramId(url);
    case "tiktok":
      return extractTikTokId(url);
    default:
      return null;
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function SocialEmbed({
  url,
  platform: platformProp,
  theme: themeProp,
  size = "default",
  className,
}: SocialEmbedProps) {
  // Use site theme from context, allow prop override.
  const { theme: siteTheme } = useTheme();
  const theme = themeProp ?? siteTheme;

  const platform = platformProp || detectSocialEmbedPlatform(url);

  // Misclassified URL (e.g. the author picked "social-embed" then pasted a
  // non-social URL). Degrade to a plain pill rather than guessing a card —
  // cards only ever come from kind:"link", present:"card".
  if (!platform) {
    return <Link url={url} className={className} />;
  }

  switch (platform) {
    case "twitter":
    case "x":
      return (
        <TwitterEmbed
          url={url}
          theme={theme}
          size={size}
          className={className}
        />
      );
    case "instagram":
      // Key forces re-mount on theme change since embed.js doesn't support
      // dynamic themes.
      return (
        <InstagramEmbed
          key={`instagram-${extractInstagramId(url)}-${theme}`}
          url={url}
          theme={theme}
          size={size}
          className={className}
        />
      );
    case "tiktok":
      return (
        <TikTokEmbed
          url={url}
          theme={theme}
          size={size}
          className={className}
        />
      );
    default:
      return <Link url={url} className={className} />;
  }
}

/** Convenience wrapper that accepts SocialEmbedMedia directly. */
export function SocialEmbedFromMedia({
  media,
  ...props
}: SocialEmbedPropsFromMedia) {
  return <SocialEmbed url={media.url} platform={media.platform} {...props} />;
}

// =============================================================================
// Re-export platform components for direct use
// =============================================================================

export { TwitterEmbed, extractTweetId, isTwitterUrl } from "./twitter";
export { InstagramEmbed, extractInstagramId, isInstagramUrl } from "./instagram";
export { TikTokEmbed, extractTikTokId, isTikTokUrl } from "./tiktok";
