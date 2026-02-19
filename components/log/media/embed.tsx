"use client";

/**
 * Embed Component
 *
 * Router component for native social platform embeds.
 * Dispatches to platform-specific implementations based on URL detection.
 *
 * Platform-specific logic is colocated in:
 * - ./twitter.tsx
 * - ./instagram.tsx
 * - ./tiktok.tsx
 */

import type { EmbedMedia, EmbedPlatform } from "@/lib/log";
import { useTheme } from "@/services/theme";
import { TwitterEmbed, extractTweetId, isTwitterUrl } from "./twitter";
import { InstagramEmbed, extractInstagramId, isInstagramUrl } from "./instagram";
import { TikTokEmbed, extractTikTokId, isTikTokUrl } from "./tiktok";
import { LinkPreview } from "./link";

// =============================================================================
// Types
// =============================================================================

export interface EmbedProps {
  /** URL to embed */
  url: string;
  /** Platform (auto-detected from URL if not provided) */
  platform?: EmbedPlatform;
  /** Theme for the embed */
  theme?: "light" | "dark";
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

export interface EmbedPropsFromMedia {
  media: EmbedMedia;
  theme?: "light" | "dark";
  size?: "compact" | "default" | "large";
  className?: string;
}

// =============================================================================
// Platform Detection
// =============================================================================

/**
 * Detect embed platform from URL
 */
export function detectEmbedPlatform(url: string): EmbedPlatform | null {
  if (isTwitterUrl(url)) {
    return new URL(url).hostname.includes("x.com") ? "x" : "twitter";
  }
  if (isInstagramUrl(url)) {
    return "instagram";
  }
  if (isTikTokUrl(url)) {
    return "tiktok";
  }
  return null;
}

/**
 * Extract post ID for any supported platform
 */
export function extractEmbedId(url: string, platform: EmbedPlatform): string | null {
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

export function Embed({
  url,
  platform: platformProp,
  theme: themeProp,
  size = "default",
  className,
}: EmbedProps) {
  // Use site theme from context, allow prop override
  const { theme: siteTheme } = useTheme();
  const theme = themeProp ?? siteTheme;

  // Auto-detect platform if not provided
  const platform = platformProp || detectEmbedPlatform(url);

  // Unknown platform - fallback to link preview
  if (!platform) {
    return <LinkPreview url={url} className={className} />;
  }

  // Route to platform-specific implementation
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
      // Key forces re-mount on theme change since embed.js doesn't support dynamic themes
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
      return <LinkPreview url={url} className={className} />;
  }
}

/**
 * Convenience wrapper that accepts EmbedMedia directly
 */
export function EmbedFromMedia({ media, ...props }: EmbedPropsFromMedia) {
  return <Embed url={media.url} platform={media.platform} {...props} />;
}

// =============================================================================
// Re-export platform components for direct use
// =============================================================================

export { TwitterEmbed, extractTweetId, isTwitterUrl } from "./twitter";
export { InstagramEmbed, extractInstagramId, isInstagramUrl } from "./instagram";
export { TikTokEmbed, extractTikTokId, isTikTokUrl } from "./tiktok";
