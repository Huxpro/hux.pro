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
  VideoMedia,
  EmbedMedia,
  LinkMedia,
  ImageMedia,
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
}

// =============================================================================
// Single Media Dispatcher
// =============================================================================

function SingleMedia({
  media,
  theme,
  size,
  showLinkPreviews,
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
    return <Embed url={media.url} platform={media.platform} theme={theme} size={size} />;
  }

  if (isLinkMedia(media)) {
    if (showLinkPreviews && media.showPreview !== false) {
      return <LinkPreview url={media.url} size={size} />;
    }
    return <Link url={media.url} label={media.label} icon={media.icon} />;
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

  // Separate links from rich media for better layout
  const richMedia = media.filter(
    (m) => isVideoMedia(m) || isEmbedMedia(m) || isImageMedia(m)
  );
  const links = media.filter(isLinkMedia) as LinkMedia[];

  // If only links, render them inline
  if (richMedia.length === 0 && links.length > 0) {
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

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {/* Rich media first */}
      {richMedia.map((m, i) => (
        <SingleMedia
          key={`media-${i}`}
          media={m}
          theme={theme}
          size={size}
          showLinkPreviews={showLinkPreviews}
        />
      ))}

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
