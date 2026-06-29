"use client";

/**
 * Link rendering — two presentations for the same data shape (kind:"link"):
 *
 * - Link:     a pill — icon + text + external-link glyph. Used as the folded
 *             rail indicator and as the inline chip in the expanded view.
 * - LinkCard: an OG-style card with image, title, and description. Backed by
 *             the card pipeline (manual preview > og-snapshot > live crawl).
 */

import { useState, useEffect } from "react";
import { ExternalLink as ExternalLinkIcon, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchOGData } from "@/lib/og";
import type { OGData } from "@/lib/og-core";
import { getDomainLabel, isArchivedUrl } from "@/lib/og-core";
import type { LinkMedia } from "@/lib/log";
import { ExternalImage } from "./external-image";

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

export interface LinkCardProps {
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
  /**
   * Tile-density hint. When true (set by MediaRenderer for the 2-up grid):
   *  - Description is hidden on mobile and revealed at `sm` and up.
   *  - Title gets an extra line on mobile to soak up the freed vertical
   *    space, so it doesn't get eclipsed at narrow widths.
   * Non-mobile layouts are unchanged.
   */
  dense?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface LinkPropsFromMedia {
  media: LinkMedia;
  className?: string;
}

export interface LinkCardPropsFromMedia {
  media: LinkMedia;
  size?: "compact" | "default" | "large";
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================


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
  const displayLabel = label || getDomainLabel(url);

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
// CardFace — presentational cover + caption + title block.
// Shared between the expanded `LinkCard` on /works and the `PeekCard` in the
// hover deck. `fixedAspect` exists because stacked peeks need predictable
// rectangles for their layered transforms; expanded cards prefer natural
// aspect so any publisher's OG image renders whole.
// =============================================================================

type CardFaceSize = "compact" | "default" | "large";

export interface CardFaceProps {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  size?: CardFaceSize;
  /**
   * Pin the image to a fixed `aspect-[2/1]` slot with a blurred backdrop of
   * the same image filling any letterbox. Use for stacked layouts where the
   * layered transforms need predictable rectangles. Default: false (natural
   * aspect, no backdrop — the image's intrinsic dimensions size the slot).
   */
  fixedAspect?: boolean;
  /** See `LinkCardProps.dense`. */
  dense?: boolean;
  className?: string;
  /** Fires when the foreground image resolves (load / cache-warm / error). */
  onImgResolved?: () => void;
}

const sizeMaxW: Record<CardFaceSize, string> = {
  compact: "max-w-sm",
  default: "max-w-lg",
  large: "max-w-2xl",
};

export function CardFace({
  url,
  title,
  description,
  image,
  size = "default",
  fixedAspect = false,
  dense = false,
  className,
  onImgResolved,
}: CardFaceProps) {
  const compact = size === "compact";
  const domain = getDomainLabel(url);
  const [imgLoaded, setImgLoaded] = useState(false);
  const handleResolved = () => {
    setImgLoaded(true);
    onImgResolved?.();
  };
  const fadeClass = cn(
    "transition-opacity duration-500 ease-out",
    imgLoaded ? "opacity-100" : "opacity-0",
  );

  let slot: React.ReactNode;
  if (!image) {
    slot = (
      <div className="aspect-[2/1] bg-muted/10 flex items-center justify-center shrink-0">
        <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
      </div>
    );
  } else if (fixedAspect) {
    // Backdrop is the same image, scaled up and heavily blurred so non-2:1
    // aspects don't pin a hard letterbox against the card background.
    slot = (
      <div className="relative aspect-[2/1] bg-muted/20 overflow-hidden shrink-0">
        <ExternalImage
          src={image}
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-60"
        />
        <ExternalImage
          src={image}
          className={cn("relative w-full h-full object-contain", fadeClass)}
          loading="eager"
          onResolved={handleResolved}
        />
      </div>
    );
  } else {
    slot = (
      <div className="bg-muted/20 overflow-hidden shrink-0">
        <ExternalImage
          src={image}
          className={cn("block w-full h-auto", fadeClass)}
          onResolved={handleResolved}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-border/50 bg-muted/5 overflow-hidden",
        sizeMaxW[size],
        className,
      )}
    >
      {slot}
      <div className={cn("flex-1 space-y-1", compact ? "p-2.5" : "p-4")}>
        <div
          className={cn(
            "flex items-center gap-1.5",
            "text-muted-foreground font-mono uppercase tracking-wide",
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          <span className="truncate">{domain}</span>
          {isArchivedUrl(url) && (
            // Restrained tag — reuses the existing domain-row typography so
            // it sits on the same baseline; a hair-thin border keeps it
            // distinct from the domain without shouting.
            <span
              className={cn(
                "inline-flex items-center shrink-0",
                "px-1.5 py-px rounded-sm border border-border/60",
                "text-[10px] leading-none text-muted-foreground/90",
              )}
              title="Snapshot served via the Wayback Machine"
            >
              Archived
            </span>
          )}
        </div>
        <h4
          className={cn(
            "font-medium text-foreground",
            // Dense tiles hide the description on mobile, so the title is
            // allowed to flow to 3 lines below `sm` to soak up the room.
            dense ? "line-clamp-3 sm:line-clamp-2" : "line-clamp-2",
            compact ? "text-xs leading-snug" : "text-sm",
          )}
        >
          {title || domain}
        </h4>
        {description && (
          <p
            className={cn(
              "text-muted-foreground line-clamp-2",
              compact ? "text-[11px] leading-snug" : "text-xs",
              // Dense tiles drop description on mobile to reduce visual
              // noise when two cards stand side-by-side at narrow widths.
              dense && "hidden sm:block",
            )}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Link Preview Component (with OG data)
// =============================================================================

export function LinkCard({
  url,
  title: titleOverride,
  description: descOverride,
  image: imageOverride,
  size = "default",
  dense = false,
  className,
}: LinkCardProps) {
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
          title: titleOverride || getDomainLabel(url),
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

  if (isLoading) {
    return (
      <div
        className={cn(
          "flex flex-col h-full rounded-lg border border-border/50 bg-muted/5 overflow-hidden animate-pulse",
          sizeMaxW[size],
          className,
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

  // Wrapper owns the `block` + clickability; CardFace owns the card geometry
  // (including `h-full` so it stretches to fill the anchor in tiled grids).
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block">
      <CardFace
        url={url}
        title={ogData?.title}
        description={ogData?.description}
        image={ogData?.image}
        size={size}
        dense={dense}
        className={cn(
          "h-full hover:bg-muted/10 hover:border-border/70 transition-colors",
          className,
        )}
      />
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
export function LinkCardFromMedia({
  media,
  size,
  className,
}: LinkCardPropsFromMedia) {
  return <LinkCard url={media.url} size={size} className={className} />;
}
