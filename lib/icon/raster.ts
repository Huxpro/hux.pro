/**
 * SVG → PNG / ICO rasterization for the home-screen icon assets.
 *
 * Browsers happily use the SVG favicon, but the *home screen* doesn't:
 *   - iOS "Add to Home Screen" requires a PNG `apple-touch-icon` (SVG ignored).
 *   - Android / PWA installs require PNG icons declared in a web manifest.
 *
 * So the generator rasterizes the same `buildIconSvg` output to PNG with resvg
 * (the wordmark font is supplied as a buffer, since resvg doesn't read inline
 * `@font-face`). This is a *generation-time* concern only — the PNGs are
 * committed artifacts, so the deployed runtime never imports resvg. Kept in its
 * own module, dynamically imported by the generator, so the native dep stays
 * out of the editor page's bundle.
 *
 * Node-only.
 */

/**
 * Rasterize an SVG string to a square PNG of `size` px. `fontBuffer` is the
 * wordmark font (woff2 or ttf); when absent, resvg falls back to a system mono.
 *
 * The font is passed as a buffer: resvg's `fontBuffers` decodes woff2 (its
 * file-path loader does not). The option predates the package's type defs, so
 * it's built as a variable to avoid an excess-property check while still
 * reaching the native binding at runtime.
 */
export async function rasterizeSvgToPng(
  svg: string,
  size: number,
  fontBuffer: Uint8Array | null,
): Promise<Buffer> {
  // Dynamic import keeps the native module out of any statically-bundled path.
  const { Resvg } = await import("@resvg/resvg-js");

  const font = fontBuffer
    ? {
        fontBuffers: [fontBuffer],
        defaultFontFamily: "JetBrains Mono",
        loadSystemFonts: false,
      }
    : { defaultFontFamily: "monospace", loadSystemFonts: true };

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    font,
  });
  return Buffer.from(resvg.render().asPng());
}

/**
 * Encode one or more PNG images into a single `.ico` (PNG-compressed entries,
 * supported by every modern browser and Windows Vista+). Each entry's pixel
 * dimensions must match its declared size.
 */
export function encodeIco(images: { size: number; png: Buffer }[]): Buffer {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dirEntrySize = 16;
  let offset = 6 + dirEntrySize * count;
  const dir = Buffer.alloc(dirEntrySize * count);
  const datas: Buffer[] = [];

  images.forEach((img, i) => {
    const base = i * dirEntrySize;
    // 0 in the width/height byte means 256 px.
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, base + 0);
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, base + 1);
    dir.writeUInt8(0, base + 2); // palette
    dir.writeUInt8(0, base + 3); // reserved
    dir.writeUInt16LE(1, base + 4); // color planes
    dir.writeUInt16LE(32, base + 6); // bits per pixel
    dir.writeUInt32LE(img.png.length, base + 8);
    dir.writeUInt32LE(offset, base + 12);
    offset += img.png.length;
    datas.push(img.png);
  });

  return Buffer.concat([header, dir, ...datas]);
}
