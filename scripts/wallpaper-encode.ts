#!/usr/bin/env node
// =============================================================================
// wallpaper-encode — rebuild committed wallpaper files from their sources.
//
//   pnpm wallpapers:encode                  # every catalogued photo and pair
//   pnpm wallpapers:encode golden-gate …    # only the named ids
//
// Each source is encoded twice when the pixels exist:
//
//   full     smallest cover of 2560×1600 at 2× (5120×3200 device pixels),
//            never upscaled. This is `asset.src`.
//   @1x      smallest cover of 2560×1600 at 1×, written as `.1x.webp` when
//            that is smaller than the full file, so a 1× display skips the
//            retina payload.
//
// ryOS serves each Nature JPEG as-is plus a picker thumb. We still encode
// @1x/@2x so raising quality (Aurora's source is 1.3MB) does not mean a phone
// pays for a 5K file. Smooth photographs encode at q95 4:4:4; a file that
// would outweigh the per-megapixel budget (Zen Garden's raked sand) falls
// back to q90. Graphic release pairs encode at WebP q80.
//
// Sources are fetched into /tmp and never committed. Only the WebP derivatives
// under public/wallpapers/ are written.
// =============================================================================

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import {
  BUILT_IN_WALLPAPERS,
  WALLPAPER_MAX_DPR,
  WALLPAPER_VIEWPORT,
  coverSize,
  isSingleImage,
  wallpaperOneXSrc,
  wallpaperViewportAt,
} from "../systems/ambient/lib/wallpaper.ts";

const PUBLIC = path.join(process.cwd(), "public");
const CACHE = path.join("/tmp", "wallpaper-sources");

