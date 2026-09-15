#!/usr/bin/env node
// =============================================================================
// wallpaper-profile — measure every wallpaper once, statically.
//
//   pnpm wallpapers:profile          # write systems/ambient/lib/wallpaper-profiles.json
//   pnpm wallpapers:profile:check    # CI: regenerate, diff, exit 1 on drift
//
// The legibility system (docs/system-legibility.md) never looks at a pixel at
// runtime. Everything it needs to know about a wallpaper — how bright it is
// where the text sits, how busy it is, what colour it leans — is measured here
// and committed as a small JSON table. At runtime the policy in
// `systems/ambient/lib/legibility.ts` turns a profile into a handful of CSS
// variables: a few multiplies, no canvas, no image decode.
//
// Pictures are sampled through sharp. The Classic weather palettes have no
// pixels, but they are built from three authored colours
// (`getWeatherPaletteColors`), so they get a profile computed from those —
// same shape, same table. The Sky and the Gradient are derived live from the
// scene and profiled at runtime by `profileFromScene` (lib/legibility.ts);
// they have no entry here.
//
// What is measured (all in OKLab, so "0.1 brighter" means the same thing on a
// blue sky and a grey rock):
//
//   lum       mean lightness of the whole frame, 0..1
//   zones     mean lightness of the top / middle / bottom thirds — the home
//             screen's identifier and greeting sit in the top third, and that
//             is the band that decides whether bare text flips to light ink
//   mean      mean colour, for the lab's contrast estimate
//   contrast  standard deviation of lightness — how much the picture varies
//   edges     mean local gradient of lightness — how much fine detail there is.
//             A soft gradient scores ~0, raked sand scores high. This is what
//             "busy" means downstream.
//   chroma    mean OKLab chroma — how colourful the picture is at all
//   tint      the dominant chromatic colour as OKLCH, or null when the picture
//             is effectively grey. Picked by a chroma-weighted hue histogram,
//             so a grey rock with one red leaf still says "red", quietly.
//
// Nothing here is a design decision; the numbers are facts about the files.
// The decisions — how much relief a busy wallpaper earns, when text flips —
// live in the policy, where the lab can tune them live.
// =============================================================================

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import {
  getSunEventPaletteColors,
  getWeatherPaletteColors,
} from "../systems/ambient/lib/gradient.ts";
import {
  BUILT_IN_WALLPAPERS,
  isSingleImage,
  type WallpaperAsset,
} from "../systems/ambient/lib/wallpaper.ts";
import { oklabToRgb01, PAGE_RGB, rgb01ToOklab, type Lab } from "../systems/ambient/lib/color.ts";
import type { WeatherCondition } from "../systems/ambient/lib/weather.ts";
import {
  profileKeyForAsset,
  profileKeyForWeather,
  type WallpaperProfile,
  type WallpaperProfiles,
} from "../systems/ambient/lib/wallpaper-profile.ts";

const PUBLIC = path.join(process.cwd(), "public");
const OUT = path.join(process.cwd(), "systems/ambient/lib/wallpaper-profiles.json");

/** Sample grid. 96×60 is the 16:10 desktop at 1/26 scale — enough to see a
 *  horizon and a subject, cheap enough to run over 40 files in a second. */
const GRID = { width: 96, height: 60 };

const WEATHER_CONDITIONS: WeatherCondition[] = [
  "clear",
  "cloudy",
  "fog",
  "rain",
  "snow",
  "thunder",
];

// -----------------------------------------------------------------------------
// Colour maths — shared with the runtime policy (systems/ambient/lib/color.ts),
// so a profile measured here and one read off the live sky agree.
// -----------------------------------------------------------------------------

const rgbToOklab = (r: number, g: number, b: number): Lab => rgb01ToOklab([r / 255, g / 255, b / 255]);
const oklabToRgb = (lab: Lab): [number, number, number] =>
  oklabToRgb01(lab).map((c) => Math.round(c * 255)) as [number, number, number];

/** `oklch(L C H)` / `oklch(L C H / a)` as the gradient palette writes it. */
function parseOklch(value: string): { L: number; C: number; H: number; alpha: number } {
  const m = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)/);
  if (!m) throw new Error(`Not an oklch() colour: ${value}`);
  return { L: +m[1], C: +m[2], H: +m[3], alpha: m[4] === undefined ? 1 : +m[4] };
}

function oklchToLab(L: number, C: number, H: number): Lab {
  const h = (H * Math.PI) / 180;
  return { L, a: C * Math.cos(h), b: C * Math.sin(h) };
}

const round = (n: number, places = 3) => Number(n.toFixed(places));

// -----------------------------------------------------------------------------
// The measurement
// -----------------------------------------------------------------------------

