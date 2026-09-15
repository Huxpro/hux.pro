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
import {
  useSlidesPlayer,
  prefersSlidesModal,
  openSlidesInNewTab,
} from "./slides-player";
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
 * Paths that host self-contained reveal.js decks (not the wrapping keynote
 * blog posts under /YYYY/MM/DD/). Keep in sync with the slide repos under
 * github.com/Huxpro — served from huxpro.github.io (CNAME → og.hux.pro).
 *
 * `huangxuan.me/<deck>` used to work, but that domain now redirects to
 * hux.pro (which 404s these paths), so playable links must go through
 * huxpro.github.io.
 */
const SLIDE_DECK_PATHS = [
  "/js-module-7day",
  "/css-sucks-2015",
  "/pwa-in-my-pov",
  "/pwa-qcon2016",
  "/sw-101-gdgdf",
  "/jsconfcn2017",
];

/** Canonical host for playable decks after the huangxuan.me → hux.pro cutover. */
const SLIDES_HOST = "https://huxpro.github.io";

const SLIDES_HOSTS = new Set([
  "huxpro.github.io",
  "og.hux.pro",
  // Legacy — still recognized so we can rewrite to huxpro.github.io.
  "huangxuan.me",
  "www.huangxuan.me",
]);

function deckPathFromUrl(parsed: URL): string | null {
  const path = parsed.pathname.replace(/\/+$/, "") || "/";
  const deck = SLIDE_DECK_PATHS.find(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  return deck ?? null;
}

/**
 * True when `url` points at a playable HTML slide deck we can iframe.
 * Recognizes huxpro.github.io / og.hux.pro decks, legacy huangxuan.me
 * paths, and Wayback snapshots of the same.
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

    if (!SLIDES_HOSTS.has(host)) return false;
    return deckPathFromUrl(parsed) !== null;
  } catch {
    return false;
  }
}

/**
 * Normalize a deck URL to the playable huxpro.github.io host.
 *
 * - Legacy `huangxuan.me/<deck>` → `huxpro.github.io/<deck>/` (huangxuan.me
 *   now 302s to hux.pro, which 404s these paths).
 * - Wayback snapshots unwrap to the live deck, then rewrite as above.
 * - `og.hux.pro` (the GitHub Pages CNAME) is accepted as already playable
 *   and left alone so we don't bounce through an extra redirect.
 */
export function resolveSlidesEmbedUrl(url: string): string {
  try {
    let parsed = new URL(url);

    if (parsed.hostname.toLowerCase().includes("web.archive.org")) {
      const m = parsed.pathname.match(
        /\/web\/\d+(?:id_)?\/(https?:\/\/.+)$/i,
      );
      if (!m?.[1] || !isPlayableSlidesUrl(m[1])) return url;
      parsed = new URL(m[1]);
    }

    const host = parsed.hostname.toLowerCase();
    if (!SLIDES_HOSTS.has(host)) return url;

    const deck = deckPathFromUrl(parsed);
    if (!deck) return url;

    // og.hux.pro already serves the deck — keep hash/query for deep links.
    if (host === "og.hux.pro" || host === "huxpro.github.io") {
      const out = new URL(`${SLIDES_HOST}${deck}/`);
      out.search = parsed.search;
      out.hash = parsed.hash;
      // Prefer the authored github.io host even when given og.hux.pro, so
      // "Open fullscreen" / mobile new-tab links stay on huxpro.github.io.
      return out.toString();
    }

    // Legacy huangxuan.me → huxpro.github.io
    const out = new URL(`${SLIDES_HOST}${deck}/`);
    out.search = parsed.search;
    out.hash = parsed.hash;
    return out.toString();
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
    // Inside the provider, `open` already routes phones to a new tab.
    if (player.hasProvider) {
      player.open({ url: embedUrl, title: label });
      return;
    }
    // Standalone (MDX) path: mirror that decision locally.
    if (!prefersSlidesModal()) {
      openSlidesInNewTab(embedUrl);
      return;
    }
    setLocalOpen(true);
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
