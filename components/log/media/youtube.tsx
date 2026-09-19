"use client";

/**
 * YouTube Embed
 *
 * Click-to-play video embed using youtube-nocookie.com for privacy.
 * Supports thumbnail preview before loading the iframe.
 */

import { useState } from "react";
import { COVER_WASH_TINTED } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { ExternalImage } from "./external-image";
import { Play } from "lucide-react";
import { MediaMark, videoMark } from "./media-mark";

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
  /**
   * When provided, clicking the cover invokes this instead of playing inline —
   * used to hand off playback to the immersive theater / PiP player.
   */
  onPlay?: () => void;
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
export function getEmbedUrl(videoId: string): string {
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
  onPlay,
}: YouTubeEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
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

  const sizeClasses = {
    compact: "max-w-md",
    default: "",
    large: "max-w-4xl",
  };

  // Show thumbnail with play button
  if (!isPlaying) {
    return (
      <button
        type="button"
        onClick={() => (onPlay ? onPlay() : setIsPlaying(true))}
        className={cn(
          "relative w-full aspect-video rounded-lg overflow-hidden",
          "bg-muted/20 border border-border/50",
          "group/thumb pressable cursor-pointer",
          sizeClasses[size],
          className
        )}
        aria-label="Play YouTube video"
      >
        <ExternalImage
          src={thumbnailUrl}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* The cover wears its chip — the platform — the way every cover on the
            site does (media-mark.tsx). COVER_WASH is the iOS press affordance. */}
        <div className={COVER_WASH_TINTED} />
        <MediaMark mark={videoMark("youtube")} />
      </button>
    );
  }

  // Show embedded player
  return (
    <div
      className={cn(
        "relative w-full aspect-video rounded-lg overflow-hidden bg-black",
        sizeClasses[size],
        className
      )}
    >
      <iframe
        src={getEmbedUrl(videoId)}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
