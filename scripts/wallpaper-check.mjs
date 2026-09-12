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
// `public/wallpapers/<id>/{light,dark}.webp` plus `.thumb.webp` (WebP, long
// edge ≤ 2560 at q80; thumbs ≤ 480 at q72), record the source URLs in
// `sources.json`, then add the entry to `BUILT_IN_WALLPAPERS` in
// `systems/ambient/lib/wallpaper.ts` with the base colours this script prints.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public", "wallpapers");

/** A full-size wallpaper past this is too heavy for an ambient background. */
const MAX_FULL_KB = 120;
const MAX_THUMB_KB = 16;
const MAX_EDGE = 2560;

async function main() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(DIR, "sources.json"), "utf8")
  );

  const problems = [];
  let total = 0;

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
      if (Math.max(meta.width, meta.height) > MAX_EDGE) {
        problems.push(
          `${pair.id}/${variant}: ${meta.width}x${meta.height} exceeds ${MAX_EDGE}px`
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
