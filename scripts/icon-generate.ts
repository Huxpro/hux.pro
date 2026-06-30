/**
 * Build-time app-icon generator.
 *
 *   node scripts/icon-generate.ts          # regenerate public/icons/* from config
 *   node scripts/icon-generate.ts --check  # CI: fail if assets are stale
 *
 * Reads `content/icon.json` (the committed, editor-authored config) and renders
 * the self-contained SVG assets the site serves. Same renderer + font embedder
 * the dev save route uses, so the CLI output equals what the editor produced.
 *
 * `--check` re-renders into memory and diffs against the committed files,
 * exiting non-zero on drift — mirrors `og-snapshot --check`. Note: font
 * embedding is network-dependent, so `--check` tolerates a font-only difference
 * (it compares the structural SVG with the `<style>` block stripped).
 */

import fs from "fs";
import path from "path";
import { buildIconSvg } from "../lib/icon/render.ts";
import { fetchEmbeddedFontFace } from "../lib/icon/fonts.ts";
import {
  generateIconAssets,
  ICON_CONFIG_PATH,
  ICON_OUTPUT_DIR,
  readIconConfig,
} from "../lib/icon/generate.ts";

const CHECK = process.argv.includes("--check");

/** Drop the inlined `<style>…</style>` so network-dependent font data doesn't
 *  cause false-positive drift in CI. */
function structural(svg: string): string {
  return svg.replace(/<style>[\s\S]*?<\/style>/g, "");
}

async function main() {
  if (!fs.existsSync(ICON_CONFIG_PATH)) {
    console.error(`✗ Missing config: ${path.relative(process.cwd(), ICON_CONFIG_PATH)}`);
    process.exit(1);
  }

  const config = readIconConfig();

  if (CHECK) {
    const fontFaceCss = (await fetchEmbeddedFontFace(config)) ?? undefined;
    const targets = [
      { name: "icon.svg", size: 512 },
      { name: "apple-icon.svg", size: 180 },
    ];
    let drift = false;
    for (const { name, size } of targets) {
      const expected = buildIconSvg(config, { size, fontFaceCss });
      const filePath = path.join(ICON_OUTPUT_DIR, name);
      const actual = fs.existsSync(filePath)
        ? fs.readFileSync(filePath, "utf8").trimEnd()
        : "";
      if (structural(actual) !== structural(expected)) {
        console.error(`✗ Drift: public/icons/${name} is out of date`);
        drift = true;
      }
    }
    if (drift) {
      console.error("Run `pnpm icon:generate` to regenerate.");
      process.exit(1);
    }
    console.log("✓ Icon assets are up to date.");
    return;
  }

  const result = await generateIconAssets(config);
  console.log(`✓ Wrote ${result.files.join(", ")}`);
  console.log(
    result.fontEmbedded
      ? "✓ Wordmark font embedded (self-contained)."
      : "⚠ Font not embedded (offline?) — using platform fallback font.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
