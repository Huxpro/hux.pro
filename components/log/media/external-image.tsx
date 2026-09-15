"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ExternalImage — the canonical `<img>` for third-party cover URLs.
 *
 * Centralizes three cross-cutting concerns that are easy to forget in fresh
 * code and that fail silently when forgotten:
 *
 *  1. `referrerPolicy="no-referrer"`. Some origins gate the image response on
 *     the request's Referer:
 *       - Bilibili's `i*.hdslb.com` 403s anything that isn't bilibili.com.
 *       - SegmentFault sneakily 200s with a branded "no hotlinking" PNG so
 *         broken images *look* successful in the network panel.
 *     Both regress to the wrong bytes without this flag.
 *
 *  2. YouTube's `maxresdefault.jpg → hqdefault.jpg` retry. `maxresdefault`
 *     404s for videos that were never uploaded in HD; `hqdefault` always
 *     exists. The fallback is a no-op for non-YouTube URLs.
 *
 *  3. Terminal-error fallback. On 404 / referrer-block / decode failure the
 *     browser draws its own broken-image glyph (a blue "?" in Chrome) — that
 *     is never the right look. We swap the `<img>` out for a neutral
 *     placeholder slot keyed by the same className, so consumers don't have
 *     to learn the failure protocol.
 *
 * Use this instead of a raw `<img>` whenever the URL is third-party. Local
 * assets (next.js Image, /public files) don't need it.
 */

interface ExternalImageProps {
  src: string;
  alt?: string;
  className?: string;
  /** Default "lazy"; pass "eager" for above-the-fold or hover-preview covers
   *  where the deferral would visibly delay the reveal. */
  loading?: "lazy" | "eager";
  /**
   * Fired exactly once per mount, on whichever happens first:
   *  - `onLoad`
   *  - browser cache returns a `complete` image at mount (the `useEffect`
   *    catches this case)
   *  - terminal `onError` (after the maxresdefault retry has been exhausted)
   * Useful for gating reveal animations on "all images in flight done".
   */
  onResolved?: () => void;
}

export function ExternalImage({
  src,
  alt = "",
  className,
  loading = "lazy",
  onResolved,
}: ExternalImageProps) {
  // Stable refs: keeping the DOM ref as a useRef object (rather than a
  // callback) prevents React from re-attaching it every render, and the
  // `fired` flag ensures onResolved runs once even when consumers pass it
  // as an inline arrow (new identity every parent render).
  const imgRef = useRef<HTMLImageElement | null>(null);
  const firedRef = useRef(false);
  const [errored, setErrored] = useState(false);
  const fire = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    onResolved?.();
  };
  // Cache-warm case: when the browser already has the image decoded, `load`
  // may fire before React attaches the listener, so check `complete` on mount.
  // `naturalWidth === 0` on a complete image means the decode failed (cached
  // 404 or broken bytes) — surface the placeholder in that case.
  useEffect(() => {
    const el = imgRef.current;
    if (!el?.complete) return;
    if (el.naturalWidth === 0) setErrored(true);
    fire();
    // One-shot at mount; deps intentionally empty.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (errored) {
    // `aspect-[2/1]` gives the slot a stable height even when the parent
    // sized via `h-auto` (which would collapse without intrinsic content).
    // For parents that already pin the height (e.g. `aspect-video`,
    // `h-full`), tailwind-merge keeps theirs.
    return (
      <div
        role="img"
        aria-label={alt || undefined}
        className={cn(
          "aspect-[2/1] bg-muted/10 flex items-center justify-center",
          className,
        )}
      >
        <ImageOff
          className="w-8 h-8 text-quaternary-foreground"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      referrerPolicy="no-referrer"
      onLoad={fire}
      onError={(e) => {
        const target = e.currentTarget;
        if (target.src.includes("maxresdefault")) {
          // One-shot YouTube downgrade; the next outcome (load or terminal
          // error) reports through the normal handlers.
          target.src = target.src.replace("maxresdefault", "hqdefault");
          return;
        }
        setErrored(true);
        fire();
      }}
    />
  );
}
