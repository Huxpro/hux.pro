#!/usr/bin/env node
// =============================================================================
// wallpaper-check — verify the committed wallpaper assets.
//
//   pnpm wallpapers:check
//
// The wallpapers in `public/wallpapers/` are Apple's artwork — the release
// pairs and the Mac OS X Nature photographs — committed rather than fetched: the site is static, and a build must
// never depend on a third-party archive still being up. Provenance for every
// pair lives beside them in `sources.json`.
//
// This checks that the catalog, the files and the manifest still agree — every
// entry in `sources.json` has its files, each decodes, each is sharp enough for
// a desktop and no bigger than one needs, and none has drifted past the byte
// budget an ambient background should cost.
//
// Adding a pair: encode `public/wallpapers/<id>/{light,dark}.webp` plus
// `.thumb.webp` (WebP q80; thumbs ≤ 480 at q72), record the sources under
// `pairs` in `sources.json`, and add a `pair(...)` entry to
// `BUILT_IN_WALLPAPERS` in `systems/ambient/lib/wallpaper.ts`.
//
// Adding a photograph: encode `public/wallpapers/nature/<id>.webp` plus
// `.thumb.webp` (WebP q75), record it under `photos`, and add a `photo(...)`
// entry.
//
// Either way, size the file to the smallest cover of 2560×1600 and paste the
// base colour and dimensions this script prints — it checks both back, and it
// checks that the two lists name the same wallpapers.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

/**
 * Parse the catalog's `base` colours and dimensions out of the TS source.
 *
 * The script computes each pair's average colour anyway; printing it and
 * trusting a human to paste it back means a re-encode silently leaves the
 * committed value wrong — and that value is what paints under the image while
 * it decodes, so the drift shows up as a colour flash on exactly the slow
 * connections it exists for. Compare instead.
 */
