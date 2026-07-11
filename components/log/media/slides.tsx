"use client";

/**
 * Slides — cover + in-site player for HTML reveal.js decks.
 *
 * Clicking the cover opens the shared SlideModal (~80% viewport) via
 * SlidesPlayerProvider, so visitors can step through the deck without
 * leaving the works timeline. A subtle "Slides" caption keeps the cover
 * distinguishable from video players when both appear in a rail.
 */

import { useState } from "react";
import { Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlidesMedia } from "@/lib/log";
import { ExternalImage } from "./external-image";
import { PlayBadge } from "./play-badge";
import { useSlidesPlayer } from "./slides-player";
import { SlideModal } from "./slide-modal";

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
}

export interface SlidesPropsFromMedia {
  media: SlidesMedia;
  size?: "compact" | "default" | "large";
  className?: string;
}

// =============================================================================
// Known deck detection (optional auto-route helper for <Media />)
// =============================================================================

/**
 * Paths on huangxuan.me that host self-contained reveal.js decks (not the
 * wrapping keynote blog posts under /YYYY/MM/DD/). Keep in sync with the
 * slide repos under github.com/Huxpro.
 */
const HUANGXUAN_DECK_PATHS = [
  "/js-module-7day",
  "/css-sucks-2015",
  "/pwa-in-my-pov",
  "/pwa-qcon2016",
  "/sw-101-gdgdf",
  "/jsconfcn2017",
];

/**
 * True when `url` points at a playable HTML slide deck we can iframe.
 * Recognizes live huangxuan.me decks and Wayback snapshots of the same.
 */
export function isPlayableSlidesUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    // Wayback Machine: …/web/<ts>/https://huangxuan.me/<deck>/
    if (host.includes("web.archive.org")) {
      const m = parsed.pathname.match(
        /\/web\/\d+(?:id_)?\/(https?:\/\/.+)$/i,
      );
      if (m?.[1]) return isPlayableSlidesUrl(m[1]);
      return false;
    }

    if (host === "huangxuan.me" || host === "www.huangxuan.me") {
      const path = parsed.pathname.replace(/\/+$/, "") || "/";
      return HUANGXUAN_DECK_PATHS.some(
        (deck) => path === deck || path.startsWith(`${deck}/`),
      );
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Prefer the live deck URL when an archive.org snapshot wraps one — live
 * pages iframe cleanly; Wayback's CSP is less reliable as an embed target.
 */
export function resolveSlidesEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.toLowerCase().includes("web.archive.org")) {
      return url;
    }
    const m = parsed.pathname.match(
      /\/web\/\d+(?:id_)?\/(https?:\/\/.+)$/i,
    );
    if (m?.[1] && isPlayableSlidesUrl(m[1])) return m[1];
    return url;
  } catch {
    return url;
  }
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
}: SlidesProps) {
  const player = useSlidesPlayer();
  const [localOpen, setLocalOpen] = useState(false);
  const embedUrl = resolveSlidesEmbedUrl(url);
  const label = title || "Slides";

  const sizeClasses = {
    compact: "max-w-md",
    default: "",
    large: "max-w-4xl",
  };

  const play = () => {
    if (player.hasProvider) {
      player.open({ url: embedUrl, title: label });
    } else {
      setLocalOpen(true);
    }
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
            <Presentation className="h-10 w-10 text-muted-foreground/50" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
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
            "rounded-md bg-black/55 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-white/90 backdrop-blur-sm",
          )}
        >
          <Presentation className="h-3 w-3" />
          Slides
        </span>
      </button>

      {!player.hasProvider && (
        <SlideModal
          open={localOpen}
          onClose={() => setLocalOpen(false)}
          src={embedUrl}
          title={label}
        />
      )}
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