/**
 * Profile a grid of OKLab samples laid out row-major at GRID size.
 *
 * The same reducer serves pictures (sampled) and gradients (synthesised), so a
 * weather profile is comparable to a photograph's — "top third lightness" means
 * the same thing for both.
 */
function profileSamples(samples: Lab[], width: number, height: number): WallpaperProfile {
  const n = samples.length;
  const third = Math.floor(height / 3);

  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  let sumC = 0;
  const zoneSum = [0, 0, 0];
  const zoneCount = [0, 0, 0];

  for (let i = 0; i < n; i++) {
    const { L, a, b } = samples[i];
    sumL += L;
    sumA += a;
    sumB += b;
    sumC += Math.hypot(a, b);
    const row = Math.floor(i / width);
    const zone = Math.min(2, Math.floor(row / third));
    zoneSum[zone] += L;
    zoneCount[zone] += 1;
  }

  const lum = sumL / n;

  // Spread of lightness, and how much of it happens between neighbours.
  let varL = 0;
  let edgeSum = 0;
  let edgeCount = 0;
  for (let i = 0; i < n; i++) {
    const L = samples[i].L;
    varL += (L - lum) ** 2;
    const x = i % width;
    const y = Math.floor(i / width);
    if (x + 1 < width) {
      edgeSum += Math.abs(L - samples[i + 1].L);
      edgeCount++;
    }
    if (y + 1 < height) {
      edgeSum += Math.abs(L - samples[i + width].L);
      edgeCount++;
    }
  }

  // Dominant chromatic colour: a chroma-weighted hue histogram, peak bin plus
  // its neighbours, then the weighted mean of those samples. Near-grey pixels
  // (chroma under 0.03 — the paper white of a snowfield, the grey of a rock)
  // vote for nothing, so they cannot pull the hue toward brown.
  const BINS = 24;
  const bins = new Array<number>(BINS).fill(0);
  for (const { a, b } of samples) {
    const c = Math.hypot(a, b);
    if (c < 0.03) continue;
    const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
    bins[Math.floor(h / (360 / BINS)) % BINS] += c;
  }
  let peak = 0;
  for (let i = 1; i < BINS; i++) if (bins[i] > bins[peak]) peak = i;
  const totalVotes = bins.reduce((s, v) => s + v, 0);

  let tint: WallpaperProfile["tint"] = null;
  if (totalVotes > 0) {
    const wanted = new Set([(peak + BINS - 1) % BINS, peak, (peak + 1) % BINS]);
    let tA = 0;
    let tB = 0;
    let tL = 0;
    let tW = 0;
    for (const { L, a, b } of samples) {
      const c = Math.hypot(a, b);
      if (c < 0.03) continue;
      const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
      if (!wanted.has(Math.floor(h / (360 / BINS)) % BINS)) continue;
      tA += a * c;
      tB += b * c;
      tL += L * c;
      tW += c;
    }
    if (tW > 0) {
      const a = tA / tW;
      const b = tB / tW;
      tint = {
        l: round(tL / tW),
        c: round(Math.hypot(a, b)),
        h: round(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360, 1),
      };
    }
  }

  const [mr, mg, mb] = oklabToRgb({ L: lum, a: sumA / n, b: sumB / n });

  return {
    lum: round(lum),
    zones: {
      top: round(zoneSum[0] / zoneCount[0]),
      mid: round(zoneSum[1] / zoneCount[1]),
      bottom: round(zoneSum[2] / zoneCount[2]),
    },
    mean: [mr, mg, mb],
    contrast: round(Math.sqrt(varL / n)),
    edges: round(edgeSum / edgeCount, 4),
    chroma: round(sumC / n),
    tint,
  };
}

