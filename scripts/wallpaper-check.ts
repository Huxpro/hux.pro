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
// than one needs, its declared base colour and size match the file, photograph
// renditions cover their named viewports, and none has drifted past the byte
// budget an ambient background should cost.
//
// The catalog is imported, not parsed: paths, sizes and base colours are read
// from the same objects the app renders.
//
// Adding a pair: `pnpm wallpapers:encode <id>` when the pair is marked
// `"encode": "graphic"` (WebP q80) or `"encode": "photo"` (q95 / 4:4:4 plus
// a @1x cover) in `sources.json`, then add a `pair(...)` entry. Graphic
// thumbs are ≤ 480 at q72.
//
// Adding a photograph: `pnpm wallpapers:encode` (WebP q95 / 4:4:4, q90 if the
// file would exceed the per-megapixel budget; @1x cover plus a 480px thumb),
// record it under `photos`, and add a `photo(...)` entry.
//
// Either way, size the full file to the smallest cover of 2560×1600 at 2×
// (5120×3200 device pixels, never upscaled) and paste the base colour and
// dimensions this script prints.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import {
  BUILT_IN_WALLPAPERS,
  WALLPAPER_MAX_DPR,
  WALLPAPER_MAX_STRETCH,
  WALLPAPER_VIEWPORT,
  coverSize,
  isSingleImage,
  pickWallpaperSrc,
  wallpaperViewportAt,
  type WallpaperAsset,
} from "../systems/ambient/lib/wallpaper.ts";

const PUBLIC = path.join(process.cwd(), "public");

/**
 * Byte budgets, per kind of artwork.
 *
 * Smooth graphic pairs (Tahoe, Golden Gate) compress to tens of kilobytes.
 * Liquid Glass and the iOS 15 blobs have grain those washes do not, so the
 * pair cap is 320KB — past that something went wrong. Big Sur's dark half is
 * a grainy illustration: at 5120² / q80 it lands around 1.2MB, so the 2× full
 * cap is 2MB. A photograph of raked sand or river stones is detail all the
 * way down: the Nature set spans tens of kilobytes (Water) to well over a
 * megabyte (Zen Garden) at the same quality, and holding it to the gradients'
 * budget would mean blurring exactly what makes it worth choosing.
 *
 * Photograph full-size files are WebP q95 / 4:4:4 (q90 if a file would exceed
 * ~1.8MB per 2560×1600 megapixel). The full file is a 2× cover, so Catalina
 * at 5120² is several megabytes; 8MB still rejects a runaway encode. The @1x
 * rendition budget is the old 2.5MB full-file cap.
 */
const BUDGET_KB = {
  pair: { full: 2048, thumb: 16, rendition: 320 },
  photo: { full: 8192, thumb: 64, rendition: 2560 },
};

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

async function inspect(file: string): Promise<{
  bytes: number;
  width: number;
  height: number;
  base: string;
}> {
  const image = sharp(file);
  const [stat, meta, { data }] = await Promise.all([
    fs.stat(file),
    image.metadata(),
    image.clone().resize(1, 1, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true }),
  ]);
  return {
    bytes: stat.size,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    base: `rgb(${data[0]} ${data[1]} ${data[2]})`,
  };
}

function stretchTo(width: number, height: number, viewport = WALLPAPER_VIEWPORT): number {
  return Math.max(viewport.width / width, viewport.height / height);
}

