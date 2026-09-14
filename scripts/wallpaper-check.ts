#!/usr/bin/env node
// =============================================================================
// wallpaper-check — verify the committed wallpaper assets.
//
//   pnpm wallpapers:check
//
// The wallpapers in `public/wallpapers/` are Apple's artwork — the release
// pairs and the Mac OS X Nature photographs — committed rather than fetched:
// the site is static, and a build must never depend on a third-party archive
// still being up. Provenance for every file lives beside them in
// `sources.json`.
//
// This checks that the catalog, the files and the manifest still agree: every
// wallpaper in `BUILT_IN_WALLPAPERS` is in `sources.json` and the other way
// round, every file decodes, each is sharp enough for a desktop and no bigger
// than one needs, its declared base colour and size match the file, and none
// has drifted past the byte budget an ambient background should cost.
//
// The catalog is imported, not parsed: paths, sizes and base colours are read
// from the same objects the app renders.
//
// Adding a pair: encode `public/wallpapers/<id>/{light,dark}.webp` plus
// `.thumb.webp` (WebP q80; thumbs ≤ 480 at q72), record the sources under
// `pairs` in `sources.json`, and add a `pair(...)` entry to the catalog.
//
// Adding a photograph: encode `public/wallpapers/nature/<id>.webp` plus
// `.thumb.webp` (WebP q75), record it under `photos`, and add a `photo(...)`
// entry.
//
// Either way, size the file to the smallest cover of 2560×1600 and paste the
// base colour and dimensions this script prints.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import {
  BUILT_IN_WALLPAPERS,
  isSingleImage,
  type WallpaperAsset,
} from "../systems/ambient/lib/wallpaper.ts";

const PUBLIC = path.join(process.cwd(), "public");

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

/**
 * Two `rgb(r g b)` strings within a channel or two of each other.
 *
 * Exact equality would fail on resampling noise between sharp builds; the point
 * is to catch a base left behind by a re-encode, which moves by tens.
 */
function nearlyEqual(a: string, b: string, tolerance = 3): boolean {
  const parse = (v: string) => (v.match(/\d+/g) ?? []).map(Number);
  const [x, y] = [parse(a), parse(b)];
  return x.length === 3 && y.length === 3 && x.every((n, i) => Math.abs(n - y[i]) <= tolerance);
}

interface Row {
  label: string;
  line?: string;
  bytes: number;
  problems: string[];
}

async function checkAsset(asset: WallpaperAsset, kind: "pair" | "photo"): Promise<Row> {
  const label = asset.src.replace(/^\/wallpapers\//, "").replace(/\.webp$/, "");
  const full = path.join(PUBLIC, asset.src);
  const thumb = path.join(PUBLIC, asset.thumb);
  const problems: string[] = [];

  let fullSize: number, thumbSize: number, width: number, height: number, base: string;
  try {
    const image = sharp(full);
    const [fullStat, thumbStat, meta, { data }] = await Promise.all([
      fs.stat(full),
      fs.stat(thumb),
      image.metadata(),
      image.clone().resize(1, 1, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true }),
    ]);
    fullSize = fullStat.size;
    thumbSize = thumbStat.size;
    width = meta.width ?? 0;
    height = meta.height ?? 0;
    base = `rgb(${data[0]} ${data[1]} ${data[2]})`;
  } catch (err) {
    return { label, bytes: 0, problems: [`${label}: ${(err as Error).message}`] };
  }

  const fullKb = Math.round(fullSize / 1024);
  const thumbKb = Math.round(thumbSize / 1024);
  const budget = BUDGET_KB[kind];
  if (fullKb > budget.full) problems.push(`${label}: ${fullKb}KB exceeds ${budget.full}KB`);
  if (thumbKb > budget.thumb) {
    problems.push(`${label} thumb: ${thumbKb}KB exceeds ${budget.thumb}KB`);
  }
  if (!nearlyEqual(asset.base, base)) {
    problems.push(`${label}: catalog base ${asset.base} but the file averages ${base}`);
  }
  if (asset.width !== width || asset.height !== height) {
    problems.push(
      `${label}: catalog says ${asset.width}x${asset.height} but the file is ${width}x${height}`
    );
  }
  const stretch = Math.max(VIEWPORT.width / width, VIEWPORT.height / height);
  if (stretch > MAX_STRETCH) {
    problems.push(
      `${label}: ${width}x${height} stretches ${stretch.toFixed(2)}x to cover ${VIEWPORT.width}x${VIEWPORT.height} (max ${MAX_STRETCH}x)`
    );
  }
  // Larger than the smallest cover by more than a rounding pixel.
  if (Math.min(width / VIEWPORT.width, height / VIEWPORT.height) > 1 + 1 / VIEWPORT.height) {
    problems.push(
      `${label}: ${width}x${height} is larger than it needs to be to cover ${VIEWPORT.width}x${VIEWPORT.height}`
    );
  }

  const line = [
    label.padEnd(26),
    `${width}x${height}`.padEnd(12),
    `${stretch.toFixed(2)}x`.padStart(7),
    `${fullKb}KB`.padStart(7),
    `${thumbKb}KB`.padStart(6),
    ` ${base}`,
  ].join(" ");
  return { label, line, bytes: fullSize + thumbSize, problems };
}

async function main() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(PUBLIC, "wallpapers", "sources.json"), "utf8")
  ) as { pairs: { id: string }[]; photos?: { id: string }[] };

  const recorded = new Set([...manifest.pairs, ...(manifest.photos ?? [])].map((e) => e.id));
  const catalogued = new Set(BUILT_IN_WALLPAPERS.map((w) => w.id));
  const problems: string[] = [];
  for (const id of recorded) {
    if (!catalogued.has(id)) problems.push(`${id}: in sources.json but not in BUILT_IN_WALLPAPERS`);
  }
  for (const id of catalogued) {
    if (!recorded.has(id)) problems.push(`${id}: in BUILT_IN_WALLPAPERS but not in sources.json — unchecked`);
  }

  // One check per distinct file — a photograph's two halves are the same asset.
  // sharp decodes on its own thread pool, so all of them run at once.
  const rows = await Promise.all(
    BUILT_IN_WALLPAPERS.flatMap((w) => {
      const kind = isSingleImage(w) ? "photo" : "pair";
      return [...new Set([w.light, w.dark])].map((asset) => checkAsset(asset, kind));
    })
  );

  console.log(
    "wallpaper".padEnd(26),
    "dimensions".padEnd(12),
    "stretch".padStart(7),
    "full".padStart(7),
    "thumb".padStart(6),
    " base"
  );
  let total = 0;
  for (const row of rows) {
    if (row.line) console.log(row.line);
    total += row.bytes;
    problems.push(...row.problems);
  }
  console.log(
    `\n${BUILT_IN_WALLPAPERS.length} wallpapers, ${(total / 1024 / 1024).toFixed(2)} MB total`
  );

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
