"use client";

/**
 * Slides — the cover for an HTML reveal.js deck.
 *
 * A deck plays on the theater's stage, beside the videos (see
 * systems/theater: a `slides` track). The cover hands the click to `onPlay`
 * when the caller routes it — the attachment system does, per viewport — and
 * otherwise opens the deck itself: in the theater where there is one, in a
 * new tab where there is not (a phone, or a page without the provider). A
 * subtle "Slides" caption keeps the cover distinguishable from video covers
 * when both appear in a rail.
 */

import { Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlidesMedia } from "@/lib/log";
import { resolveSlidesEmbedUrl } from "@/lib/slides";
import { useOptionalTheater } from "@/systems/theater";
import { mediaToTrack } from "@/systems/theater/lib/albums";
import { ExternalImage } from "./external-image";
import { PlayBadge } from "./play-badge";

export { isPlayableSlidesUrl, resolveSlidesEmbedUrl } from "@/lib/slides";

/** Open a deck in its own tab — the phone path, and the no-theater path. */
export function openSlidesInNewTab(url: string): void {
  if (typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// =============================================================================
// Types
// =============================================================================

export interface SlidesProps {
  /** Direct playable deck URL. */
  url: string;
  /** Cover image. */
  thumbnail?: string;
  /** Accessible / modal title. */
  title?: string;
  /** Size variant. */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes. */
  className?: string;
  /** Take the click instead of opening the deck here. */
  onPlay?: () => void;
}

export interface SlidesPropsFromMedia {
  media: SlidesMedia;
  size?: "compact" | "default" | "large";
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function Slides({
  url,
  thumbnail,
  title,
  size = "default",
  className,
  onPlay,
}: SlidesProps) {
  const theater = useOptionalTheater();
  const embedUrl = resolveSlidesEmbedUrl(url);
  const label = title || "Slides";

  const sizeClasses = {
    compact: "max-w-md",
    default: "",
    large: "max-w-4xl",
  };

  const play = () => {
    if (onPlay) {
      onPlay();
      return;
    }
    // Standalone (an MDX `<Media as="slides" />`): the theater when the
    // viewport can hold one — a deck in a phone's PiP is unreadable — and
    // the deck's own tab otherwise.
    if (theater?.theaterAvailable) {
      const track = mediaToTrack(
        { kind: "slides", url, thumbnail, title },
        { id: url, title: label },
      );
      if (track) {
        theater.openAlbum({ id: `adhoc-${url}`, title: label, tracks: [track] });
        return;
      }
    }
    openSlidesInNewTab(embedUrl);
  };

  return (
    <>
      <button
        type="button"
        onClick={play}
        className={cn(
          "relative w-full aspect-video rounded-lg overflow-hidden",
          "bg-muted/20 border border-border/50",
          "group cursor-pointer text-left",
          sizeClasses[size],
          className,
        )}
        aria-label={`Play slides: ${label}`}
      >
        {thumbnail ? (
          <ExternalImage
            src={thumbnail}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted/40 to-muted/10">
            <Presentation className="h-10 w-10 text-tertiary-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-tertiary-foreground">
              Slides
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/25" />
        <PlayBadge
          size={size === "compact" ? "compact" : "default"}
          className="transition-transform group-hover:scale-110"
        />

        {/* Caption chip — distinguishes decks from video covers in mixed rails. */}
        <span
          className={cn(
            "absolute bottom-2 left-2 inline-flex items-center gap-1",
            "rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/90 ring-1 ring-white/15 backdrop-blur-sm",
          )}
        >
          <Presentation className="h-3 w-3" />
          Slides
        </span>
      </button>
    </>
  );
}

export function SlidesFromMedia({
  media,
  ...props
}: SlidesPropsFromMedia) {
  return (
    <Slides
      url={media.url}
      thumbnail={media.thumbnail}
      title={media.title}
      {...props}
    />
  );
}
