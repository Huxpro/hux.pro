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
import { fetchEmbeddedFontFace } from "./fonts.ts";

const ROOT = process.cwd();
export const ICON_CONFIG_PATH = path.join(ROOT, "content", "icon.json");
export const ICON_OUTPUT_DIR = path.join(ROOT, "public", "icons");

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
  /** True when the wordmark font was inlined; false means system fallback. */
  fontEmbedded: boolean;
  files: string[];
}

/**
 * Render and write the icon assets to `public/icons/`:
 *   - `icon.svg`        512px, the primary favicon
 *   - `apple-icon.svg`  180px, the apple-touch-icon
 *
 * Fetches a glyph-subset font once and embeds it in both so the files are
 * self-contained. Font embedding is best-effort: if the network is unavailable
 * the assets are still written, just relying on the platform's fallback font.
 */
export async function generateIconAssets(
  config: IconConfig,
): Promise<GenerateResult> {
  const normalized = normalizeIconConfig(config);
  const fontFaceCss = (await fetchEmbeddedFontFace(normalized)) ?? undefined;

  fs.mkdirSync(ICON_OUTPUT_DIR, { recursive: true });

  const targets: Array<{ name: string; size: number }> = [
    { name: "icon.svg", size: 512 },
    { name: "apple-icon.svg", size: 180 },
  ];

  const files: string[] = [];
  for (const { name, size } of targets) {
    const svg = buildIconSvg(normalized, { size, fontFaceCss });
    const outPath = path.join(ICON_OUTPUT_DIR, name);
    fs.writeFileSync(outPath, svg + "\n", "utf8");
    files.push(path.relative(ROOT, outPath));
  }

  return { fontEmbedded: Boolean(fontFaceCss), files };
}
