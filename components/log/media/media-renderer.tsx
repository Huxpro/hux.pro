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

import { type ReactNode } from "react";
import { MousePointer2 } from "lucide-react";
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
  /** Editor inspect mode: reveal small selection handles without blocking media clicks. */
  inspecting?: boolean;
  /** Select an individual media item for inspection. */
  onInspect?: (media: Media) => void;
  /** The media item currently focused in the Inspector, if any. */
  selectedMedia?: Media | null;
}

function InspectableMedia({
  media,
  inspecting,
  selected,
  inline = false,
  onInspect,
  children,
}: {
  media: Media;
  inspecting: boolean;
  selected: boolean;
  inline?: boolean;
  onInspect?: (media: Media) => void;
  children: ReactNode;
}) {
  if (!inspecting) return <>{children}</>;

  return (
    <div
      data-editor-interactive
      className={cn(
        "relative group/media",
        inline ? "inline-flex rounded-md" : "rounded-lg",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-10 ring-inset transition",
          inline ? "rounded-md" : "rounded-lg",
          selected
            ? "ring-2 ring-sky-500/70 bg-sky-500/[0.04]"
            : "ring-0 group-hover/media:ring-1 group-hover/media:ring-sky-500/35",
        )}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onInspect?.(media);
        }}
        className={cn(
          "absolute right-1.5 top-1.5 z-20 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-background/90 text-muted-foreground shadow-sm transition-opacity hover:text-foreground focus:opacity-100",
          selected
            ? "opacity-100 border-sky-500/70 text-sky-600 ring-1 ring-inset ring-sky-500/35 dark:text-sky-400"
            : "opacity-0 group-hover/media:opacity-100 group-focus-within/media:opacity-100",
        )}
        title="Inspect media"
        aria-label="Inspect media"
      >
        <MousePointer2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
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
  inspecting = false,
  onInspect,
  selectedMedia = null,
}: MediaRendererProps) {
  // Use site theme from context, allow prop override.
  const { theme: siteTheme } = useTheme();
  const theme = themeProp ?? siteTheme;
  if (!media || media.length === 0) {
    return null;
  }

  const wrap = (
    key: string,
    m: Media,
    node: ReactNode,
    inline = false,
  ) => (
    <InspectableMedia
      key={key}
      media={m}
      inspecting={inspecting}
      selected={selectedMedia === m}
      inline={inline}
      onInspect={onInspect}
    >
      {node}
    </InspectableMedia>
  );

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
        {pills.map((m, i) =>
          wrap(
            `pill-${i}`,
            m,
            <SingleMedia media={m} theme={theme} size={size} />,
            true,
          ),
        )}
      </div>
    );
  }

  const multipleCards = cards.length > 1;

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {/* Players (video / image) — vertical stack. */}
      {players.map((m, i) =>
        wrap(
          `player-${i}`,
          m,
          <SingleMedia media={m} theme={theme} size={size} />,
        ),
      )}

      {/* Cards (link-cards + social widgets) — tile two-up when >1. */}
      {cards.length > 0 && (
        <div>
          <div
            className={cn(
              // grid default `items-stretch` keeps tiled cards equal height.
              multipleCards && "grid grid-cols-2 gap-2.5",
            )}
          >
            {cards.map((m, i) =>
              wrap(
                `card-${i}`,
                m,
                <SingleMedia
                  media={m}
                  theme={theme}
                  size={multipleCards ? "compact" : size}
                  className={multipleCards ? "w-full max-w-none" : undefined}
                />,
              ),
            )}
          </div>
        </div>
      )}

      {/* Pills at the end. */}
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {pills.map((m, i) =>
            wrap(
              `pill-${i}`,
              m,
              <SingleMedia media={m} theme={theme} size={size} />,
              true,
            ),
          )}
        </div>
      )}
    </div>
  );
}