async function checkAsset(asset: WallpaperAsset, kind: "pair" | "photo"): Promise<Row> {
  const label = asset.src.replace(/^\/wallpapers\//, "").replace(/\.webp$/, "");
  const full = path.join(PUBLIC, asset.src.replace(/^\//, ""));
  const thumb = path.join(PUBLIC, asset.thumb.replace(/^\//, ""));
  const problems: string[] = [];

  let info: Awaited<ReturnType<typeof inspect>>;
  let thumbInfo: Awaited<ReturnType<typeof inspect>>;
  try {
    [info, thumbInfo] = await Promise.all([inspect(full), inspect(thumb)]);
  } catch (err) {
    return { label, bytes: 0, problems: [`${label}: ${(err as Error).message}`] };
  }

  const fullKb = Math.round(info.bytes / 1024);
  const thumbKb = Math.round(thumbInfo.bytes / 1024);
  const budget = BUDGET_KB[kind];
  if (fullKb > budget.full) problems.push(`${label}: ${fullKb}KB exceeds ${budget.full}KB`);
  if (thumbKb > budget.thumb) {
    problems.push(`${label} thumb: ${thumbKb}KB exceeds ${budget.thumb}KB`);
  }
  if (!nearlyEqual(asset.base, info.base)) {
    problems.push(`${label}: catalog base ${asset.base} but the file averages ${info.base}`);
  }
  if (asset.width !== info.width || asset.height !== info.height) {
    problems.push(
      `${label}: catalog says ${asset.width}x${asset.height} but the file is ${info.width}x${info.height}`
    );
  }
  const stretch = stretchTo(info.width, info.height);
  if (stretch > WALLPAPER_MAX_STRETCH) {
    problems.push(
      `${label}: ${info.width}x${info.height} stretches ${stretch.toFixed(2)}x to cover ${WALLPAPER_VIEWPORT.width}x${WALLPAPER_VIEWPORT.height} (max ${WALLPAPER_MAX_STRETCH}x)`
    );
  }
  // Larger than the smallest cover of the 2× viewport by more than a rounding pixel.
  const twoX = wallpaperViewportAt(WALLPAPER_MAX_DPR);
  const maxCover = coverSize({ width: info.width, height: info.height }, twoX);
  if (Math.abs(info.width - maxCover.width) > 1 || Math.abs(info.height - maxCover.height) > 1) {
    problems.push(
      `${label}: ${info.width}x${info.height} is larger than it needs to be to cover ${twoX.width}x${twoX.height} at ${WALLPAPER_MAX_DPR}×`
    );
  }

  const oneX = coverSize({ width: info.width, height: info.height }, WALLPAPER_VIEWPORT);
  const needsOneX = Math.abs(oneX.width - info.width) > 1 || Math.abs(oneX.height - info.height) > 1;
  if (needsOneX && asset.srcset.length === 0) {
    problems.push(`${label}: missing @1x cover (${oneX.width}x${oneX.height})`);
  }

  let renditionBytes = 0;
  const renditionBits: string[] = [];
  const renditionBudget = kind === "photo" ? BUDGET_KB.photo.rendition! : BUDGET_KB.pair.rendition!;
  for (const rendition of asset.srcset) {
    const file = path.join(PUBLIC, rendition.src.replace(/^\//, ""));
    let r: Awaited<ReturnType<typeof inspect>>;
    try {
      r = await inspect(file);
    } catch (err) {
      problems.push(`${rendition.src}: ${(err as Error).message}`);
      continue;
    }
    renditionBytes += r.bytes;
    const kb = Math.round(r.bytes / 1024);
    renditionBits.push(`${r.width}x${r.height}/${kb}KB`);
    if (kb > renditionBudget) {
      problems.push(`${rendition.src}: ${kb}KB exceeds ${renditionBudget}KB`);
    }
    if (r.width !== rendition.width || r.height !== rendition.height) {
      problems.push(
        `${rendition.src}: catalog says ${rendition.width}x${rendition.height} but the file is ${r.width}x${r.height}`
      );
    }
    const expected = coverSize({ width: info.width, height: info.height }, WALLPAPER_VIEWPORT);
    if (Math.abs(r.width - expected.width) > 1 || Math.abs(r.height - expected.height) > 1) {
      problems.push(
        `${rendition.src}: ${r.width}x${r.height} is not the cover of ${expected.width}x${expected.height} from the full file`
      );
    }
  }

  if (kind === "photo" && needsOneX && !asset.srcset.some((r) => r.src.endsWith(".1x.webp"))) {
    problems.push(`${label}: photograph is missing a @1x cover`);
  }

  const line = [
    label.padEnd(26),
    `${info.width}x${info.height}`.padEnd(12),
    `${stretch.toFixed(2)}x`.padStart(7),
    `${fullKb}KB`.padStart(7),
    `${thumbKb}KB`.padStart(6),
    renditionBits.length ? ` [${renditionBits.join(", ")}]` : "",
    ` ${info.base}`,
  ].join(" ");
  return { label, line, bytes: info.bytes + thumbInfo.bytes + renditionBytes, problems };
}

function checkPicker(): string[] {
  const problems: string[] = [];
  const aurora = BUILT_IN_WALLPAPERS.find((w) => w.id === "aurora");
  if (!aurora) return ["aurora missing from the catalog"];
  const asset = aurora.light;
  const cases: Array<{
    name: string;
    viewport: { width: number; height: number; dpr: number };
    suffix: string;
  }> = [
    { name: "phone landscape 1x", viewport: { width: 844, height: 390, dpr: 1 }, suffix: "/aurora.webp" },
    { name: "laptop 1x", viewport: { width: 1440, height: 900, dpr: 1 }, suffix: "/aurora.webp" },
    { name: "desktop 1x", viewport: { width: 2560, height: 1600, dpr: 1 }, suffix: "/aurora.webp" },
    { name: "desktop 2x", viewport: { width: 1440, height: 900, dpr: 2 }, suffix: "/aurora.webp" },
    { name: "phone portrait 3x", viewport: { width: 390, height: 844, dpr: 3 }, suffix: "/aurora.webp" },
  ];
  for (const c of cases) {
    const picked = pickWallpaperSrc(asset, c.viewport);
    if (!picked.endsWith(c.suffix)) {
      problems.push(`pick ${c.name}: got ${picked}, expected suffix ${c.suffix}`);
    }
  }
  const catalina = BUILT_IN_WALLPAPERS.find((w) => w.id === "catalina");
  if (catalina) {
    const cat = catalina.light;
    const oneX = pickWallpaperSrc(cat, { width: 1440, height: 900, dpr: 1 });
    const twoX = pickWallpaperSrc(cat, { width: 1440, height: 900, dpr: 2 });
    if (!oneX.endsWith(".1x.webp")) {
      problems.push(`pick catalina laptop 1x: got ${oneX}, expected .1x.webp`);
    }
    if (!twoX.endsWith("/light.webp")) {
      problems.push(`pick catalina laptop 2x: got ${twoX}, expected /light.webp`);
    }
  }
  for (const dropped of ["clown-fish", "ladybug"]) {
    if (BUILT_IN_WALLPAPERS.some((w) => w.id === dropped)) {
      problems.push(`${dropped}: should have been removed from the catalog`);
    }
  }
  return problems;
}

async function main() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(PUBLIC, "wallpapers", "sources.json"), "utf8")
  ) as {
    pairs: { id: string; encode?: string }[];
    photos?: { id: string }[];
  };

  const photoIds = new Set([
    ...(manifest.photos ?? []).map((e) => e.id),
    ...manifest.pairs.filter((e) => e.encode === "photo").map((e) => e.id),
  ]);

  const recorded = new Set([...manifest.pairs, ...(manifest.photos ?? [])].map((e) => e.id));
  const catalogued = new Set(BUILT_IN_WALLPAPERS.map((w) => w.id));
  const problems: string[] = [];
  for (const id of recorded) {
    if (!catalogued.has(id)) problems.push(`${id}: in sources.json but not in BUILT_IN_WALLPAPERS`);
  }
  for (const id of catalogued) {
    if (!recorded.has(id)) problems.push(`${id}: in BUILT_IN_WALLPAPERS but not in sources.json — unchecked`);
  }
  problems.push(...checkPicker());

  // One check per distinct file — a photograph's two halves are the same asset.
  // sharp decodes on its own thread pool, so all of them run at once.
  const rows = await Promise.all(
    BUILT_IN_WALLPAPERS.flatMap((w) => {
      const kind = photoIds.has(w.id) || isSingleImage(w) ? "photo" : "pair";
      return [...new Set([w.light, w.dark])].map((asset) => checkAsset(asset, kind));
    })
  );

  console.log(
    "wallpaper".padEnd(26),
    "dimensions".padEnd(12),
    "stretch".padStart(7),
    "full".padStart(7),
    "thumb".padStart(6),
    " renditions / base"
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
