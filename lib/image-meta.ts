import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { parseImageDimensions, type ImageDimensions } from "./image-dimensions";

/**
 * Build-time image metadata for the prose "bleed out" decision.
 *
 * Markdown images (`![](...)`) carry no dimensions, so we read the intrinsic
 * size of local files straight from `/public` at render (build) time and let a
 * heuristic decide whether an image should break out of the reading column.
 *
 * Kept dependency-free: the header parser (lib/image-dimensions.ts) covers
 * every raster image we ship. This runs on the server only.
 */

export type { ImageDimensions };

// -----------------------------------------------------------------------------
// Heuristic
// -----------------------------------------------------------------------------

/**
 * Intrinsic width (px) at/above which an image is considered a "large capture"
 * worth enlarging. Full-screen Chrome DevTools / retina screenshots clear this
 * comfortably (≥1725px here); small inline images (Lighthouse cards ~500px) do
 * not.
 */
const BLEED_MIN_WIDTH = 1024;

/**
 * Minimum aspect ratio (w/h) for a bleed. Landscape captures read well
 * enlarged; square or portrait figures (architecture diagrams, phone shots)
 * would dominate the page, so they stay in-column.
 */
const BLEED_MIN_ASPECT = 1.3;

/**
 * Decide whether an image should "bleed" out of the reading column by default.
 *
 * A landscape aspect ratio AND a large intrinsic width together separate wide,
 * high-resolution captures (which look better enlarged) from small inline
 * images and tall/square figures (which should stay within the column). Tuned
 * against the eleme-PWA post, this matches the intended set of DevTools
 * screenshots while excluding the small Lighthouse cards and the near-square
 * architecture diagram.
 *
 * The decision is a default only. Authors override it per image with a
 * `#bleed` / `#no-bleed` URL fragment (see {@link parseBleedDirective}).
 */
export function shouldBleedImage({ width, height }: ImageDimensions): boolean {
  if (!width || !height) return false;
  return width >= BLEED_MIN_WIDTH && width / height >= BLEED_MIN_ASPECT;
}

// -----------------------------------------------------------------------------
// Per-image override directive
// -----------------------------------------------------------------------------

export type BleedDirective = "bleed" | "no-bleed" | undefined;

/**
 * Parse an author's explicit bleed override from a URL fragment and return the
 * cleaned src alongside it:
 *
 *   ![](/img/x.png#bleed)     → force bleed
 *   ![](/img/x.png#no-bleed)  → force no bleed  (also: #nobleed)
 *   ![](/img/x.png)           → no directive (fall back to the heuristic)
 *
 * An unrecognized fragment is left untouched on the src so real fragments are
 * never swallowed.
 */
export function parseBleedDirective(src: string): {
  src: string;
  directive: BleedDirective;
} {
  const hash = src.indexOf("#");
  if (hash === -1) return { src, directive: undefined };

  const frag = src.slice(hash + 1).toLowerCase();
  const base = src.slice(0, hash);

  if (frag === "bleed") return { src: base, directive: "bleed" };
  if (frag === "no-bleed" || frag === "nobleed") {
    return { src: base, directive: "no-bleed" };
  }
  return { src, directive: undefined };
}

// -----------------------------------------------------------------------------
// Dimension reading (local files only)
// -----------------------------------------------------------------------------

const dimensionCache = new Map<string, ImageDimensions | null>();

/**
 * Read the intrinsic dimensions of a local (`/…` under `/public`) image.
 * Returns null for remote URLs, unreadable files, or unsupported formats;
 * callers treat null as "no bleed".
 */
export function getLocalImageDimensions(src: string): ImageDimensions | null {
  // Only site-local absolute paths map to a file on disk.
  if (!src.startsWith("/")) return null;

  const clean = src.split(/[?#]/)[0];
  const cached = dimensionCache.get(clean);
  if (cached !== undefined) return cached;

  let dims: ImageDimensions | null = null;
  try {
    const file = path.join(process.cwd(), "public", clean);
    dims = parseImageDimensions(readFileSync(file));
  } catch {
    dims = null;
  }

  dimensionCache.set(clean, dims);
  return dims;
}