async function readCatalog() {
  const src = await fs.readFile(
    path.join(process.cwd(), "systems", "ambient", "lib", "wallpaper.ts"),
    "utf8"
  );
  const catalog = new Map();
  const size = String.raw`\[\s*(\d+),\s*(\d+)\s*\]`;
  const pairs = new RegExp(
    String.raw`\.\.\.pair\(\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*` + size + String.raw`\s*\)`,
    "g"
  );
  for (const [, id, light, dark, w, h] of src.matchAll(pairs)) {
    const dims = { width: Number(w), height: Number(h) };
    catalog.set(id, { light: { base: light, ...dims }, dark: { base: dark, ...dims } });
  }
  const photos = new RegExp(
    String.raw`\.\.\.photo\(\s*"([^"]+)",\s*"([^"]+)",\s*` + size + String.raw`\s*\)`,
    "g"
  );
  for (const [, id, base, w, h] of src.matchAll(photos)) {
    catalog.set(id, { photo: { base, width: Number(w), height: Number(h) } });
  }
  return catalog;
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

/**
 * Byte budgets, per kind of artwork.
 *
 * The release pairs are smooth vector-like gradients and compress to almost
 * nothing, so a pair past 120KB means something went wrong. A photograph of
 * raked sand or river stones is detail all the way down: the Nature set spans
 * 27KB (Water) to 1.4MB (Zen Garden) at the same quality, and holding it to the
 * gradients' budget would mean blurring exactly what makes it worth choosing.
 */
const BUDGET_KB = {
  pair: { full: 120, thumb: 16 },
  photo: { full: 1536, thumb: 64 },
};

/**
 * The resolution rule, as a viewport the file has to cover.
 *
 * Every wallpaper paints `cover`, so what matters is the stretch on a real
 * screen, not megapixels. A 2560×1600 desktop is the largest target. A file
 * that needs more than a 7% stretch to cover it looks soft there — iOS 17
 * (2048² → 1.25×), iOS 18 and iOS 27 (portrait, 1.7–1.9×) were removed for
 * that — while the 2400² graphic pairs, at 1.07×, stay.
 *
 * The other side of the rule is weight: a file is downscaled to the smallest
 * size that still covers the viewport, so neither edge may exceed it.
 */
const VIEWPORT = { width: 2560, height: 1600 };
const MAX_STRETCH = 1.07;

async function main() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(DIR, "sources.json"), "utf8")
  );

  const catalog = await readCatalog();
  const problems = [];
  let total = 0;

  const entries = [
    ...manifest.pairs.map((p) => ({ id: p.id, kind: "pair", variants: ["light", "dark"] })),
    ...(manifest.photos ?? []).map((p) => ({ id: p.id, kind: "photo", variants: ["photo"] })),
  ];

  for (const { id } of entries) {
    if (!catalog.has(id)) {
      problems.push(`${id}: in sources.json but not in BUILT_IN_WALLPAPERS`);
    }
  }
  for (const id of catalog.keys()) {
    if (!entries.some((e) => e.id === id)) {
      problems.push(`${id}: in BUILT_IN_WALLPAPERS but not in sources.json — unchecked`);
    }
  }

  console.log(
    "wallpaper".padEnd(26),
    "dimensions".padEnd(12),
    "stretch".padStart(7),
    "full".padStart(7),
    "thumb".padStart(6),
    " base"
  );

  for (const { id, kind, variants } of entries) {
    for (const variant of variants) {
      const stem =
        kind === "photo"
          ? path.join(DIR, "nature", id)
          : path.join(DIR, id, variant);
      const full = `${stem}.webp`;
      const thumb = `${stem}.thumb.webp`;
      const label = kind === "photo" ? `nature/${id}` : `${id}/${variant}`;

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
        problems.push(`${label}: ${err.message}`);
        continue;
      }

      total += fullStat.size + thumbStat.size;
      const fullKb = Math.round(fullStat.size / 1024);
      const thumbKb = Math.round(thumbStat.size / 1024);
      const budget = BUDGET_KB[kind];

      if (fullKb > budget.full) {
        problems.push(`${label}: ${fullKb}KB exceeds ${budget.full}KB`);
      }
      if (thumbKb > budget.thumb) {
        problems.push(`${label} thumb: ${thumbKb}KB exceeds ${budget.thumb}KB`);
      }

      const declared = catalog.get(id)?.[variant];
      if (declared && !nearlyEqual(declared.base, base)) {
        problems.push(`${label}: catalog base ${declared.base} but the file averages ${base}`);
      }
      if (declared && (declared.width !== meta.width || declared.height !== meta.height)) {
        problems.push(
          `${label}: catalog says ${declared.width}x${declared.height} but the file is ${meta.width}x${meta.height}`
        );
      }

      const stretch = Math.max(VIEWPORT.width / meta.width, VIEWPORT.height / meta.height);
      if (stretch > MAX_STRETCH) {
        problems.push(
          `${label}: ${meta.width}x${meta.height} stretches ${stretch.toFixed(2)}x to cover ${VIEWPORT.width}x${VIEWPORT.height} (max ${MAX_STRETCH}x)`
        );
      }
      // Larger than the smallest cover by more than a rounding pixel.
      const excess = Math.min(meta.width / VIEWPORT.width, meta.height / VIEWPORT.height);
      if (excess > 1 + 1 / VIEWPORT.height) {
        problems.push(
          `${label}: ${meta.width}x${meta.height} is larger than it needs to be to cover ${VIEWPORT.width}x${VIEWPORT.height}`
        );
      }

      console.log(
        label.padEnd(26),
        `${meta.width}x${meta.height}`.padEnd(12),
        `${stretch.toFixed(2)}x`.padStart(7),
        `${fullKb}KB`.padStart(7),
        `${thumbKb}KB`.padStart(6),
        ` ${base}`
      );
    }
  }

  console.log(`\n${entries.length} wallpapers, ${(total / 1024 / 1024).toFixed(2)} MB total`);

  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log("All wallpaper assets present, sharp enough and within budget.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
