"use client";

/**
 * MediaThumbnail Component
 *
 * Renders a thumbnail image for a media item.
 * Wraps in a link if href is provided.
 * Gracefully handles YouTube maxresdefault → hqdefault fallback.
 */

import { cn } from "@/lib/utils";
import type { Media } from "@/lib/log";
import { getMediaThumbnail } from "@/lib/log";
import { ExternalImage } from "./external-image";

// =============================================================================
// Types
// =============================================================================

export interface MediaThumbnailProps {
  /** The media item to render a thumbnail for */
  media: Media;
  /** Optional link URL to wrap the thumbnail */
  href?: string;
  /** Alt text for the image */
  alt?: string;
  /** Aspect ratio class (defaults to video 16:9) */
  aspectRatio?: "video" | "square" | "portrait" | "auto";
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function MediaThumbnail({
  media,
  href,
  alt = "",
  aspectRatio = "video",
  className,
}: MediaThumbnailProps) {
  const thumbnailUrl = getMediaThumbnail(media);

  if (!thumbnailUrl) return null;

  const aspectClasses = {
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
    auto: "",
  };

  const inner = (
    <ExternalImage
      src={thumbnailUrl}
      alt={alt}
      className="w-full h-full object-cover"
    />
  );

  const wrapperClass = cn(
    "block w-full overflow-hidden rounded-lg bg-muted/20 border border-border/50",
    aspectClasses[aspectRatio],
    className
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(wrapperClass, "hover:border-border transition-colors")}
      >
        {inner}
      </a>
    );
  }

  return <div className={wrapperClass}>{inner}</div>;
}
