"use client";

/**
 * Video Component
 *
 * Router component for video embeds.
 * Dispatches to platform-specific implementations based on the platform prop.
 *
 * Platform-specific logic is colocated in:
 * - ./youtube.tsx
 * - ./bilibili.tsx
 * - ./vimeo.tsx
 */

import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import type { VideoMedia, VideoPlatform } from "@/lib/log";
import { YouTubeEmbed, extractYouTubeId } from "./youtube";
import { BilibiliEmbed, extractBilibiliId } from "./bilibili";
import { VimeoEmbed, extractVimeoId } from "./vimeo";

// =============================================================================
// Types
// =============================================================================

export interface VideoProps {
  /** Video URL */
  url: string;
  /** Video platform */
  platform: VideoPlatform;
  /** Optional thumbnail URL (YouTube only) */
  thumbnail?: string;
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
  /** Hand off playback to the immersive theater / PiP player instead of inline. */
  onPlay?: () => void;
  /** The cover's chip size — see the platform facades. */
  chip?: "mini" | "compact" | "default";
}

export interface VideoPropsFromMedia {
  media: VideoMedia;
  size?: "compact" | "default" | "large";
  className?: string;
}

// =============================================================================
// Platform Detection
// =============================================================================

/**
 * Detect video platform from URL
 */
export function detectVideoPlatform(url: string): VideoPlatform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return "youtube";
    }
    if (hostname.includes("bilibili.com")) {
      return "bilibili";
    }
    if (hostname.includes("vimeo.com")) {
      return "vimeo";
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract video ID for any supported platform
 */
export function extractVideoId(url: string, platform: VideoPlatform): string | null {
  switch (platform) {
    case "youtube":
      return extractYouTubeId(url);
    case "bilibili":
      return extractBilibiliId(url);
    case "vimeo":
      return extractVimeoId(url);
    default:
      return null;
  }
}

// =============================================================================
// Main Component
// =============================================================================

export function Video({
  url,
  platform,
  thumbnail,
  size = "default",
  className,
  onPlay,
  chip,
}: VideoProps) {
  // Route to platform-specific implementation
  switch (platform) {
    case "youtube":
      return (
        <YouTubeEmbed
          url={url}
          thumbnail={thumbnail}
          size={size}
          className={className}
          onPlay={onPlay}
          chip={chip}
        />
      );
    case "bilibili":
      return (
        <BilibiliEmbed
          url={url}
          thumbnail={thumbnail}
          size={size}
          className={className}
          onPlay={onPlay}
          chip={chip}
        />
      );
    case "vimeo":
      return (
        <VimeoEmbed
          url={url}
          thumbnail={thumbnail}
          size={size}
          className={className}
          onPlay={onPlay}
          chip={chip}
        />
      );
    default:
      // Unknown platform - render fallback link
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
}

/**
 * Convenience wrapper that accepts VideoMedia directly
 */
export function VideoFromMedia({ media, ...props }: VideoPropsFromMedia) {
  return (
    <Video
      url={media.url}
      platform={media.platform}
      thumbnail={media.thumbnail}
      {...props}
    />
  );
}

// =============================================================================
// Re-export platform components for direct use
// =============================================================================

export { YouTubeEmbed, extractYouTubeId } from "./youtube";
export { BilibiliEmbed, extractBilibiliId } from "./bilibili";
export { VimeoEmbed, extractVimeoId } from "./vimeo";
