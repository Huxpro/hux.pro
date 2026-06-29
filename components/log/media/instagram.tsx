"use client";

/**
 * Instagram Embed
 *
 * Native Instagram embed using the official embed.js SDK.
 */

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LinkCard } from "./link";

// =============================================================================
// Types
// =============================================================================

export interface InstagramEmbedProps {
  /** Instagram post/reel URL */
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

/**
 * Extract post ID from Instagram URL
 */
export function extractInstagramId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const match = urlObj.pathname.match(/\/(p|reel)\/([A-Za-z0-9_-]+)/);
    return match?.[2] || null;
  } catch {
    return null;
  }
}

/**
 * Check if URL is an Instagram URL
 */
export function isInstagramUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("instagram.com");
  } catch {
    return false;
  }
}

// =============================================================================
// Component
// =============================================================================

export function InstagramEmbed({
  url,
  theme = "dark",
  size = "default",
  className,
}: InstagramEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const postId = extractInstagramId(url);

  useEffect(() => {
    if (!postId) return;

    let cancelled = false;

    const loadEmbed = async () => {
      try {
        // Load Instagram embed script if not already loaded
        if (!window.instgrm) {
          const existingScript = document.querySelector(
            'script[src="https://www.instagram.com/embed.js"]'
          );

          if (!existingScript) {
            const script = document.createElement("script");
            script.src = "https://www.instagram.com/embed.js";
            script.async = true;
            document.head.appendChild(script);

            await new Promise<void>((resolve, reject) => {
              script.onload = () => resolve();
              script.onerror = () => reject(new Error("Failed to load Instagram embed"));
            });
          }
        }

        if (cancelled) return;

        // Poll for instgrm.Embeds with timeout
        const ready = await new Promise<boolean>((resolve) => {
          const deadline = Date.now() + 5000;
          const checkInstgrm = () => {
            if (cancelled) {
              resolve(false);
            } else if (window.instgrm?.Embeds) {
              resolve(true);
            } else if (Date.now() > deadline) {
              resolve(false);
            } else {
              setTimeout(checkInstgrm, 100);
            }
          };
          checkInstgrm();
        });

        if (cancelled) return;

        if (ready) {
          window.instgrm!.Embeds.process();
          setIsLoading(false);
        } else {
          console.warn("Instagram embed timed out");
          setHasError(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Instagram embed error:", error);
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    loadEmbed();

    return () => {
      cancelled = true;
    };
  }, [postId]);

  const sizeStyles = {
    compact: { maxWidth: "325px", minWidth: "280px" },
    default: { maxWidth: "400px", minWidth: "326px" },
    large: { maxWidth: "500px", minWidth: "326px" },
  };

  // Invalid URL or error - fallback to link preview
  if (!postId || hasError) {
    return <LinkCard url={url} className={className} />;
  }

  return (
    <div className={cn("min-h-[400px]", className)} ref={containerRef}>
      {isLoading && (
        <div className="flex items-center justify-center h-[400px] bg-muted/10 rounded-lg border border-border/50 animate-pulse">
          <div className="text-sm text-muted-foreground">Loading Instagram...</div>
        </div>
      )}
      <blockquote
        className="instagram-media"
        data-instgrm-captioned
        data-instgrm-permalink={url}
        style={{
          background: theme === "dark" ? "#1a1a1a" : "#FFF",
          border: 0,
          borderRadius: "3px",
          boxShadow: "0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)",
          margin: "1px",
          padding: 0,
          width: "calc(100% - 2px)",
          ...sizeStyles[size],
        }}
      >
        <a href={url} target="_blank" rel="noopener noreferrer">
          View on Instagram
        </a>
      </blockquote>
    </div>
  );
}

// =============================================================================
// TypeScript Declarations
// =============================================================================

declare global {
  interface Window {
    instgrm?: {
      Embeds: {
        process: () => void;
      };
    };
  }
}
