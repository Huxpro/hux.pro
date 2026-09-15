#!/usr/bin/env node
// =============================================================================
// wallpaper-encode — rebuild committed wallpaper photographs from their sources.
//
//   pnpm wallpapers:encode
//
// ryOS ships each Nature photograph as one original JPEG plus a picker thumb.
// It does not keep per-screen-size files. We still encode three cover
// renditions of each photo (1280×800, 1920×1200, 2560×1600) so a phone does
// not download a desktop file, and we encode them much more gently than the
// old WebP q75 — that setting crushed smooth skies (Aurora 1.3MB JPEG → 43KB)
// into banding. Smooth photographs encode at q95; a file that would exceed
// 1.8MB (raked sand) falls back to q90.
//
// Sources are fetched into /tmp and never committed. Only the WebP derivatives
// under public/wallpapers/nature/ are written.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import {
  BUILT_IN_WALLPAPERS,
  WALLPAPER_RENDITIONS,
  WALLPAPER_VIEWPORT,
  coverSize,
  isSingleImage,
  wallpaperRenditionSrc,
} from "../systems/ambient/lib/wallpaper.ts";

const PUBLIC = path.join(process.cwd(), "public");
const CACHE = path.join("/tmp", "wallpaper-sources");

const PHOTO_WEBP = {
  effort: 6,
  // 4:4:4. Default 4:2:0 is what turned Aurora / Snowy Hills into posterised bands.
  smartSubsample: false,
} as const;

/** Prefer q95 so smooth skies match the ryOS JPEGs; fall back to q90 if the
 *  file would outweigh a desktop wallpaper (Zen Garden's raked sand). */
const PHOTO_QUALITY_PREFERRED = 95;
const PHOTO_QUALITY_FALLBACK = 90;
const PHOTO_FALLBACK_BYTES = 1800 * 1024;

const THUMB_WEBP = { quality: 72, effort: 6 } as const;
const THUMB_MAX = 480;

interface PhotoSource {
  id: string;
  source: string;
}

async function loadPhotoSources(): Promise<PhotoSource[]> {
  const manifest = JSON.parse(
    await fs.readFile(path.join(PUBLIC, "wallpapers", "sources.json"), "utf8")
  ) as { photos?: PhotoSource[] };
  return manifest.photos ?? [];
}

async function fetchSource(url: string, dest: string): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });
  try {
    await fs.access(dest);
    return;
  } catch {
    // not cached
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function encodePhoto(id: string, sourcePath: string): Promise<void> {
  const wallpaper = BUILT_IN_WALLPAPERS.find((w) => w.id === id);
  if (!wallpaper || !isSingleImage(wallpaper)) {
    throw new Error(`${id}: not a catalogued photograph`);
  }
  const asset = wallpaper.light;
  const image = sharp(sourcePath);
  const meta = await image.metadata();
  const source = { width: meta.width ?? 0, height: meta.height ?? 0 };
  if (!source.width || !source.height) throw new Error(`${id}: undecodable source`);

  const full = coverSize(source, WALLPAPER_VIEWPORT);
  const dest = path.join(PUBLIC, asset.src);
  await fs.mkdir(path.dirname(dest), { recursive: true });

  const pipeline = (size: { width: number; height: number }, quality: number) =>
    image
      .clone()
      .resize(size.width, size.height, { fit: "fill" })
      .webp({ ...PHOTO_WEBP, quality });

  let quality: number = PHOTO_QUALITY_PREFERRED;
  let fullBuf = await pipeline(full, quality).toBuffer();
  if (fullBuf.length > PHOTO_FALLBACK_BYTES) {
    quality = PHOTO_QUALITY_FALLBACK;
    fullBuf = await pipeline(full, quality).toBuffer();
  }
  await fs.writeFile(dest, fullBuf);

  for (const rendition of WALLPAPER_RENDITIONS) {
    const size = coverSize(source, rendition);
    if (size.width >= full.width - 1 && size.height >= full.height - 1) continue;
    await pipeline(size, quality).toFile(
      path.join(PUBLIC, wallpaperRenditionSrc(asset.src, rendition.id))
    );
  }

  const thumbScale = Math.min(1, THUMB_MAX / Math.max(source.width, source.height));
  await image
    .clone()
    .resize(Math.round(source.width * thumbScale), Math.round(source.height * thumbScale), {
      fit: "fill",
    })
    .webp(THUMB_WEBP)
    .toFile(path.join(PUBLIC, asset.thumb));

  const encoded = sharp(dest);
  const [stat, encodedMeta, { data }] = await Promise.all([
    fs.stat(dest),
    encoded.metadata(),
    encoded.clone().resize(1, 1, { fit: "cover" }).raw().toBuffer({ resolveWithObject: true }),
  ]);
  const base = `rgb(${data[0]} ${data[1]} ${data[2]})`;
  const kb = Math.round(stat.size / 1024);
  console.log(
    `${id.padEnd(22)} ${source.width}x${source.height} → ${encodedMeta.width}x${encodedMeta.height}  ${String(kb).padStart(5)}KB  q${quality}  ${base}`
  );
}

async function main() {
  const sources = await loadPhotoSources();
  const catalogued = new Set(
    BUILT_IN_WALLPAPERS.filter(isSingleImage).map((w) => w.id)
  );
  const toEncode = sources.filter((s) => catalogued.has(s.id));
  const extra = sources.filter((s) => !catalogued.has(s.id));
  const missing = [...catalogued].filter((id) => !sources.some((s) => s.id === id));
  if (extra.length) {
    console.warn(`sources.json extras (skipped): ${extra.map((s) => s.id).join(", ")}`);
  }
  if (missing.length) {
    throw new Error(`catalogued photos missing from sources.json: ${missing.join(", ")}`);
  }

  console.log(
    `Encoding ${toEncode.length} photographs (WebP q${PHOTO_QUALITY_PREFERRED}, 4:4:4; q${PHOTO_QUALITY_FALLBACK} if > ${PHOTO_FALLBACK_BYTES / 1024}KB)\n`
  );
  await fs.mkdir(CACHE, { recursive: true });

  for (const photo of toEncode) {
    const ext = path.extname(new URL(photo.source).pathname) || ".jpg";
    const cached = path.join(CACHE, `${photo.id}${ext}`);
    await fetchSource(photo.source, cached);
    await encodePhoto(photo.id, cached);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
