#!/usr/bin/env node
// =============================================================================
// wallpaper-fetch — download and encode the photographic wallpapers.
//
//   pnpm wallpapers:fetch          # download missing, encode into public/
//   pnpm wallpapers:fetch --force  # re-download and re-encode everything
//   pnpm wallpapers:check          # verify the committed files are current
//
// Every source is a NASA image, which is in the public domain under NASA's
// media usage guidelines (https://www.nasa.gov/nasa-brand-center/images-and-media/)
// — no permission needed, no attribution required. We credit them anyway, in
// the picker and in the catalog, because provenance is the interesting part.
//
// The encoded WebP files ARE committed: the site is static, this runs rarely,
// and a build should never depend on nasa.gov being up. Re-run only to add a
// wallpaper or change the encode.
//
// Adding one: pick a NASA ID, add it below, run the script, then wire it into
// `PHOTO_WALLPAPERS` in systems/ambient/lib/wallpaper.ts.
// =============================================================================

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "public", "wallpapers");
const CACHE_DIR = path.join(process.cwd(), "node_modules", ".cache", "wallpapers");

/** Longest edge of the encoded file. Retina-sharp without being a download. */
const MAX_EDGE = 2560;
const WEBP_QUALITY = 72;

/**
 * The picker shows every wallpaper at once, so tiles get their own tiny
 * rendition — otherwise opening it would pull the full set at full size.
 */
const THUMB_EDGE = 480;
const THUMB_QUALITY = 60;

// -----------------------------------------------------------------------------
// The sources.
//
// Chosen for what a wallpaper on a text-first site actually needs: an empty
// frame with one dominant tonal direction and almost no detail behind the
// reading column. That is why they are all limbs, fields and voids rather than
// landscapes — measured, not guessed (see `--report`).
// -----------------------------------------------------------------------------

const SOURCES = [
  {
    slug: "limb-light",
    nasaId: "iss038e036501",
    credit: "NASA / ISS Expedition 38",
    caption: "Cloud field over the southwestern Indian Ocean, 2014",
  },
  {
    slug: "limb-dark",
    nasaId: "iss061e123824",
    credit: "NASA / ISS Expedition 61",
    caption: "First rays of an orbital sunrise on Earth's limb, 2020",
  },
  {
    slug: "ember-light",
    nasaId: "s44-79-046",
    credit: "NASA / STS-44",
    caption: "Fog bank over the Namib Desert dune field, 1991",
  },
  {
    slug: "ember-dark",
    nasaId: "iss028e007274",
    credit: "NASA / ISS Expedition 28",
    caption: "The Sun peeking over the limb of the Earth, 2011",
  },
  {
    slug: "icefall-light",
    nasaId: "GSFC_20171208_Archive_e001754",
    credit: "NASA / GSFC / Jefferson Beck (Operation IceBridge)",
    caption: "Calving front of the Jakobshavn Glacier, Greenland, 2012",
  },
  {
    slug: "icefall-dark",
    nasaId: "iss069e025337",
    credit: "NASA / ISS Expedition 69",
    caption: "Last rays of an orbital sunset silhouetting cloud tops, 2023",
  },
];

const ASSET_BASE = "https://images-assets.nasa.gov/image";

async function download(nasaId) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const cached = path.join(CACHE_DIR, `${nasaId}.jpg`);
  if (!process.argv.includes("--force")) {
    try {
      return { buffer: await fs.readFile(cached), cached: true };
    } catch {
      // fall through to the network
    }
  }

  // `~orig` can be a 100MB TIFF-grade JPEG; `~large` is already well past our
  // 2560px target, so it is the right rendition to pull.
  let lastErr;
  for (const rendition of ["large", "orig"]) {
    const url = `${ASSET_BASE}/${nasaId}/${nasaId}~${rendition}.jpg`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastErr = new Error(`${res.status} ${res.statusText} for ${url}`);
        continue;
      }
      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.writeFile(cached, buffer);
      return { buffer, cached: false };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`could not download ${nasaId}`);
}

