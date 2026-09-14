#!/usr/bin/env node
// =============================================================================
// wallpaper-check — verify the committed wallpaper assets.
//
//   pnpm wallpapers:check
//
// The wallpapers in `public/wallpapers/` are Apple's default macOS and iOS
// artwork, committed rather than fetched: the site is static, and a build must
// never depend on a third-party archive still being up. Provenance for every
// pair lives beside them in `sources.json`.
//
// This checks that the catalog, the files and the manifest still agree — every
// pair in `sources.json` has its four files, each decodes, and none has drifted
// past the size budget an ambient background should cost.
//
// Adding a pair: download the originals, encode them as
// `public/wallpapers/<id>/{light,dark}.webp` plus `.thumb.webp` (WebP at q80,
// width ≤ 2560 and height ≤ 3600, never upscaled; thumbs ≤ 480 at q72), record
// the source URLs in `sources.json`, then add the entry to
// `BUILT_IN_WALLPAPERS` in `systems/ambient/lib/wallpaper.ts` with the base
// colours this script prints — it checks them back, and it checks that the two
// lists name the same pairs, so neither can drift unnoticed.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

/**
 * Parse the catalog's `base` colours out of the TS source.
 *
 * The script computes each pair's average colour anyway; printing it and
 * trusting a human to paste it back means a re-encode silently leaves the
 * committed value wrong — and that value is what paints under the image while
 * it decodes, so the drift shows up as a colour flash on exactly the slow
 * connections it exists for. Compare instead.
 */
async function readCatalogBases() {
  const src = await fs.readFile(
    path.join(process.cwd(), "systems", "ambient", "lib", "wallpaper.ts"),
    "utf8"
  );
  const bases = new Map();
  const re = /\.\.\.pair\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"\s*\)/g;
  for (const [, id, light, dark] of src.matchAll(re)) {
    bases.set(id, { light, dark });
  }
  return bases;
}

/**
 * Two `rgb(r g b)` strings within a channel or two of each other.
 *
 * Exact equality would fail on resampling noise between sharp builds; the point
 * is to catch a base left behind by a re-encode, which moves by tens.
 */
function nearlyEqual(a, b, tolerance = 3) {
  const parse = (v) => (v.match(/\d+/g) ?? []).map(Number);
  const [x, y] = [parse(a), parse(b)];
  return x.length === 3 && y.length === 3 && x.every((n, i) => Math.abs(n - y[i]) <= tolerance);
}

const DIR = path.join(process.cwd(), "public", "wallpapers");

/** A full-size wallpaper past this is too heavy for an ambient background. */
const MAX_FULL_KB = 120;
const MAX_THUMB_KB = 16;

/**
 * Bounds on the committed pixels, and they are NOT a square box on purpose.
 *
 * A single "long edge ≤ 2560" cap is wrong for portrait artwork. The long edge
 * of a phone wallpaper is its height, which nothing on a desktop ever needs —
 * capping it there left iOS 27 at 1178px wide when Apple ships it at 1320, and
 * iOS 18's dark half at 1182 from a 2580px source. Width is what a viewport
 * actually spends, so width gets the real budget and height only has to keep
 * the file from running away.
 */
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 3600;

async function main() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(DIR, "sources.json"), "utf8")
  );

  const catalogBases = await readCatalogBases();
  const problems = [];
  let total = 0;

  for (const pair of manifest.pairs) {
    if (!catalogBases.has(pair.id)) {
      problems.push(`${pair.id}: in sources.json but not in BUILT_IN_WALLPAPERS`);
    }
  }
  for (const id of catalogBases.keys()) {
    if (!manifest.pairs.some((p) => p.id === id)) {
      problems.push(`${id}: in BUILT_IN_WALLPAPERS but not in sources.json — unchecked`);
    }
  }

  console.log(
    "pair".padEnd(18),
    "dimensions".padEnd(12),
    "full".padStart(6),
    "thumb".padStart(7),
    " base"
  );

  for (const pair of manifest.pairs) {
    for (const variant of ["light", "dark"]) {
      const full = path.join(DIR, pair.id, `${variant}.webp`);
      const thumb = path.join(DIR, pair.id, `${variant}.thumb.webp`);

      let fullStat, thumbStat, meta, base;
      try {
        [fullStat, thumbStat] = await Promise.all([fs.stat(full), fs.stat(thumb)]);
        meta = await sharp(full).metadata();
        const { data } = await sharp(full)
          .resize(1, 1, { fit: "cover" })
          .raw()
          .toBuffer({ resolveWithObject: true });
        base = `rgb(${data[0]} ${data[1]} ${data[2]})`;
      } catch (err) {
        problems.push(`${pair.id}/${variant}: ${err.message}`);
        continue;
      }

      total += fullStat.size + thumbStat.size;
      const fullKb = Math.round(fullStat.size / 1024);
      const thumbKb = Math.round(thumbStat.size / 1024);

      if (fullKb > MAX_FULL_KB) {
        problems.push(`${pair.id}/${variant}: ${fullKb}KB exceeds ${MAX_FULL_KB}KB`);
      }
      if (thumbKb > MAX_THUMB_KB) {
        problems.push(
          `${pair.id}/${variant} thumb: ${thumbKb}KB exceeds ${MAX_THUMB_KB}KB`
        );
      }
      const declared = catalogBases.get(pair.id)?.[variant];
      if (declared && !nearlyEqual(declared, base)) {
        problems.push(
          `${pair.id}/${variant}: catalog base ${declared} but the file averages ${base}`
        );
      }
      if (meta.width > MAX_WIDTH || meta.height > MAX_HEIGHT) {
        problems.push(
          `${pair.id}/${variant}: ${meta.width}x${meta.height} exceeds ${MAX_WIDTH}x${MAX_HEIGHT}`
        );
      }

      console.log(
        `${pair.id}/${variant}`.padEnd(18),
        `${meta.width}x${meta.height}`.padEnd(12),
        `${fullKb}KB`.padStart(6),
        `${thumbKb}KB`.padStart(7),
        ` ${base}`
      );
    }
  }

  console.log(`\n${manifest.pairs.length} pairs, ${(total / 1024 / 1024).toFixed(2)} MB total`);

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log("All wallpaper assets present and within budget.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
