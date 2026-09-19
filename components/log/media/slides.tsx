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
import { useOptionalAttachments } from "@/systems/attachments";
import { useOptionalTheaterStage } from "@/systems/theater";
import { ExternalImage } from "./external-image";
import { MediaMark, SLIDES_MARK } from "./media-mark";

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
  const attachments = useOptionalAttachments();
  const theater = useOptionalTheaterStage();
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
    // Standalone (an MDX `<Media as="slides" />`): a one-deck set through
    // the attachments policy, so it opens where every other deck does —
    // the sheet on a phone, the stage elsewhere. Outside the provider, the
    // stage directly, or the deck's own tab when there is none.
    const media: SlidesMedia = { kind: "slides", url, thumbnail, title };
    if (attachments) {
      attachments.open({ id: url, title: label, items: [media] }, 0);
      return;
    }
    if (theater) {
      theater.openMedia(media, { id: url, title: label });
      return;
    }
    openSlidesInNewTab(resolveSlidesEmbedUrl(url));
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
        {/* The `Slides` chip: the one vocabulary every cover speaks
            (media-mark.tsx). */}
        <MediaMark mark={SLIDES_MARK} size={size === "compact" ? "compact" : "default"} />
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
