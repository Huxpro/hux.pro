"use client";

/**
 * MediaRenderer
 *
 * Orchestrates rendering of Media array attached to commits.
 * Automatically dispatches to Video, Embed, Link, or Figure components
 * based on the media type.
 */

import { useState, type ReactNode, type MouseEvent } from "react";
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
  /** Editor inspect mode: overlay each item with a click-to-select target
   *  instead of letting it open/play. Unset on the public site. */
  inspecting?: boolean;
  /** Select an individual media item for inspection. */
  onInspect?: (media: Media) => void;
  /** The media item currently focused in the Inspector, if any. */
  selectedMedia?: Media | null;
}

// =============================================================================
// Inspect Overlay
// =============================================================================

/**
 * Wraps a rendered media item so that, while inspecting, a transparent overlay
 * captures clicks — single click selects the item (the video doesn't play, the
 * link doesn't navigate), double click "enters" it.
 *
 * Entering is the Figma "double-click to enter" gesture: the overlay steps
 * aside (the first double-click also replays its click on the control beneath,
 * so the video plays / link opens immediately) and the media becomes fully
 * interactive — you can scrub the now-playing video, etc. Clicking away (which
 * moves the selection elsewhere) restores the overlay. Outside inspect mode the
 * child renders untouched.
 */
function InspectableMedia({
  media,
  inspecting,
  onInspect,
  selected,
  children,
}: {
  media: Media;
  inspecting: boolean;
  onInspect?: (media: Media) => void;
  selected: boolean;
  children: ReactNode;
}) {
  const [entered, setEntered] = useState(false);
  // Leave "entered" interaction as soon as the selection moves off this item,
  // so the select overlay comes back next time. Done with the "adjust state
  // during render" pattern (a deselect resets entered) rather than an effect.
  const [wasSelected, setWasSelected] = useState(selected);
  if (wasSelected !== selected) {
    setWasSelected(selected);
    if (!selected) setEntered(false);
  }

  if (!inspecting) return <>{children}</>;

  const enterAndActivate = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onInspect?.(media);
    setEntered(true);
    // Replay the click on the real control under the cursor so this very
    // double-click already plays the video / opens the link.
    const overlay = e.currentTarget;
    overlay.style.pointerEvents = "none";
    const beneath = document.elementFromPoint(e.clientX, e.clientY);
    if (beneath instanceof HTMLElement) beneath.click();
  };

  return (
    <div className="relative">
      {children}
      {entered ? (
        // Entered: media is fully interactive; just a non-interactive outline
        // marks it as the active item.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 rounded-lg ring-1 ring-inset ring-blue-500"
        />
      ) : (
        <button
          type="button"
          aria-label="Inspect media (double-click to open)"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInspect?.(media);
          }}
          onDoubleClick={enterAndActivate}
          className={cn(
            "absolute inset-0 z-20 rounded-lg cursor-pointer transition-all ring-inset",
            // Selection is signalled by a thin editor-blue outline — no fill
            // mask. Hover is a quiet grey outline at the same width.
            selected
              ? "ring-1 ring-blue-500"
              : "ring-0 hover:ring-1 hover:ring-foreground/30",
          )}
        />
      )}
    </div>
  );
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
  inspecting = false,
  onInspect,
  selectedMedia = null,
}: MediaRendererProps) {
  // Use site theme from context, allow prop override
  const { theme: siteTheme } = useTheme();
  const theme = themeProp ?? siteTheme;
  if (!media || media.length === 0) {
    return null;
  }

  // Wrap a single rendered item in the inspect overlay (no-op when not
  // inspecting). Keeps the four call sites below terse.
  const wrap = (key: string, m: Media, node: ReactNode) => (
    <InspectableMedia
      key={key}
      media={m}
      inspecting={inspecting}
      onInspect={onInspect}
      selected={selectedMedia === m}
    >
      {node}
    </InspectableMedia>
  );

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
        {links.map((link, i) =>
          wrap(
            `link-${i}`,
            link,
            <SingleMedia
              media={link}
              theme={theme}
              size={size}
              showLinkPreviews={showLinkPreviews}
            />,
          ),
        )}
      </div>
    );
  }

  const multipleEmbeds = embeds.length > 1;

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {/* Players (video / image) — vertical stack */}
      {players.map((m, i) =>
        wrap(
          `player-${i}`,
          m,
          <SingleMedia
            media={m}
            theme={theme}
            size={size}
            showLinkPreviews={showLinkPreviews}
          />,
        ),
      )}

      {/* Embeds — tiled two-up on every screen (incl. mobile) when >1 */}
      {embeds.length > 0 && (
        <div>
          <div
            className={cn(
              // grid default `items-stretch` keeps tiled cards equal height
              multipleEmbeds && "grid grid-cols-2 gap-2.5"
            )}
          >
            {embeds.map((m, i) =>
              wrap(
                `embed-${i}`,
                m,
                <SingleMedia
                  media={m}
                  theme={theme}
                  size={multipleEmbeds ? "compact" : size}
                  showLinkPreviews={showLinkPreviews}
                  className={multipleEmbeds ? "w-full max-w-none" : undefined}
                />,
              ),
            )}
          </div>
        </div>
      )}

      {/* Links at the end */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {links.map((link, i) =>
            wrap(
              `link-${i}`,
              link,
              <SingleMedia
                media={link}
                theme={theme}
                size={size}
                showLinkPreviews={showLinkPreviews}
              />,
            ),
          )}
        </div>
      )}
    </div>
  );
}
