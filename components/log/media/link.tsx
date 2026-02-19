"use client";

/**
 * Link Component
 *
 * External link rendering with optional OG preview.
 * - Link: Simple icon + text link
 * - LinkPreview: Full card with OG image, title, description
 */

import { useState, useEffect } from "react";
import { ExternalLink as ExternalLinkIcon, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchOGData, type OGData } from "@/lib/og";
import type { LinkMedia } from "@/lib/log";

// =============================================================================
// Types
// =============================================================================

export interface LinkProps {
  /** Link URL */
  url: string;
  /** Label text (defaults to domain) */
  label?: string;
  /** Icon name (lucide icon) */
  icon?: string;
  /** Additional CSS classes */
  className?: string;
}

export interface LinkPreviewProps {
  /** Link URL */
  url: string;
  /** Override title (skips OG fetch for title) */
  title?: string;
  /** Override description */
  description?: string;
  /** Override image URL */
  image?: string;
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

export interface LinkPropsFromMedia {
  media: LinkMedia;
  className?: string;
}

export interface LinkPreviewPropsFromMedia {
  media: LinkMedia;
  size?: "compact" | "default" | "large";
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// =============================================================================
// Simple Link Component
// =============================================================================

export function Link({ url, label, icon, className }: LinkProps) {
  const displayLabel = label || getDomain(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1.5",
        "text-sm text-muted-foreground hover:text-foreground",
        "transition-colors",
        className
      )}
    >
      <span className="truncate">{displayLabel}</span>
      <ExternalLinkIcon className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
    </a>
  );
}

// =============================================================================
// Link Preview Component (with OG data)
// =============================================================================

export function LinkPreview({
  url,
  title: titleOverride,
  description: descOverride,
  image: imageOverride,
  size = "default",
  className,
}: LinkPreviewProps) {
  const [ogData, setOgData] = useState<OGData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Skip fetch if all data is provided
    if (titleOverride && imageOverride) {
      setOgData({
        url,
        title: titleOverride,
        description: descOverride,
        image: imageOverride,
      });
      setIsLoading(false);
      return;
    }

    const loadOgData = async () => {
      try {
        const data = await fetchOGData(url);
        setOgData({
          ...data,
          title: titleOverride || data.title,
          description: descOverride || data.description,
          image: imageOverride || data.image,
        });
      } catch (error) {
        console.error("OG fetch error:", error);
        setHasError(true);
        // Still set basic data
        setOgData({
          url,
          title: titleOverride || getDomain(url),
          description: descOverride,
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadOgData();
  }, [url, titleOverride, descOverride, imageOverride]);

  const sizeClasses = {
    compact: "max-w-sm",
    default: "max-w-lg",
    large: "max-w-2xl",
  };

  const domain = getDomain(url);
  const title = ogData?.title || domain;
  const description = ogData?.description;
  const image = ogData?.image;

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/50 bg-muted/5 overflow-hidden animate-pulse",
          sizeClasses[size],
          className
        )}
      >
        <div className="aspect-[2/1] bg-muted/20" />
        <div className="p-4 space-y-2">
          <div className="h-4 bg-muted/30 rounded w-3/4" />
          <div className="h-3 bg-muted/20 rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block rounded-lg border border-border/50 bg-muted/5 overflow-hidden",
        "hover:bg-muted/10 hover:border-border/70 transition-colors",
        sizeClasses[size],
        className
      )}
    >
      {/* Image */}
      {image ? (
        <div className="aspect-[2/1] bg-muted/20 overflow-hidden">
          <img
            src={image}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      ) : (
        <div className="aspect-[2/1] bg-muted/10 flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-1">
        <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide">
          {domain}
        </div>
        <h4 className="text-sm font-medium text-foreground line-clamp-2">{title}</h4>
        {description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
        )}
      </div>
    </a>
  );
}

/**
 * Convenience wrapper for LinkMedia
 */
export function LinkFromMedia({ media, className }: LinkPropsFromMedia) {
  return (
    <Link url={media.url} label={media.label} icon={media.icon} className={className} />
  );
}

/**
 * Convenience wrapper for LinkMedia with preview
 */
export function LinkPreviewFromMedia({
  media,
  size,
  className,
}: LinkPreviewPropsFromMedia) {
  return <LinkPreview url={media.url} size={size} className={className} />;
}
