/**
 * Server-side icon asset generation.
 *
 * Turns `content/icon.json` into the committed, self-contained SVG assets the
 * site actually serves as its favicon / app icon. Shared by the dev save route
 * (`app/api/icon`) and the build-time CLI (`scripts/icon-generate.ts`) so
 * "what the editor previews" and "what ships" are produced by one code path —
 * the same committed-artifact discipline as the OG snapshot.
 *
 * Node-only (uses `fs`); never imported into client code.
 */

import fs from "fs";
import path from "path";
import { normalizeIconConfig, type IconConfig } from "./config.ts";
import { buildIconSvg } from "./render.ts";
import { fetchEmbeddedFontFace, fetchFontBuffer } from "./fonts.ts";

const ROOT = process.cwd();
export const ICON_CONFIG_PATH = path.join(ROOT, "content", "icon.json");
export const ICON_OUTPUT_DIR = path.join(ROOT, "public", "icons");
/** Branded favicon served at /favicon.ico (Next's app-dir convention path). */
export const FAVICON_PATH = path.join(ROOT, "app", "favicon.ico");

/** PNG raster sizes the home-screen assets need. */
const PNG_TARGETS = [
  { name: "apple-icon.png", size: 180 }, // iOS "Add to Home Screen"
  { name: "icon-192.png", size: 192 }, // Android / PWA manifest
  { name: "icon-512.png", size: 512 }, // Android / PWA manifest + maskable
];
/** Sizes packed into favicon.ico. */
const ICO_SIZES = [16, 32, 48];

/** Read + normalize the committed config, falling back to defaults. */
export function readIconConfig(): IconConfig {
  try {
    const raw = fs.readFileSync(ICON_CONFIG_PATH, "utf8");
    return normalizeIconConfig(JSON.parse(raw));
  } catch {
    return normalizeIconConfig(undefined);
  }
}

/** Persist a config to `content/icon.json` (pretty, trailing newline). */
export function writeIconConfig(config: IconConfig): void {
  const normalized = normalizeIconConfig(config);
  fs.mkdirSync(path.dirname(ICON_CONFIG_PATH), { recursive: true });
  fs.writeFileSync(
    ICON_CONFIG_PATH,
    JSON.stringify(normalized, null, 2) + "\n",
    "utf8",
  );
}

export interface GenerateResult {
  /** True when the wordmark font was inlined into the SVG; else system fallback. */
  fontEmbedded: boolean;
  /** True when the PNG/ICO home-screen assets were rasterized. */
  rasterized: boolean;
  files: string[];
}

/**
 * Render and write the full icon set:
 *   - `public/icons/icon.svg`        512px, self-contained modern favicon
 *   - `public/icons/apple-icon.png`  180px, iOS apple-touch-icon
 *   - `public/icons/icon-192.png`    Android / PWA manifest
 *   - `public/icons/icon-512.png`    Android / PWA manifest (+ maskable)
 *   - `app/favicon.ico`              16/32/48 branded legacy favicon
 *
 * The SVG embeds a glyph-subset font (self-contained); the PNGs are rasterized
 * with resvg using the same font as a buffer. Both font paths are best-effort —
 * if the network is unavailable the SVG still writes (system-font fallback) and
 * raster is skipped rather than producing fontless PNGs.
 */
export async function generateIconAssets(
  config: IconConfig,
): Promise<GenerateResult> {
  const normalized = normalizeIconConfig(config);
  const fontFaceCss = (await fetchEmbeddedFontFace(normalized)) ?? undefined;

  fs.mkdirSync(ICON_OUTPUT_DIR, { recursive: true });
  const files: string[] = [];

  // --- SVG (primary favicon) ------------------------------------------------
  const svgPath = path.join(ICON_OUTPUT_DIR, "icon.svg");
  fs.writeFileSync(
    svgPath,
    buildIconSvg(normalized, { size: 512, fontFaceCss }) + "\n",
    "utf8",
  );
  files.push(path.relative(ROOT, svgPath));

  // --- PNG / ICO (home-screen assets) --------------------------------------
  const fontBuffer = await fetchFontBuffer(normalized);
  let rasterized = false;
  try {
    const { rasterizeSvgToPng, encodeIco } = await import("./raster.ts");

    for (const { name, size } of PNG_TARGETS) {
      const png = await rasterizeSvgToPng(
        buildIconSvg(normalized, { size }),
        size,
        fontBuffer,
      );
      const outPath = path.join(ICON_OUTPUT_DIR, name);
      fs.writeFileSync(outPath, png);
      files.push(path.relative(ROOT, outPath));
    }

    const icoEntries = [];
    for (const size of ICO_SIZES) {
      const png = await rasterizeSvgToPng(
        buildIconSvg(normalized, { size }),
        size,
        fontBuffer,
      );
      icoEntries.push({ size, png });
    }
    fs.writeFileSync(FAVICON_PATH, encodeIco(icoEntries));
    files.push(path.relative(ROOT, FAVICON_PATH));
    rasterized = true;
  } catch (err) {
    console.warn(
      `⚠ Raster step skipped: ${err instanceof Error ? err.message : err}`,
    );
  }

  return { fontEmbedded: Boolean(fontFaceCss), rasterized, files };
}
