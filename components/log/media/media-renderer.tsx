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

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/services/theme";
import { useLocale } from "@/services";
import { useOptionalTheater } from "@/systems/theater";
import type { Media } from "@/lib/log";
import {
  isVideoMedia,
  isSocialEmbedMedia,
  isLinkMedia,
  isLinkCard,
  isLinkPill,
  isImageMedia,
  isSlidesMedia,
} from "@/lib/log";
import { Video } from "./video";
import { SocialEmbed } from "./embed";
import { Link, LinkCard } from "./link";
import { Figure } from "./image";
import { Slides } from "./slides";

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
  /**
   * Display context for the immersive player when a video here is opened as a
   * one-off (i.e. it isn't part of a curated album). Supplies the track's
   * title / subtitle so the player never falls back to a bare "Video" label —
   * matters most for Bilibili / Vimeo, which expose no JS-API metadata.
   */
  videoContext?: { title?: string; subtitle?: string };
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
  /** Title / subtitle handed to the theater for one-off video playback. */
  videoContext?: { title?: string; subtitle?: string };
  /** Forwarded to the underlying renderer (e.g. to size a grid cell). */
  className?: string;
  /**
   * Tile-density hint forwarded to LinkCard. Set when the renderer is laying
   * out multiple cards side-by-side; LinkCard reads it to drop the
   * description on mobile and let the title use the freed lines.
   */
  dense?: boolean;
}

// =============================================================================
// Single Media Dispatcher
// =============================================================================

function SingleMedia({
  media,
  theme,
  size,
  videoContext,
  className,
  dense,
}: SingleMediaProps) {
  const { locale } = useLocale();
  const theater = useOptionalTheater();

  if (isVideoMedia(media)) {
    return (
      <Video
        url={media.url}
        platform={media.platform}
        thumbnail={media.thumbnail}
        size={size}
        onPlay={
          theater
            ? () =>
                theater.openVideo({
                  url: media.url,
                  platform: media.platform,
                  thumbnail: media.thumbnail,
                  title: videoContext?.title,
                  subtitle: videoContext?.subtitle,
                })
            : undefined
        }
      />
    );
  }

  if (isSlidesMedia(media)) {
    return (
      <Slides
        url={media.url}
        thumbnail={media.thumbnail}
        title={media.title}
        size={size}
        className={className}
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
    // Bilingual click-target + per-locale OG data. Both fall back to
    // the primary `url` / `preview` when the locale variant is absent
    // (populated by the enrichment pipeline from `urls`).
    const url = media.urls?.[locale] ?? media.url;
    const preview = media.previews?.[locale] ?? media.preview;
    if (media.present === "card") {
      return (
        <LinkCard
          url={url}
          size={size}
          dense={dense}
          title={preview?.title}
          description={preview?.description}
          image={preview?.image}
          internal={media.internal}
          className={className}
        />
      );
    }
    return (
      <Link
        url={url}
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
// Card Scroll Rail — horizontal scroll-snap track for the three-card case.
// =============================================================================

/**
 * Horizontal rail for exactly three cards. Bleeds one page gutter past the
 * content column so the third card's edge peeks (see the tripleCards branch
 * for the sizing trick), and carries scroll-position "shadow" gradients on
 * both edges: the left fades in only once the rail is scrolled off its start
 * (so card 1 isn't dimmed at rest), the right fades out once the end is
 * reached (so the last card lands clear over the trailing whitespace).
 */
function CardScrollRail({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // max <= 1 → nothing to scroll (defensive): treat as "at end" so the
    // peek gradient doesn't linger with no content behind it.
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, [sync]);

  return (
    <div className="@container/rail relative">
      <div
        ref={scrollRef}
        className={cn(
          // -mr-6 bleeds the track a full gutter past the column; pr-6 gives
          // the trailing card the same gutter of scroll whitespace so it can
          // rest clear of the fade at the end instead of jamming against the
          // page edge.
          "flex gap-2.5 -mr-6 pr-6",
          "overflow-x-auto overscroll-x-contain",
          // Proximity, not mandatory: two cards are visible, so the third
          // card's start-snap lies past the max scroll offset; mandatory
          // would keep yanking it back ("can't scroll to the last one").
          "snap-x snap-proximity scroll-smooth no-scrollbar",
        )}
      >
        {children}
      </div>
      {/* Left fade — appears only once scrolled off the start, softening
          card 1's cut-off edge. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-6",
          "bg-gradient-to-r from-background to-transparent",
          "transition-opacity duration-200",
          atStart ? "opacity-0" : "opacity-100",
        )}
      />
      {/* Right fade — over the gutter/peek; starts at the column edge so
          card 2 and both gaps stay undimmed, and disappears at the end so the
          last card reads clear over the pr-6 whitespace. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 -right-6 w-6",
          "bg-gradient-to-l from-background to-transparent",
          "transition-opacity duration-200",
          atEnd ? "opacity-0" : "opacity-100",
        )}
      />
    </div>
  );
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
  videoContext,
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

  // Partition into "rich" media (videos / slides / images / link-cards /
  // social widgets — anything with a real cover) and pills. Rich items keep
  // their authored order so a video + card interleave the way the author
  // wrote them.
  const rich = media.filter(
    (m) =>
      isVideoMedia(m) ||
      isSlidesMedia(m) ||
      isImageMedia(m) ||
      isLinkCard(m) ||
      isSocialEmbedMedia(m),
  );
  const pills = media.filter(isLinkPill);

  // Pill-only renderings: inline chip row, no surrounding layout box.
  if (rich.length === 0 && pills.length > 0) {
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

  // 2+ rich items — regardless of family — become a horizontal scroll-snap
  // rail rather than a vertical stack. Two videos, a video + a card, or three
  // cards all read as a compact side-by-side row instead of a tall pile. A
  // single rich item renders full-width as before (big player / full card).
  const useRail = rich.length >= 2;

  return (
    <div className={cn(layoutClasses[layout], className)}>
      {useRail ? (
        // The rail's *nominal* width is the content column, so the first two
        // items line up pixel-for-pixel with a two-item commit. The scroll
        // *track* bleeds one full page gutter (`-mr-6`, matching `<main>`'s
        // `px-6`) past that footprint so the next item's edge peeks at the
        // page edge. Each cell is measured against the container (`100cqi`),
        // NOT the bled track, so every cell stays exactly 1/2-column.
        // `self-start` lets each cell keep its natural height, so a 16:9 video
        // next to a taller card doesn't get stretched out of aspect.
        <CardScrollRail>
          {rich.map((m, i) => (
            <div
              key={`rail-${i}`}
              // `min-w-0` is load-bearing: without it a flex item's default
              // `min-width:auto` lets a text-heavy cell (a link card's title)
              // push past its `basis`, so the card cell grows wider than the
              // text-less video/slides cell beside it — unequal tiles and an
              // overflow that clips the peek. Pinning min-width keeps every
              // cell exactly one half-column.
              className="min-w-0 shrink-0 self-start snap-start basis-[calc((100cqi_-_0.625rem)/2)]"
            >
              {wrap(
                `rail-item-${i}`,
                m,
                <SingleMedia
                  media={m}
                  theme={theme}
                  size="compact"
                  dense
                  videoContext={videoContext}
                  className="w-full max-w-none"
                />,
              )}
            </div>
          ))}
        </CardScrollRail>
      ) : (
        rich.map((m, i) =>
          wrap(
            `rich-${i}`,
            m,
            <SingleMedia
              media={m}
              theme={theme}
              size={size}
              videoContext={videoContext}
            />,
          ),
        )
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
