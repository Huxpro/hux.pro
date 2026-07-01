"use client";

/**
 * Figure Component
 *
 * Static image display for commits. Uses Next.js Image for optimization.
 */

import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { MEDIA_MAX_W } from "./sizes";
import type { ImageMedia } from "@/lib/log";

// =============================================================================
// Types
// =============================================================================

export interface FigureProps {
  /** Image URL */
  url: string;
  /** Alt text */
  alt?: string;
  /** Aspect ratio */
  aspectRatio?: "auto" | "video" | "square" | "portrait";
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

export interface FigurePropsFromMedia {
  media: ImageMedia;
  aspectRatio?: "auto" | "video" | "square" | "portrait";
  size?: "compact" | "default" | "large";
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function Figure({
  url,
  alt = "",
  aspectRatio = "auto",
  size = "default",
  className,
}: FigureProps) {
  const sizeClasses = MEDIA_MAX_W;

  const aspectClasses = {
    auto: "",
    video: "aspect-video",
    square: "aspect-square",
    portrait: "aspect-[3/4]",
  };

  return (
    <figure
      className={cn(
        "relative rounded-lg overflow-hidden bg-muted/10",
        aspectClasses[aspectRatio],
        sizeClasses[size],
        className
      )}
    >
      <NextImage
        src={url}
        alt={alt}
        fill={aspectRatio !== "auto"}
        width={aspectRatio === "auto" ? 800 : undefined}
        height={aspectRatio === "auto" ? 600 : undefined}
        className={cn(
          "object-cover",
          aspectRatio === "auto" && "!relative !h-auto !w-full"
        )}
        unoptimized={url.startsWith("http")}
      />
    </figure>
  );
}

/**
 * Convenience wrapper that accepts ImageMedia directly
 */
export function FigureFromMedia({ media, ...props }: FigurePropsFromMedia) {
  return <Figure url={media.url} alt={media.alt} {...props} />;
}

