"use client";

/**
 * MediaRenderer
 *
 * Orchestrates rendering of Media array attached to commits.
 * Automatically dispatches to Video, Embed, Link, or Figure components
 * based on the media type.
 */

import { cn } from "@/lib/utils";
import { useTheme } from "@/services/theme";
import type {
  Media,
  EmbedMedia,
  LinkMedia,
} from "@/lib/log";
import {
  isVideoMedia,
  isEmbedMedia,
  isLinkMedia,
  isImageMedia,
} from "@/lib/log";
import { Video } from "./video";
import { Embed } from "./embed";
import { Link, LinkPreview } from "./link";
import { Figure } from "./image";

// =============================================================================
// Types
// =============================================================================

export interface MediaRendererProps {
  /** Array of media items to render */
  media: Media[];
  /** Theme for embeds */
  theme?: "light" | "dark";
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Layout direction */
  layout?: "stack" | "inline" | "grid";
  /** Whether to show previews for links */
  showLinkPreviews?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface SingleMediaProps {
  media: Media;
  theme: "light" | "dark";
  size: "compact" | "default" | "large";
  showLinkPreviews: boolean;
  /** Forwarded to the underlying renderer (e.g. to size a grid cell). */
  className?: string;
}

// =============================================================================
// Single Media Dispatcher
// =============================================================================

function SingleMedia({
  media,
  theme,
  size,
  showLinkPreviews,
  className,
}: SingleMediaProps) {
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

  if (isEmbedMedia(media)) {
    return (
      <Embed
        url={media.url}
        platform={media.platform}
        theme={theme}
        size={size}
        preview={media.preview}
        className={className}
      />
    );
  }

  if (isLinkMedia(media)) {
    if (showLinkPreviews && media.showPreview !== false) {
      return (
        <LinkPreview
          url={media.url}
          size={size}
          title={media.preview?.title}
          description={media.preview?.description}
          image={media.preview?.image}
          className={className}
        />
      );
    }
    return <Link url={media.url} label={media.label} icon={media.icon} className={className} />;
  }

  if (isImageMedia(media)) {
    return <Figure url={media.url} alt={media.alt} size={size} />;
  }

  // Unknown type - shouldn't happen with strict typing
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
  showLinkPreviews = true,
  className,
}: MediaRendererProps) {
  // Use site theme from context, allow prop override
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

  // Separate links from rich media for better layout.
  // Embeds are split out from players (video/image): when a commit carries
  // more than one embed, they tile side-by-side in a row (collapsing to a
  // single column when the container is narrow) instead of stacking
  // vertically. Players keep the vertical stack.
  const embeds = media.filter(isEmbedMedia) as EmbedMedia[];
  const players = media.filter(
    (m) => isVideoMedia(m) || isImageMedia(m)
  );
  const links = media.filter(isLinkMedia) as LinkMedia[];
  const hasRichMedia = embeds.length > 0 || players.length > 0;

  // If only links, render them inline
  if (!hasRichMedia && links.length > 0) {
    return (
      <div className={cn("flex flex-wrap gap-3", className)}>
        {links.map((link, i) => (
          <SingleMedia
            key={`link-${i}`}
            media={link}
            theme={theme}
            size={size}
            showLinkPreviews={showLinkPreviews}
          />
        ))}
      </div>
    );
  }

  const multipleEmbeds = embeds.length > 1;

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {/* Players (video / image) — vertical stack */}
      {players.map((m, i) => (
        <SingleMedia
          key={`player-${i}`}
          media={m}
          theme={theme}
          size={size}
          showLinkPreviews={showLinkPreviews}
        />
      ))}

      {/* Embeds — tiled two-up on every screen (incl. mobile) when >1 */}
      {embeds.length > 0 && (
        <div>
          <div
            className={cn(
              // grid default `items-stretch` keeps tiled cards equal height
              multipleEmbeds && "grid grid-cols-2 gap-2.5"
            )}
          >
            {embeds.map((m, i) => (
              <SingleMedia
                key={`embed-${i}`}
                media={m}
                theme={theme}
                size={multipleEmbeds ? "compact" : size}
                showLinkPreviews={showLinkPreviews}
                className={multipleEmbeds ? "w-full max-w-none" : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Links at the end */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {links.map((link, i) => (
            <SingleMedia
              key={`link-${i}`}
              media={link}
              theme={theme}
              size={size}
              showLinkPreviews={showLinkPreviews}
            />
          ))}
        </div>
      )}
    </div>
  );
}
