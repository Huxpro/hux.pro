/**
 * Image dimensions from a file's header — pure, no Node or DOM APIs.
 *
 * A cover shown whole (`fit: "natural"`) is only as tall as its picture, and
 * the picture's size is unknown to the page until the bytes arrive: the slot
 * opens at nothing and jumps to its height when the image loads. Every cover
 * the site shows is known at build time, so its size is read then, from the
 * header, and the slot is given its aspect before the image is fetched
 * (`content/image-sizes.json`, `lib/image-sizes.ts`).
 *
 * A handful of formats (PNG / JPEG / GIF / WebP / AVIF, and an SVG's own
 * width and height or viewBox) covers every image we ship or link. Works on
 * a prefix of the file: a header that is cut short answers null, and the
 * caller reads more.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * The cards this site draws for itself (`opengraph-image` routes, see
 * lib/og-image.tsx) are all one size; there is no file to read. Mirrors
 * `OG_SIZE`, which lives beside `next/og` and cannot be imported from here.
 */
const GENERATED_OG_SIZE: ImageDimensions = { width: 1200, height: 630 };

/** A path to one of this site's own `opengraph-image` routes → its size. */
export function generatedImageSize(src: string): ImageDimensions | null {
  if (!src.startsWith("/")) return null;
  const path = src.split(/[?#]/)[0];
  return /\/opengraph-image$/.test(path) ? GENERATED_OG_SIZE : null;
}

/** Extract width/height from a raster image header, or null. */
export function parseImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.subarray(from, to));
  let dims: ImageDimensions | null = null;
  try {
    // PNG — IHDR width/height are big-endian u32 at byte 16/20.
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      dims = { width: view.getUint32(16), height: view.getUint32(20) };
    }
    // GIF — logical screen width/height are little-endian u16 at byte 6/8.
    else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      dims = { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    }
    // WebP — "RIFF"…"WEBP" then a VP8 / VP8L / VP8X chunk.
    else if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
      dims = parseWebp(bytes, view, ascii(12, 16));
    }
    // JPEG — scan segments for a Start-Of-Frame marker.
    else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      dims = parseJpeg(bytes, view);
    }
    // AVIF / HEIF — an ISO-BMFF `ftyp`, the size in the `ispe` property.
    else if (ascii(4, 8) === "ftyp") {
      dims = parseIspe(bytes, view);
    }
    // SVG — text; the root element says its size.
    else {
      dims = parseSvg(bytes);
    }
  } catch {
    // A header cut short reads past the end: not known yet.
    return null;
  }
  return dims && dims.width > 0 && dims.height > 0 ? dims : null;
}

function parseWebp(
  b: Uint8Array,
  view: DataView,
  fmt: string,
): ImageDimensions | null {
  if (fmt === "VP8 ") {
    // Lossy: 14-bit width/height (little-endian) at byte 26/28.
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }
  if (fmt === "VP8L") {
    // Lossless: 14-bit width/height packed after the 0x2f signature byte.
    return {
      width: 1 + (((b[22] & 0x3f) << 8) | b[21]),
      height: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)),
    };
  }
  if (fmt === "VP8X") {
    // Extended: 24-bit canvas width/height (minus one) at byte 24/27.
    return {
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    };
  }
  return null;
}

function parseJpeg(b: Uint8Array, view: DataView): ImageDimensions | null {
  let i = 2;
  while (i + 1 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    // Collapse any fill bytes (0xFF) preceding the marker.
    let marker = b[i + 1];
    while (marker === 0xff && i + 2 < b.length) {
      i++;
      marker = b[i + 1];
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
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    }

    // Standalone markers (RSTn, SOI, EOI, TEM) have no length field.
    if ((marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      i += 2;
      continue;
    }

    const len = view.getUint16(i + 2);
    if (len < 2) break;
    i += 2 + len;
  }
  return null;
}

function parseIspe(b: Uint8Array, view: DataView): ImageDimensions | null {
  // `ispe`: 4-byte type, 4 bytes of version and flags, then u32 width and
  // u32 height. The first one is the primary image's.
  for (let i = 8; i + 16 <= b.length; i++) {
    if (b[i] === 0x69 && b[i + 1] === 0x73 && b[i + 2] === 0x70 && b[i + 3] === 0x65) {
      return { width: view.getUint32(i + 8), height: view.getUint32(i + 12) };
    }
  }
  return null;
}

function parseSvg(b: Uint8Array): ImageDimensions | null {
  const text = new TextDecoder().decode(b.subarray(0, 16 * 1024));
  const tag = text.match(/<svg\b[^>]*>/i)?.[0];
  if (!tag) return null;
  const attr = (name: string) =>
    tag.match(new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
  // A length in user units (px or none); a percentage says nothing.
  const length = (v: string | undefined) => {
    const m = v?.trim().match(/^([\d.]+)(px)?$/);
    return m ? parseFloat(m[1]) : NaN;
  };
  const width = length(attr("width"));
  const height = length(attr("height"));
  if (width > 0 && height > 0) return { width, height };
  const box = attr("viewBox")?.trim().split(/[\s,]+/).map(Number);
  if (box?.length === 4 && box[2] > 0 && box[3] > 0) {
    return { width: box[2], height: box[3] };
  }
  return null;
}
