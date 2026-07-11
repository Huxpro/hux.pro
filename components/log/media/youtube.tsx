"use client";

/**
 * YouTube Embed
 *
 * Click-to-play video embed using youtube-nocookie.com for privacy.
 * Supports thumbnail preview before loading the iframe.
 */

import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExternalImage } from "./external-image";
import { PlayableVideoEmbed } from "./playable-embed";

// =============================================================================
// Types
// =============================================================================

export interface YouTubeEmbedProps {
  /** YouTube video URL or video ID */
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
 * Extract video ID from various YouTube URL formats
 */
export function extractYouTubeId(url: string): string | null {
  // If it's already just an ID (no slashes or dots)
  if (/^[\w-]{11}$/.test(url)) {
    return url;
  }

  try {
    const urlObj = new URL(url);

    // youtu.be/VIDEO_ID
    if (urlObj.hostname.includes("youtu.be")) {
      return urlObj.pathname.slice(1).split("?")[0] || null;
    }

    // youtube.com/watch?v=VIDEO_ID
    if (urlObj.pathname.includes("/watch")) {
      return urlObj.searchParams.get("v");
    }

    // youtube.com/embed/VIDEO_ID
    if (urlObj.pathname.includes("/embed/")) {
      return urlObj.pathname.split("/embed/")[1]?.split("?")[0] || null;
    }

    // youtube.com/shorts/VIDEO_ID
    if (urlObj.pathname.includes("/shorts/")) {
      return urlObj.pathname.split("/shorts/")[1]?.split("?")[0] || null;
    }

    // youtube.com/v/VIDEO_ID
    if (urlObj.pathname.includes("/v/")) {
      return urlObj.pathname.split("/v/")[1]?.split("?")[0] || null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get YouTube thumbnail URL
 */
function getThumbnailUrl(videoId: string, customThumbnail?: string): string {
  if (customThumbnail) return customThumbnail;
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Get embed URL with privacy-friendly domain
 * Muted by default, user can unmute after interaction
 */
function getEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&mute=1`;
}

// =============================================================================
// Component
// =============================================================================

export function YouTubeEmbed({
  url,
  thumbnail,
  size = "default",
  className,
}: YouTubeEmbedProps) {
  const videoId = extractYouTubeId(url);

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
          className
        )}
      >
        <Play className="w-8 h-8 text-muted-foreground" />
      </a>
    );
  }

  const thumbnailUrl = getThumbnailUrl(videoId, thumbnail);

  return (
    <PlayableVideoEmbed
      embedUrl={getEmbedUrl(videoId)}
      title="YouTube video player"
      label="Play YouTube video"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
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
