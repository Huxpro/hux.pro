"use client";

/**
 * Vimeo Embed
 *
 * Click-to-play video embed for Vimeo videos.
 * Shows thumbnail preview before loading the iframe.
 */

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { ExternalImage } from "./external-image";

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
  /** Hand off playback to the immersive theater / PiP player instead of inline. */
  onPlay?: () => void;
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
  onPlay,
}: VimeoEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
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

  const sizeClasses = {
    compact: "max-w-md",
    default: "",
    large: "max-w-4xl",
  };

  // Show thumbnail with play button (click-to-play pattern)
  if (!isPlaying) {
    return (
      <button
        type="button"
        onClick={() => (onPlay ? onPlay() : setIsPlaying(true))}
        className={cn(
          "relative w-full aspect-video rounded-lg overflow-hidden",
          "bg-muted/20 border border-border/50",
          "group cursor-pointer",
          sizeClasses[size],
          className
        )}
        aria-label="Play Vimeo video"
      >
        <ExternalImage
          src={thumbnailUrl}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="w-16 h-16 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-black/50 transition-all">
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </div>
        </div>
      </button>
    );
  }

  // Show embedded player after click
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
        title="Vimeo video player"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}
