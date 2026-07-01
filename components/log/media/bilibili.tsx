"use client";

/**
 * Bilibili Embed
 *
 * Click-to-play video embed for Bilibili videos.
 * Shows thumbnail cover (or a Bilibili-branded placeholder) before loading
 * the iframe. Supports BV and AV IDs, and multi-page videos.
 */

import { useState, useMemo } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEDIA_MAX_W } from "./sizes";
import { ExternalImage } from "./external-image";

// =============================================================================
// Types
// =============================================================================

type BilibiliVideoId =
  | { kind: "bvid"; bvid: string; page: number }
  | { kind: "aid"; aid: string; page: number };

export interface BilibiliEmbedProps {
  /** Bilibili video URL, raw BV ID, or raw AV ID (e.g. "av170001") */
  url: string;
  /** Optional custom thumbnail URL */
  thumbnail?: string;
  /**
   * Override which page to play for multi-part videos.
   * Defaults to the `?p=` query parameter in the URL, or 1.
   */
  page?: number;
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse a Bilibili URL (or raw BV/AV ID) into a structured ID with page.
 * Returns null if the URL doesn't contain a recognisable Bilibili video ID.
 */
function parseBilibiliId(url: string): BilibiliVideoId | null {
  const trimmed = url.trim();

  // Raw BV ID: "BV1xx411c7mD"
  if (/^BV[0-9A-Za-z]+$/.test(trimmed)) {
    return { kind: "bvid", bvid: trimmed, page: 1 };
  }

  // Raw AV ID: "av170001"
  const avRaw = trimmed.match(/^av(\d+)$/i);
  if (avRaw?.[1]) {
    return { kind: "aid", aid: avRaw[1], page: 1 };
  }

  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split("/").filter(Boolean);

    const pageRaw = u.searchParams.get("p");
    const page =
      pageRaw && /^\d+$/.test(pageRaw) ? Math.max(1, Number(pageRaw)) : 1;

    const videoIdx = parts.indexOf("video");
    if (videoIdx >= 0 && parts[videoIdx + 1]) {
      const raw = parts[videoIdx + 1].trim();

      // BV id: /video/BV1xx411c7mD
      if (/^BV[0-9A-Za-z]+$/.test(raw)) {
        return { kind: "bvid", bvid: raw, page };
      }

      // AV id: /video/av170001
      const av = raw.match(/^av(\d+)$/i);
      if (av?.[1]) return { kind: "aid", aid: av[1], page };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract a canonical string ID for the video (BV ID or "av{aid}").
 * Used externally by the Video router to validate URLs.
 */
export function extractBilibiliId(url: string): string | null {
  const id = parseBilibiliId(url);
  if (!id) return null;
  return id.kind === "bvid" ? id.bvid : `av${id.aid}`;
}

/**
 * Build the Bilibili embed URL. Autoplay is always on because the iframe is
 * only mounted after the user explicitly clicks the play button.
 */
function getEmbedUrl(id: BilibiliVideoId, overridePage?: number): string {
  const u = new URL("https://player.bilibili.com/player.html");
  if (id.kind === "bvid") u.searchParams.set("bvid", id.bvid);
  if (id.kind === "aid") u.searchParams.set("aid", id.aid);

  const resolvedPage =
    typeof overridePage === "number" && Number.isFinite(overridePage)
      ? Math.max(1, Math.floor(overridePage))
      : id.page;

  u.searchParams.set("page", String(resolvedPage));
  u.searchParams.set("high_quality", "1");
  u.searchParams.set("danmaku", "0");
  u.searchParams.set("autoplay", "1");
  return u.toString();
}

// =============================================================================
// Component
// =============================================================================

export function BilibiliEmbed({
  url,
  thumbnail,
  page,
  size = "default",
  className,
}: BilibiliEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const id = useMemo(() => parseBilibiliId(url), [url]);
  const embedUrl = useMemo(
    () => (id ? getEmbedUrl(id, page) : null),
    [id, page]
  );

  const sizeClasses = MEDIA_MAX_W;

  if (!id || !embedUrl) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center justify-center",
          "block aspect-video bg-muted/20 rounded-lg",
          "border border-border/50 hover:bg-muted/30 transition-colors",
          "text-sm text-muted-foreground",
          className
        )}
      >
        View on Bilibili →
      </a>
    );
  }

  // Cover state: show thumbnail (or branded placeholder) with play button
  if (!isPlaying) {
    const idLabel = id.kind === "bvid" ? id.bvid : `av${id.aid}`;
    return (
      <button
        type="button"
        onClick={() => setIsPlaying(true)}
        className={cn(
          "relative w-full aspect-video rounded-lg overflow-hidden",
          "border border-border/50",
          "group cursor-pointer",
          sizeClasses[size],
          className
        )}
        aria-label="Play Bilibili video"
      >
        {thumbnail ? (
          <ExternalImage
            src={thumbnail}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          // Bilibili-branded placeholder when no custom thumbnail is available
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#00a1d6]/8">
            {/* Bilibili wordmark-style label */}
            <span className="text-[#00a1d6]/40 text-xs font-mono tracking-widest uppercase select-none">
              bilibili
            </span>
            <span className="text-[#00a1d6]/25 text-[10px] font-mono select-none">
              {idLabel}
            </span>
          </div>
        )}

        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <div className="w-16 h-16 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-black/50 transition-all">
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </div>
        </div>
      </button>
    );
  }

  // Player state: replace cover with the iframe after click
  return (
    <div
      className={cn(
        "relative w-full aspect-video rounded-lg overflow-hidden bg-black",
        sizeClasses[size],
        className
      )}
    >
      <iframe
        src={embedUrl}
        title="Bilibili video player"
        allow="fullscreen"
        allowFullScreen
        scrolling="no"
        sandbox="allow-scripts allow-same-origin allow-popups"
        className="absolute inset-0 w-full h-full border-0"
      />
    </div>
  );
}
