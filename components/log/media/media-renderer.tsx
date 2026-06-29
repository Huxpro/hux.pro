"use client";

/**
 * MediaRenderer
 *
 * Orchestrates rendering of a commit's Media array. Each item routes to its
 * kind-specific component, then we layout by *pinned-ness* (pinned items
 * hoist above the row's expanded block) and by visual family (cards / widgets
 * tile two-up when there are multiple; players stack vertically; pills
 * collapse into a chip row at the end).
 */

import { cn } from "@/lib/utils";
import { useTheme } from "@/services/theme";
import type { Media } from "@/lib/log";
import {
  isVideoMedia,
  isSocialEmbedMedia,
  isLinkMedia,
  isLinkCard,
  isLinkPill,
  isImageMedia,
} from "@/lib/log";
import { Video } from "./video";
import { SocialEmbed } from "./embed";
import { Link, LinkCard } from "./link";
import { Figure } from "./image";

// =============================================================================
// Types
// =============================================================================

export interface MediaRendererProps {
  /** Array of media items to render. */
  media: Media[];
  /** Theme for social embeds. */
  theme?: "light" | "dark";
  /** Size variant. */
  size?: "compact" | "default" | "large";
  /** Layout direction. */
  layout?: "stack" | "inline" | "grid";
  /** Additional CSS classes. */
  className?: string;
}

interface SingleMediaProps {
  media: Media;
  theme: "light" | "dark";
  size: "compact" | "default" | "large";
  /** Forwarded to the underlying renderer (e.g. to size a grid cell). */
  className?: string;
}

// =============================================================================
// Single Media Dispatcher
// =============================================================================

function SingleMedia({ media, theme, size, className }: SingleMediaProps) {
  if (isVideoMedia(media)) {
    return (
      <Video
        url={media.url}
        platform={media.platform}
        thumbnail={media.thumbnail}
        size={size}
      />
    );
  }

  if (isSocialEmbedMedia(media)) {
    return (
      <SocialEmbed
        url={media.url}
        platform={media.platform}
        theme={theme}
        size={size}
        className={className}
      />
    );
  }

  if (isLinkMedia(media)) {
    if (media.present === "card") {
      return (
        <LinkCard
          url={media.url}
          size={size}
          title={media.preview?.title}
          description={media.preview?.description}
          image={media.preview?.image}
          className={className}
        />
      );
    }
    return (
      <Link
        url={media.url}
        label={media.label}
        icon={media.icon}
        className={className}
      />
    );
  }

  if (isImageMedia(media)) {
    return <Figure url={media.url} alt={media.alt} size={size} />;
  }

  // Exhaustive — should be unreachable under the discriminated union.
  return null;
}

// =============================================================================
// Main Component
// =============================================================================

export function MediaRenderer({
  media,
  theme: themeProp,
  size = "default",
  layout = "stack",
  className,
}: MediaRendererProps) {
  // Use site theme from context, allow prop override.
  const { theme: siteTheme } = useTheme();
  const theme = themeProp ?? siteTheme;
  if (!media || media.length === 0) {
    return null;
  }

  const layoutClasses = {
    stack: "flex flex-col gap-4",
    inline: "flex flex-row flex-wrap gap-3 items-start",
    grid: "grid grid-cols-1 md:grid-cols-2 gap-4",
  };

  // Partition by visual family. Cards (kind:link + present:card) and social
  // widgets tile side-by-side when multiple; players (video / image) stack
  // vertically; pills collapse into a chip row at the end. Pre-resolved by
  // commit-data into the right buckets via the pinned flag.
  const cards = media.filter((m) => isLinkCard(m) || isSocialEmbedMedia(m));
  const players = media.filter((m) => isVideoMedia(m) || isImageMedia(m));
  const pills = media.filter(isLinkPill);
  const hasRichMedia = cards.length > 0 || players.length > 0;

  // Pill-only renderings: inline chip row, no surrounding layout box.
  if (!hasRichMedia && pills.length > 0) {
    return (
      <div className={cn("flex flex-wrap gap-3", className)}>
        {pills.map((m, i) => (
          <SingleMedia
            key={`pill-${i}`}
            media={m}
            theme={theme}
            size={size}
          />
        ))}
      </div>
    );
  }

  const multipleCards = cards.length > 1;

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {/* Players (video / image) — vertical stack. */}
      {players.map((m, i) => (
        <SingleMedia
          key={`player-${i}`}
          media={m}
          theme={theme}
          size={size}
        />
      ))}

      {/* Cards (link-cards + social widgets) — tile two-up when >1. */}
      {cards.length > 0 && (
        <div>
          <div
            className={cn(
              // grid default `items-stretch` keeps tiled cards equal height.
              multipleCards && "grid grid-cols-2 gap-2.5",
            )}
          >
            {cards.map((m, i) => (
              <SingleMedia
                key={`card-${i}`}
                media={m}
                theme={theme}
                size={multipleCards ? "compact" : size}
                className={multipleCards ? "w-full max-w-none" : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pills at the end. */}
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {pills.map((m, i) => (
            <SingleMedia
              key={`pill-${i}`}
              media={m}
              theme={theme}
              size={size}
            />
          ))}
        </div>
      )}
    </div>
  );
}
