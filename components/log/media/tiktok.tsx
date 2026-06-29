"use client";

/**
 * TikTok Embed
 *
 * Auto-loading TikTok embed using the official Player iframe API.
 * Mute is enforced via postMessage since TikTok's API has no URL mute param.
 * @see https://developers.tiktok.com/doc/embed-player
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LinkCard } from "./link";

// =============================================================================
// Types
// =============================================================================

export interface TikTokEmbedProps {
  /** TikTok video/photo URL */
  url: string;
  /** Optional custom thumbnail URL */
  thumbnail?: string;
  /** Theme for the embed (currently only affects container bg) */
  theme?: "light" | "dark";
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Extract post ID from TikTok URL
 * Supports both /video/ and /photo/ URLs
 */
export function extractTikTokId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Match /video/ID or /photo/ID
    const match = urlObj.pathname.match(/\/(video|photo)\/(\d+)/);
    return match?.[2] || null;
  } catch {
    return null;
  }
}

/**
 * Check if URL is a TikTok URL
 */
export function isTikTokUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("tiktok.com");
  } catch {
    return false;
  }
}

/**
 * Get TikTok Player iframe URL
 */
function getPlayerUrl(postId: string): string {
  const playerUrl = new URL(`https://www.tiktok.com/player/v1/${postId}`);
  playerUrl.searchParams.set("music_info", "1");
  playerUrl.searchParams.set("description", "1");
  playerUrl.searchParams.set("controls", "1");
  playerUrl.searchParams.set("autoplay", "0");
  playerUrl.searchParams.set("loop", "0");
  return playerUrl.toString();
}

const TIKTOK_ORIGIN = "https://www.tiktok.com";

function sendMute(win: Window) {
  try {
    win.postMessage({ "x-tiktok-player": true, type: "mute" }, TIKTOK_ORIGIN);
  } catch {
    // ignore cross-origin errors
  }
}

// =============================================================================
// Component
// =============================================================================

export function TikTokEmbed({
  url,
  theme = "dark",
  size = "default",
  className,
}: TikTokEmbedProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const postId = extractTikTokId(url);

  // Size configurations
  const sizeStyles = {
    compact: { width: "325px", height: "500px" },
    default: { width: "400px", height: "600px" },
    large: { width: "500px", height: "750px" },
  };

  const { width, height } = sizeStyles[size];

  // Send mute command on mount and with retries, since the TikTok player
  // may not be ready to receive postMessage immediately after the iframe renders.
  useEffect(() => {
    if (!postId) return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;

    const t1 = window.setTimeout(() => sendMute(win), 0);
    const t2 = window.setTimeout(() => sendMute(win), 400);
    const t3 = window.setTimeout(() => sendMute(win), 1000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [postId]);

  // Invalid URL or error - fallback to link preview
  if (!postId || hasError) {
    return <LinkCard url={url} title="TikTok" className={className} />;
  }

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden",
        "border border-border/50",
        theme === "dark" ? "bg-black" : "bg-white",
        className
      )}
      style={{ width, height, maxWidth: "100%" }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10 animate-pulse z-10">
          <div className="text-sm text-muted-foreground">Loading TikTok...</div>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={getPlayerUrl(postId)}
        title="TikTok video player"
        allow="fullscreen"
        allowFullScreen
        loading="lazy"
        onLoad={() => {
          setIsLoading(false);
          const win = iframeRef.current?.contentWindow;
          if (win) sendMute(win);
        }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
}
