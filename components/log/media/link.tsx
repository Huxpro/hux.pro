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

/**
 * Stale-while-revalidate drift check (opt-in via NEXT_PUBLIC_OG_REVALIDATE=1).
 *
 * The card has already painted from the snapshot/manual preview ("stale");
 * here we crawl live in the background ("revalidate") and warn if the live
 * result differs, so you know to regenerate the snapshot (`pnpm og:snapshot`)
 * — i.e. "invalidate the cache". Off by default to keep dev/prod fast and
 * non-flaky. Crawl-blocked sites (Medium) simply fail the live fetch and are
 * skipped silently.
 */
async function revalidateAgainstLive(
  url: string,
  shown: { title?: string; description?: string; image?: string },
): Promise<void> {
  try {
    const live = await fetchOGData(url);
    if (!live.title && !live.image) return; // couldn't crawl — nothing to compare
    const diffs = (["title", "description", "image"] as const).filter(
      (k) => (live[k] || "") !== (shown[k] || ""),
    );
    if (diffs.length) {
      console.warn(
        `[og] snapshot looks stale for ${url} (differs: ${diffs.join(", ")}). ` +
          `Run \`pnpm og:snapshot\` to refresh.`,
        { shown, live: { title: live.title, description: live.description, image: live.image } },
      );
    }
  } catch {
    // Network/crawl failure — can't compare; leave the snapshot as-is.
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
  // When a preview is already resolved (manual override or build-time
  // snapshot, baked in server-side), seed state synchronously so the card
  // paints immediately — no skeleton flash, no request-time crawl.
  const hasResolvedPreview = !!(titleOverride && imageOverride);
  const [ogData, setOgData] = useState<OGData | null>(
    hasResolvedPreview
      ? {
          url,
          title: titleOverride,
          description: descOverride,
          image: imageOverride,
        }
      : null,
  );
  const [isLoading, setIsLoading] = useState(!hasResolvedPreview);
  // Fade the OG image in once it decodes, so a slow origin (e.g. web.dev's,
  // which has high TTFB and no image CDN) reveals smoothly instead of popping.
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    // Resolved preview: nothing to fetch on the critical path. Optionally
    // revalidate against the live crawl (opt-in) to flag a stale snapshot.
    if (hasResolvedPreview) {
      if (process.env.NEXT_PUBLIC_OG_REVALIDATE === "1") {
        revalidateAgainstLive(url, {
          title: titleOverride,
          description: descOverride,
          image: imageOverride,
        });
      }
      return;
    }

    // No resolved preview (e.g. a brand-new link not yet snapshotted):
    // fall back to a live crawl so dev still "just works".
    let cancelled = false;
    const loadOgData = async () => {
      try {
        const data = await fetchOGData(url);
        if (cancelled) return;
        setOgData({
          ...data,
          title: titleOverride || data.title,
          description: descOverride || data.description,
          image: imageOverride || data.image,
        });
      } catch (error) {
        if (cancelled) return;
        console.error("OG fetch error:", error);
        setOgData({
          url,
          title: titleOverride || getDomain(url),
          description: descOverride,
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadOgData();
    return () => {
      cancelled = true;
    };
  }, [url, titleOverride, descOverride, imageOverride, hasResolvedPreview]);

  const sizeClasses = {
    compact: "max-w-sm",
    default: "max-w-lg",
    large: "max-w-2xl",
  };

  const domain = getDomain(url);
  const title = ogData?.title || domain;
  const description = ogData?.description;
  const image = ogData?.image;
  const compact = size === "compact";

  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col h-full rounded-lg border border-border/50 bg-muted/5 overflow-hidden animate-pulse",
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
        // flex column + h-full lets cards stretch to equal heights when
        // tiled in a grid row; the content area absorbs the extra space.
        "flex flex-col h-full rounded-lg border border-border/50 bg-muted/5 overflow-hidden",
        "hover:bg-muted/10 hover:border-border/70 transition-colors",
        sizeClasses[size],
        className
      )}
    >
      {/* Image — fades in on load over a muted placeholder */}
      {image ? (
        <div className="aspect-[2/1] bg-muted/20 overflow-hidden shrink-0">
          <img
            src={image}
            alt=""
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            // Catch images already warm in the browser cache, whose `load`
            // may fire before React attaches the handler.
            ref={(node) => {
              if (node?.complete) setImgLoaded(true);
            }}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-500 ease-out",
              imgLoaded ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      ) : (
        <div className="aspect-[2/1] bg-muted/10 flex items-center justify-center shrink-0">
          <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
        </div>
      )}

      {/* Content — tighter padding/type in compact so two cards fit a phone row */}
      <div className={cn("flex-1 space-y-1", compact ? "p-2.5" : "p-4")}>
        <div
          className={cn(
            "text-muted-foreground font-mono uppercase tracking-wide",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          {domain}
        </div>
        <h4
          className={cn(
            "font-medium text-foreground line-clamp-2",
            compact ? "text-xs leading-snug" : "text-sm",
          )}
        >
          {title}
        </h4>
        {description && (
          <p
            className={cn(
              "text-muted-foreground line-clamp-2",
              compact ? "text-[11px] leading-snug" : "text-xs",
            )}
          >
            {description}
          </p>
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
