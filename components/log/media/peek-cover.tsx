"use client";

/**
 * PeekCover — the shared cover-image slot at the top of a hover peek.
 *
 * Both hover surfaces open with a cover image and used to size it in
 * conflicting, hardcoded ways: the /writing peek pinned covers to a fixed
 * `aspect-video` and cropped (`object-cover`), while the commit LinkCard peek
 * rendered at the image's natural aspect. Neither was configurable, so a tall
 * portrait cover (e.g. a stacked screenshot) got sliced into a thin band on
 * /writing. This component unifies the two into one primitive with two modes:
 *
 *  - `fit="cover"`   (default): a fixed-aspect slot; the image fills it and is
 *                    cropped (`object-cover`). Great default — most covers are
 *                    roughly landscape and read well cropped to a stable
 *                    rectangle. The ratio is `aspect` (falls back to
 *                    {@link DEFAULT_COVER_ASPECT}).
 *  - `fit="natural"`: the slot matches the image's intrinsic aspect ratio; the
 *                    whole image shows, never cropped. Use for covers whose
 *                    framing matters (portrait screenshots, infographics).
 *
 * Which mode a post/commit uses is author-configured (blog frontmatter
 * `coverFit` / `coverAspect`; commit media `preview.fit` / `preview.aspect`),
 * so the choice lives with the content, not hardcoded per surface.
 */

import { cn } from "@/lib/utils";
import { ExternalImage } from "./external-image";

/** How a peek cover fills its slot. See {@link PeekCover}. */
export type CoverFit = "cover" | "natural";

/**
 * Site-wide default aspect ratio for `fit="cover"` slots. Retune the whole
 * site's default from this single point; individual posts/commits override it
 * with `coverAspect` / `preview.aspect`. Any valid CSS `aspect-ratio` value
 * works (e.g. `"16 / 9"`, `"4 / 3"`, `"3 / 4"`, `"1 / 1"`).
 */
export const DEFAULT_COVER_ASPECT = "16 / 9";

export interface PeekCoverProps {
  /** Cover image URL (third-party — rendered via {@link ExternalImage}). */
  src: string;
  /** Fill mode. Default: `"cover"`. */
  fit?: CoverFit;
  /**
   * Fixed-mode aspect ratio as a CSS `aspect-ratio` value (e.g. `"3 / 4"`).
   * Ignored when `fit === "natural"`. Falls back to {@link DEFAULT_COVER_ASPECT}.
   */
  aspect?: string;
  /** Extra classes for the slot wrapper (background, rounding, width, …). */
  className?: string;
  /**
   * Extra classes merged onto the `<img>` itself — e.g. a load-in fade
   * (`opacity-0 → opacity-100`). Layout classes are supplied internally.
   */
  imgClassName?: string;
  /** Passed through to the image. Peeks are on-demand, so default `"eager"`. */
  loading?: "lazy" | "eager";
  /** Forwarded to {@link ExternalImage.onResolved} (load / cache / error). */
  onResolved?: () => void;
}

export function PeekCover({
  src,
  fit = "cover",
  aspect,
  className,
  imgClassName,
  loading = "eager",
  onResolved,
}: PeekCoverProps) {
  if (fit === "natural") {
    // Intrinsic aspect: the image's own dimensions size the slot. `h-auto`
    // lets it grow to the natural height so nothing is cropped.
    return (
      <div className={cn("bg-muted/20 overflow-hidden", className)}>
        <ExternalImage
          src={src}
          className={cn("block w-full h-auto", imgClassName)}
          loading={loading}
          onResolved={onResolved}
        />
      </div>
    );
  }

  // Fixed slot: a stable rectangle regardless of the image's real ratio; the
  // image fills and is cropped. Inline `aspect-ratio` (rather than a Tailwind
  // `aspect-[…]` class) keeps arbitrary author-supplied ratios out of the
  // utility churn and works for any value.
  return (
    <div
      className={cn("bg-muted/20 overflow-hidden", className)}
      style={{ aspectRatio: aspect ?? DEFAULT_COVER_ASPECT }}
    >
      <ExternalImage
        src={src}
        className={cn("block w-full h-full object-cover", imgClassName)}
        loading={loading}
        onResolved={onResolved}
      />
    </div>
  );
}