/**
 * The flat colour painted under the photo, so the frame is never bare while it
 * decodes and any letterboxing blends in. Taken from a heavy downsample rather
 * than the raw mean, which keeps it closer to what the eye reads as "the"
 * colour of the image.
 */
async function baseColor(buffer) {
  const { data } = await sharp(buffer)
    .resize(1, 1, { fit: "cover" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [r, g, b] = data;
  return `rgb(${r} ${g} ${b})`;
}

async function encode(buffer) {
  return sharp(buffer)
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toBuffer();
}

async function encodeThumb(buffer) {
  return sharp(buffer)
    .resize(THUMB_EDGE, THUMB_EDGE, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY, effort: 6 })
    .toBuffer();
}

function sha(buffer) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
}

async function main() {
  const check = process.argv.includes("--check");
  const report = process.argv.includes("--report");
  await fs.mkdir(OUT_DIR, { recursive: true });

  const manifest = [];
  let stale = 0;

  for (const src of SOURCES) {
    const { buffer, cached } = await download(src.nasaId);
    const encoded = await encode(buffer);
    const thumb = await encodeThumb(buffer);
    const base = await baseColor(encoded);
    const meta = await sharp(encoded).metadata();

    let differs = false;
    for (const [name, bytes] of [
      [`${src.slug}.webp`, encoded],
      [`${src.slug}-thumb.webp`, thumb],
    ]) {
      const outPath = path.join(OUT_DIR, name);
      let existing = null;
      try {
        existing = await fs.readFile(outPath);
      } catch {
        // not written yet
      }
      if (!existing || sha(existing) !== sha(bytes)) {
        differs = true;
        if (!check) await fs.writeFile(outPath, bytes);
      }
    }
    if (differs) stale += 1;

    manifest.push({
      slug: src.slug,
      nasaId: src.nasaId,
      credit: src.credit,
      caption: src.caption,
      base,
      width: meta.width,
      height: meta.height,
      bytes: encoded.length,
      thumbBytes: thumb.length,
    });

    const kb = (encoded.length / 1024).toFixed(0);
    const state = check ? (differs ? "STALE" : "ok") : differs ? "written" : "unchanged";
    console.log(
      `${src.slug.padEnd(16)} ${String(meta.width).padStart(5)}x${String(meta.height).padEnd(5)} ` +
        `${kb.padStart(5)}KB +${String(Math.round(thumb.length / 1024)).padStart(3)}KB thumb  ` +
        `base ${base.padEnd(20)} ${cached ? "" : "(downloaded) "}${state}`
    );
  }

  if (report) {
    // Luminance / detail of each encoded file — the numbers the curation is
    // based on. A light half wants high lum and low detail; behind body copy,
    // detail is what actually hurts.
    console.log("\nslug              lum  detail");
    for (const m of manifest) {
      const st = await sharp(path.join(OUT_DIR, `${m.slug}.webp`)).stats();
      const ch = st.channels.slice(0, 3);
      const [r, g, b] = ch.map((c) => c.mean);
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const detail = ch.reduce((a, c) => a + c.stdev, 0) / ch.length;
      console.log(m.slug.padEnd(16), String(Math.round(lum)).padStart(4), String(Math.round(detail)).padStart(7));
    }
  }

  const manifestPath = path.join(OUT_DIR, "manifest.json");
  const manifestJson = JSON.stringify({ sources: manifest }, null, 2) + "\n";
  if (check) {
    let current = null;
    try {
      current = await fs.readFile(manifestPath, "utf8");
    } catch {
      // missing
    }
    if (current !== manifestJson) stale += 1;
    if (stale > 0) {
      console.error(`\n${stale} wallpaper file(s) out of date. Run: pnpm wallpapers:fetch`);
      process.exitCode = 1;
    } else {
      console.log("\nAll wallpaper files current.");
    }
    return;
  }

  await fs.writeFile(manifestPath, manifestJson);
  console.log(`\nWrote ${manifest.length} wallpapers to public/wallpapers/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
