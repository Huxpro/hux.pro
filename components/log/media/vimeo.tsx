"use client";

/**
 * Vimeo Embed
 *
 * Click-to-play video embed for Vimeo videos.
 * Shows thumbnail preview before loading the iframe.
 */

import { cn } from "@/lib/utils";
import { ExternalImage } from "./external-image";
import { PlayableVideoEmbed } from "./playable-embed";

// =============================================================================
// Types
// =============================================================================

export interface VimeoEmbedProps {
  /** Vimeo video URL or video ID */
  url: string;
  /** Optional custom thumbnail URL */
  thumbnail?: string;
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract video ID from Vimeo URL
 */
export function extractVimeoId(url: string): string | null {
  // If it's already just a numeric ID
  if (/^\d+$/.test(url)) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/(\d+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Get Vimeo thumbnail URL
 */
function getThumbnailUrl(videoId: string, customThumbnail?: string): string {
  if (customThumbnail) return customThumbnail;
  // Vimeo requires an API call to get thumbnails, use placeholder
  return `https://vumbnail.com/${videoId}.jpg`;
}

/**
 * Get Vimeo embed URL
 * Muted by default with autoplay after user click
 */
function getEmbedUrl(videoId: string): string {
  return `https://player.vimeo.com/video/${videoId}?autoplay=1&muted=1`;
}

// =============================================================================
// Component
// =============================================================================

export function VimeoEmbed({
  url,
  thumbnail,
  size = "default",
  className,
}: VimeoEmbedProps) {
  const videoId = extractVimeoId(url);

  if (!videoId) {
    // Invalid URL - render fallback link
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "block aspect-video bg-muted/20 rounded-lg flex items-center justify-center",
          "border border-border/50 hover:bg-muted/30 transition-colors",
          "text-sm text-muted-foreground",
          className
        )}
      >
        View on Vimeo →
      </a>
    );
  }

  const thumbnailUrl = getThumbnailUrl(videoId, thumbnail);

  return (
    <PlayableVideoEmbed
      embedUrl={getEmbedUrl(videoId)}
      title="Vimeo video player"
      label="Play Vimeo video"
      allow="autoplay; fullscreen; picture-in-picture"
      size={size}
      className={className}
      cover={
        <ExternalImage
          src={thumbnailUrl}
          className="absolute inset-0 w-full h-full object-cover"
        />
      }
    />
  );
}
