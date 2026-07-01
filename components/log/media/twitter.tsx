"use client";

/**
 * Twitter/X Embed
 *
 * Native Twitter embed using the official widgets.js SDK.
 * Uses createTweet() for reliable SPA rendering.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MEDIA_MAX_W } from "./sizes";
import { Link } from "./link";

// =============================================================================
// Types
// =============================================================================

export interface TwitterEmbedProps {
  /** Tweet URL (x.com or twitter.com) */
  url: string;
  /** Theme for the embed */
  theme?: "light" | "dark";
  /** Size variant */
  size?: "compact" | "default" | "large";
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Helpers
// =============================================================================

// Singleton promise to ensure script is only loaded once
let twitterScriptPromise: Promise<void> | null = null;

function loadTwitterScriptOnce(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (twitterScriptPromise) return twitterScriptPromise;

  twitterScriptPromise = new Promise<void>((resolve) => {
    // If twttr is already available, we're done
    if (window.twttr?.widgets?.createTweet) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://platform.twitter.com/widgets.js"]'
    );

    if (existing) {
      // Script exists but twttr might not be ready yet - wait for it
      const waitForTwttr = () => {
        if (window.twttr?.widgets?.createTweet) {
          resolve();
        } else {
          setTimeout(waitForTwttr, 50);
        }
      };
      waitForTwttr();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.charset = "utf-8";
    script.onload = () => resolve();
    script.onerror = () => resolve(); // Resolve anyway to avoid hanging
    document.head.appendChild(script);
  });

  return twitterScriptPromise;
}

/** Timeout helper */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Extract tweet ID from Twitter/X URL
 */
export function extractTweetId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/status\/(\d+)/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Check if URL is a Twitter/X URL
 */
export function isTwitterUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes("twitter.com") || hostname.includes("x.com");
  } catch {
    return false;
  }
}

// =============================================================================
// Component
// =============================================================================

export function TwitterEmbed({
  url,
  theme = "dark",
  size = "default",
  className,
}: TwitterEmbedProps) {
  // Separate ref for the tweet container - React never renders children into this
  const tweetContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // Track if we've already created the embed for this tweetId+theme combo
  const embedKeyRef = useRef<string | null>(null);

  const tweetId = extractTweetId(url);
  const embedKey = tweetId ? `${tweetId}:${theme}` : null;

  useEffect(() => {
    if (!tweetId || !embedKey) return;

    // Skip if we've already created an embed for this exact configuration
    if (embedKeyRef.current === embedKey && tweetContainerRef.current?.hasChildNodes()) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const container = tweetContainerRef.current;

    const createEmbed = async () => {
      if (!container) return;

      try {
        // Load Twitter widget script with timeout
        await withTimeout(loadTwitterScriptOnce(), 10000, undefined);
        if (cancelled) return;

        // Wait for twttr to be ready with timeout
        const twttrReady = await withTimeout(
          new Promise<boolean>((resolve) => {
            const checkTwttr = () => {
              if (window.twttr?.widgets?.createTweet) {
                resolve(true);
              } else {
                setTimeout(checkTwttr, 100);
              }
            };
            checkTwttr();
          }),
          5000,
          false
        );

        if (cancelled) return;

        if (!twttrReady || !window.twttr?.widgets?.createTweet) {
          console.warn("Twitter widget failed to initialize");
          setHasError(true);
          setIsLoading(false);
          return;
        }

        // Double-check we haven't already created this embed (race condition guard)
        if (embedKeyRef.current === embedKey && container.hasChildNodes()) {
          setIsLoading(false);
          return;
        }

        // Clear any existing content before creating new embed
        // Safe because React doesn't manage children of this container
        while (container.firstChild) {
          container.removeChild(container.firstChild);
        }

        // Create tweet embed with timeout
        const tweetElement = await withTimeout(
          window.twttr.widgets.createTweet(tweetId, container, {
            theme,
            dnt: true,
            align: "center",
          }),
          10000,
          undefined
        );

        if (cancelled) return;

        // createTweet returns undefined if the tweet couldn't be loaded
        if (!tweetElement) {
          console.warn("Twitter createTweet returned undefined - tweet may not exist or is unavailable");
          setHasError(true);
          setIsLoading(false);
          return;
        }

        embedKeyRef.current = embedKey;
        setIsLoading(false);
      } catch (error) {
        console.error("Twitter embed error:", error);
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    createEmbed();

    return () => {
      cancelled = true;
    };
  }, [tweetId, theme, embedKey]);

  const sizeClasses = MEDIA_MAX_W;

  // Invalid URL or error - fallback to simple link (not OG preview, which would
  // also fail if the tweet is unavailable)
  if (!tweetId || hasError) {
    return <Link url={url} className={className} />;
  }

  // Structure: tweet container always renders (Twitter widget needs to measure dimensions).
  // Loading overlay sits on top with absolute positioning.
  return (
    <div className={cn("relative min-h-[200px]", sizeClasses[size], className)}>
      {/* Tweet container - always rendered so Twitter can measure dimensions */}
      <div ref={tweetContainerRef} />

      {/* Loading overlay - positioned absolutely on top, removed when loaded */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/10 rounded-lg border border-border/50 animate-pulse">
          <div className="text-sm text-muted-foreground">Loading tweet...</div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TypeScript Declarations
// =============================================================================

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement | null) => Promise<void>;
        createTweet: (
          tweetId: string,
          container: HTMLElement,
          options?: {
            theme?: "light" | "dark";
            dnt?: boolean;
            align?: "left" | "center" | "right";
            cards?: "hidden" | "visible";
            conversation?: "none" | "all";
            width?: number;
          }
        ) => Promise<HTMLElement | undefined>;
      };
    };
  }
}