async function profileImage(asset: WallpaperAsset): Promise<WallpaperProfile> {
  const { data } = await sharp(path.join(PUBLIC, asset.src))
    .resize(GRID.width, GRID.height, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const samples: Lab[] = [];
  for (let i = 0; i < data.length; i += 3) {
    samples.push(rgbToOklab(data[i], data[i + 1], data[i + 2]));
  }
  return profileSamples(samples, GRID.width, GRID.height);
}

/**
 * A gradient's profile, synthesised from its three colours.
 *
 * `buildGradient` paints two radial spots in the top band over a vertical
 * linear from the second colour to the ground. Rather than rasterise CSS, this
 * lays the same composition out on the sample grid: the spot colour where the
 * spots sit, the ground colour toward the bottom, blended by distance. It is
 * an approximation of the paint, and a faithful one for a profile that only
 * asks "how bright is the top third" and "what colour is this".
 */
function profileGradient(colors: readonly [string, string, string], base: Lab): WallpaperProfile {
  const [a, b, c] = colors.map(parseOklch);
  const toLab = (x: ReturnType<typeof parseOklch>) => {
    // Alpha composites over the page (`BASE` in gradient.ts), which the
    // sunrise/sunset palettes rely on.
    const lab = oklchToLab(x.L, x.C, x.H);
    return {
      L: base.L + (lab.L - base.L) * x.alpha,
      a: base.a + (lab.a - base.a) * x.alpha,
      b: base.b + (lab.b - base.b) * x.alpha,
    };
  };
  const spotA = toLab(a);
  const spotB = toLab(b);
  const ground = toLab(c);

  const samples: Lab[] = [];
  for (let y = 0; y < GRID.height; y++) {
    for (let x = 0; x < GRID.width; x++) {
      const u = x / (GRID.width - 1);
      const v = y / (GRID.height - 1);
      // Linear: b at the top → c at 70% down, as GEOMETRY.weather does.
      const t = Math.min(1, v / 0.7);
      let L = spotB.L + (ground.L - spotB.L) * t;
      let A = spotB.a + (ground.a - spotB.a) * t;
      let B = spotB.b + (ground.b - spotB.b) * t;
      // Radial spots at (20%,10%) and (80%,0%), ~35% of the width across.
      const spot = (cx: number, cy: number, col: Lab) => {
        const d = Math.hypot((u - cx) / 0.35, (v - cy) / 0.5);
        const w = Math.max(0, 1 - d);
        L += (col.L - L) * w;
        A += (col.a - A) * w;
        B += (col.b - B) * w;
      };
      spot(0.2, 0.1, spotA);
      spot(0.8, 0.0, spotB);
      samples.push({ L, a: A, b: B });
    }
  }
  return profileSamples(samples, GRID.width, GRID.height);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

const PAGE_BASE: Record<"light" | "dark", Lab> = {
  light: rgbToOklab(...PAGE_RGB.light),
  dark: rgbToOklab(...PAGE_RGB.dark),
};

async function build(): Promise<WallpaperProfiles> {
  const images: Record<string, WallpaperProfile> = {};
  for (const wallpaper of BUILT_IN_WALLPAPERS) {
    const halves = isSingleImage(wallpaper)
      ? [wallpaper.light]
      : [wallpaper.light, wallpaper.dark];
    for (const asset of halves) {
      images[profileKeyForAsset(asset)] = await profileImage(asset);
    }
  }

  const weather: Record<string, WallpaperProfile> = {};
  for (const theme of ["light", "dark"] as const) {
    for (const condition of WEATHER_CONDITIONS) {
      for (const isDay of [true, false]) {
        weather[profileKeyForWeather({ condition, isDay, theme })] = profileGradient(
          getWeatherPaletteColors({ condition, isDay, theme }),
          PAGE_BASE[theme],
        );
      }
    }
    for (const event of ["sunrise", "sunset"] as const) {
      weather[profileKeyForWeather({ event, theme })] = profileGradient(
        getSunEventPaletteColors({ event, theme }),
        PAGE_BASE[theme],
      );
    }
  }

  return { grid: GRID, images, weather };
}

function serialize(profiles: WallpaperProfiles): string {
  return JSON.stringify(profiles, null, 2) + "\n";
}

function printTable(profiles: WallpaperProfiles) {
  const rows = [
    ...Object.entries(profiles.images),
    ...Object.entries(profiles.weather),
  ];
  const header = ["key", "lum", "top", "mid", "bot", "contrast", "edges", "chroma", "tint"];
  console.log(header.map((h, i) => (i === 0 ? h.padEnd(28) : h.padStart(8))).join(""));
  for (const [key, p] of rows) {
    const tint = p.tint ? `${p.tint.h.toFixed(0)}°/${p.tint.c.toFixed(2)}` : "—";
    console.log(
      [
        key.padEnd(28),
        p.lum.toFixed(2).padStart(8),
        p.zones.top.toFixed(2).padStart(8),
        p.zones.mid.toFixed(2).padStart(8),
        p.zones.bottom.toFixed(2).padStart(8),
        p.contrast.toFixed(2).padStart(8),
        p.edges.toFixed(3).padStart(8),
        p.chroma.toFixed(2).padStart(8),
        tint.padStart(8),
      ].join(""),
    );
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const profiles = await build();
  const next = serialize(profiles);

  if (check) {
    let current = "";
    try {
      current = await fs.readFile(OUT, "utf8");
    } catch {
      // Missing file is drift.
    }
    if (current !== next) {
      console.error(
        `wallpaper-profiles.json is stale — run \`pnpm wallpapers:profile\` and commit the result.`,
      );
      process.exit(1);
    }
    console.log(`wallpaper-profiles.json is up to date (${Object.keys(profiles.images).length} images, ${Object.keys(profiles.weather).length} gradients).`);
    return;
  }

  await fs.writeFile(OUT, next);
  printTable(profiles);
  console.log(`\nWrote ${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
