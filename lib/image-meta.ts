import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Build-time image metadata for the prose "bleed out" decision.
 *
 * Markdown images (`![](...)`) carry no dimensions, so we read the intrinsic
 * size of local files straight from `/public` at render (build) time and let a
 * heuristic decide whether an image should break out of the reading column.
 *
 * Kept dependency-free: a handful of format headers (PNG / JPEG / GIF / WebP)
 * cover every raster image we ship. This runs on the server only.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

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
 * The decision is a default only — authors override it per image with a
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
 * Returns null for remote URLs, unreadable files, or unsupported formats —
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
    dims = parseDimensions(readFileSync(file));
  } catch {
    dims = null;
  }

  dimensionCache.set(clean, dims);
  return dims;
}

/** Extract width/height from a raster image header. */
function parseDimensions(buf: Buffer): ImageDimensions | null {
  if (buf.length < 24) return null;

  // PNG — IHDR width/height are big-endian u32 at byte 16/20.
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF — logical screen width/height are little-endian u16 at byte 6/8.
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // WebP — "RIFF"…"WEBP" then a VP8 / VP8L / VP8X chunk.
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return parseWebp(buf);
  }

  // JPEG — scan segments for a Start-Of-Frame marker.
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    return parseJpeg(buf);
  }

  return null;
}

function parseWebp(buf: Buffer): ImageDimensions | null {
  const fmt = buf.toString("ascii", 12, 16);

  if (fmt === "VP8 ") {
    // Lossy: 14-bit width/height (little-endian) at byte 26/28.
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (fmt === "VP8L") {
    // Lossless: 14-bit width/height packed after the 0x2f signature byte.
    const b1 = buf[21];
    const b2 = buf[22];
    const b3 = buf[23];
    const b4 = buf[24];
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    };
  }
  if (fmt === "VP8X") {
    // Extended: 24-bit canvas width/height (minus one) at byte 24/27.
    return {
      width: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)),
      height: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)),
    };
  }
  return null;
}

function parseJpeg(buf: Buffer): ImageDimensions | null {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    // Collapse any fill bytes (0xFF) preceding the marker.
    let marker = buf[i + 1];
    while (marker === 0xff && i + 1 < buf.length) {
      i++;
      marker = buf[i + 1];
    }

    // SOF markers (C0–CF) carry the frame's height/width, except the
    // non-frame markers DHT (C4), JPG (C8) and DAC (CC).
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }

    // Standalone markers (RSTn, SOI, EOI, TEM) have no length field.
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      i += 2;
      continue;
    }

    const len = buf.readUInt16BE(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}