function publicPath(webPath: string): string {
  return path.join(PUBLIC, webPath.replace(/^\//, ""));
}

const PHOTO_WEBP = {
  effort: 6,
  // 4:4:4. Default 4:2:0 is what turned Aurora / Snowy Hills into posterised bands.
  smartSubsample: false,
} as const;

const GRAPHIC_WEBP = { quality: 80, effort: 6 } as const;

/** Prefer q95 so smooth skies match the ryOS JPEGs; fall back to q90 if the
 *  file would outweigh ~1.8MB per 2560×1600 megapixel. */
const PHOTO_QUALITY_PREFERRED = 95;
const PHOTO_QUALITY_FALLBACK = 90;
const PHOTO_FALLBACK_BYTES_PER_1X = 1800 * 1024;

const THUMB_WEBP = { quality: 72, effort: 6 } as const;
const THUMB_MAX = 480;

interface PhotoSource {
  id: string;
  source: string;
}

interface PairSource {
  id: string;
  light?: string;
  dark?: string;
  encode?: "graphic" | "photo";
}

interface Manifest {
  photos?: PhotoSource[];
  pairs?: PairSource[];
}

async function loadManifest(): Promise<Manifest> {
  return JSON.parse(
    await fs.readFile(path.join(PUBLIC, "wallpapers", "sources.json"), "utf8")
  ) as Manifest;
}

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

async function curlFetch(url: string, dest: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "curl",
      ["-fsSL", "--max-time", "180", "-A", BROWSER_UA, "-e", `${new URL(url).origin}/`, "-o", dest, url],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let err = "";
    child.stderr.on("data", (buf) => {
      err += String(buf);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl ${url} → exit ${code}${err ? `: ${err.trim()}` : ""}`));
    });
  });
}

async function fetchSource(url: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.access(dest);
    return;
  } catch {
    // not cached
  }
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      Referer: `${new URL(url).origin}/`,
    },
  });
  if (res.ok) {
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return;
  }
  // Some CDNs (applewalls) 403 Node's fetch but accept curl.
  if (res.status === 403) {
    await curlFetch(url, dest);
    return;
  }
  throw new Error(`GET ${url} → ${res.status}`);
}

function sourceExt(url: string): string {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return ext || ".jpg";
}

async function writeThumb(
  image: ReturnType<typeof sharp>,
  source: { width: number; height: number },
  dest: string
) {
  const thumbScale = Math.min(1, THUMB_MAX / Math.max(source.width, source.height));
  await image
    .clone()
    .resize(Math.round(source.width * thumbScale), Math.round(source.height * thumbScale), {
      fit: "fill",
    })
    .webp(THUMB_WEBP)
    .toFile(dest);
}

async function summarize(dest: string, label: string, source: { width: number; height: number }, quality: string) {
  const encoded = sharp(dest);
  const [stat, encodedMeta, { data }] = await Promise.all([
    fs.stat(dest),
    encoded.metadata(),
    encoded.clone().resize(1, 1, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true }),
  ]);
  const base = `rgb(${data[0]} ${data[1]} ${data[2]})`;
  const kb = Math.round(stat.size / 1024);
  console.log(
    `${label.padEnd(22)} ${source.width}x${source.height} → ${encodedMeta.width}x${encodedMeta.height}  ${String(kb).padStart(5)}KB  ${quality}  ${base}`
  );
  return { width: encodedMeta.width ?? 0, height: encodedMeta.height ?? 0, base };
}

function fallbackBytes(size: { width: number; height: number }): number {
  const ref = WALLPAPER_VIEWPORT.width * WALLPAPER_VIEWPORT.height;
  return Math.round(PHOTO_FALLBACK_BYTES_PER_1X * ((size.width * size.height) / ref));
}

async function removeLegacyRenditions(destSrc: string) {
  const dir = path.dirname(publicPath(destSrc));
  const stem = path.basename(destSrc, ".webp");
  let names: string[] = [];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.startsWith(`${stem}.`) && /\.(?:1280|1920)\.webp$/.test(name)) {
      await fs.unlink(path.join(dir, name)).catch(() => {});
    }
  }
}

async function encodePhotoFile(opts: {
  label: string;
  sourcePath: string;
  destSrc: string;
  destThumb: string;
  graphic: boolean;
}): Promise<void> {
  const image = sharp(opts.sourcePath);
  const meta = await image.metadata();
  const source = { width: meta.width ?? 0, height: meta.height ?? 0 };
  if (!source.width || !source.height) throw new Error(`${opts.label}: undecodable source`);

  const full = coverSize(source, wallpaperViewportAt(WALLPAPER_MAX_DPR));
  const oneX = coverSize(source, WALLPAPER_VIEWPORT);
  const dest = publicPath(opts.destSrc);
  await fs.mkdir(path.dirname(dest), { recursive: true });

  const pipeline = (size: { width: number; height: number }, quality: number) =>
    image
      .clone()
      .resize(size.width, size.height, { fit: "fill" })
      .webp(opts.graphic ? GRAPHIC_WEBP : { ...PHOTO_WEBP, quality });

  let quality: number | "q80" = opts.graphic ? "q80" : PHOTO_QUALITY_PREFERRED;
  if (opts.graphic) {
    await pipeline(full, 80).toFile(dest);
  } else {
    let q: number = PHOTO_QUALITY_PREFERRED;
    let fullBuf = await pipeline(full, q).toBuffer();
    if (fullBuf.length > fallbackBytes(full)) {
      q = PHOTO_QUALITY_FALLBACK;
      fullBuf = await pipeline(full, q).toBuffer();
    }
    quality = q;
    await fs.writeFile(dest, fullBuf);
  }

  const writeOneX =
    Math.abs(oneX.width - full.width) > 1 || Math.abs(oneX.height - full.height) > 1;
  if (writeOneX) {
    const oneDest = wallpaperOneXSrc(opts.destSrc);
    const q = opts.graphic ? 80 : (quality as number);
    await pipeline(oneX, q).toFile(publicPath(oneDest));
  }

  await writeThumb(image, source, publicPath(opts.destThumb));
  await removeLegacyRenditions(opts.destSrc);
  await summarize(dest, opts.label, source, opts.graphic ? "q80" : `q${quality}`);
  if (writeOneX) {
    await summarize(
      publicPath(wallpaperOneXSrc(opts.destSrc)),
      `${opts.label}@1x`,
      source,
      opts.graphic ? "q80" : `q${quality}`
    );
  }
}

async function encodePhoto(id: string, sourcePath: string): Promise<void> {
  const wallpaper = BUILT_IN_WALLPAPERS.find((w) => w.id === id);
  if (!wallpaper || !isSingleImage(wallpaper)) {
    throw new Error(`${id}: not a catalogued photograph`);
  }
  const asset = wallpaper.light;
  await encodePhotoFile({
    label: id,
    sourcePath,
    destSrc: asset.src,
    destThumb: asset.thumb,
    graphic: false,
  });
}

async function encodePair(pair: PairSource): Promise<void> {
  const kind = pair.encode ?? "graphic";
  const light = pair.light;
  const dark = pair.dark;
  if (!light || !dark) {
    throw new Error(`${pair.id}: encode=${kind} needs light and dark URLs`);
  }
  const halves = [
    ["light", light],
    ["dark", dark],
  ] as const;
  for (const [half, url] of halves) {
    const cached = path.join(CACHE, `${pair.id}-${half}${sourceExt(url)}`);
    await fetchSource(url, cached);
    const destSrc = `/wallpapers/${pair.id}/${half}.webp`;
    const destThumb = `/wallpapers/${pair.id}/${half}.thumb.webp`;
    const label = `${pair.id}/${half}`;
    await encodePhotoFile({
      label,
      sourcePath: cached,
      destSrc,
      destThumb,
      graphic: kind === "graphic",
    });
  }
}

function selectedIds(): Set<string> | null {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  return ids.length ? new Set(ids) : null;
}

async function main() {
  const only = selectedIds();
  const manifest = await loadManifest();
  await fs.mkdir(CACHE, { recursive: true });

  const pairsToEncode = (manifest.pairs ?? []).filter(
    (p) => p.encode && p.light && p.dark && (!only || only.has(p.id))
  );
  if (pairsToEncode.length) {
    console.log(`Encoding ${pairsToEncode.length} release pair(s)\n`);
    for (const pair of pairsToEncode) await encodePair(pair);
    console.log("");
  }

  const photoSources = (manifest.photos ?? []).filter((s) => !only || only.has(s.id));
  if (only) {
    if (!pairsToEncode.length && !photoSources.length) {
      throw new Error(`no matching ids: ${[...only].join(", ")}`);
    }
    for (const photo of photoSources) {
      const cached = path.join(CACHE, `${photo.id}${sourceExt(photo.source)}`);
      await fetchSource(photo.source, cached);
      await encodePhoto(photo.id, cached);
    }
    return;
  }

  const sources = manifest.photos ?? [];
  const catalogued = new Set(BUILT_IN_WALLPAPERS.filter(isSingleImage).map((w) => w.id));
  const extra = sources.filter((s) => !catalogued.has(s.id));
  const missing = [...catalogued].filter((id) => !sources.some((s) => s.id === id));
  if (extra.length) {
    console.warn(`sources.json extras (skipped): ${extra.map((s) => s.id).join(", ")}`);
  }
  if (missing.length) {
    throw new Error(`catalogued photos missing from sources.json: ${missing.join(", ")}`);
  }
  const toEncode = sources.filter((s) => catalogued.has(s.id));
  console.log(
    `Encoding ${toEncode.length} photographs (WebP q${PHOTO_QUALITY_PREFERRED}, 4:4:4; q${PHOTO_QUALITY_FALLBACK} if over budget)\n`
  );
  for (const photo of toEncode) {
    const cached = path.join(CACHE, `${photo.id}${sourceExt(photo.source)}`);
    await fetchSource(photo.source, cached);
    await encodePhoto(photo.id, cached);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
