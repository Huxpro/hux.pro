import { QuantizerCelebi, Score } from "@material/material-color-utilities";
import { FALLBACK_SEED, schemeRoles, type SchemeStyle } from "./scheme";

// =============================================================================
// Wallpaper colors — the seeds Android offers for a wallpaper.
//
// Android's pipeline, with the same library: the wallpaper, shrunk to about
// 112×112 pixels (`WallpaperColors.MAX_WALLPAPER_EXTRACTION_AREA`), is
// quantized to at most 128 colours (QuantizerCelebi), and `Score` ranks what
// is left for how good a source colour each would make — chroma, how much
// of the picture it covers, and not too close in hue to a better one — and
// keeps up to four. Those are the "Wallpaper colors" options; the first is
// what a phone picks by itself.
//
// A photograph is read once per file and remembered. The Sky and the
// Gradient are painted live, not loaded, so they have no pixels to read:
// their one option is the tint the ambient profile reads off the scene
// (seedFromTint), which is what a live wallpaper hands Android too.
// =============================================================================

const EXTRACTION_AREA = 112 * 112;
const cache = new Map<string, Promise<number[]>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function extract(src: string): Promise<number[]> {
  const img = await loadImage(src);
  const scale = Math.min(1, Math.sqrt(EXTRACTION_AREA / (img.naturalWidth * img.naturalHeight)));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 255) continue;
    pixels.push(((255 << 24) | (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) >>> 0);
  }
  const quantized = QuantizerCelebi.quantize(pixels, 128);
  return Score.score(quantized, { desired: 4, fallbackColorARGB: FALLBACK_SEED, filter: true });
}

/** Up to four seeds for a wallpaper image, best first. */
export function wallpaperSeeds(src: string): Promise<number[]> {
  let p = cache.get(src);
  if (!p) {
    p = extract(src).catch(() => []);
    cache.set(src, p);
  }
  return p;
}

/**
 * The four "Wallpaper colors" options, as Android's picker builds them: a
 * wallpaper rarely has four good seeds, so the slots are shared out between
 * the seeds it has and styles — one seed fills all four (tonal spot, then
 * Spritz — neutral here — vibrant, expressive), two take two each, four
 * take one each in tonal spot.
 */
const OPTION_STYLES: readonly SchemeStyle[] = ["tonal-spot", "neutral", "vibrant", "expressive"];
export const WALLPAPER_OPTIONS = 4;

export interface ColorOption {
  seed: number;
  style: SchemeStyle;
}

export function wallpaperOptions(seeds: readonly number[]): ColorOption[] {
  const list = seeds.length ? seeds.slice(0, WALLPAPER_OPTIONS) : [FALLBACK_SEED];
  const out: ColorOption[] = [];
  const per = Math.floor(WALLPAPER_OPTIONS / list.length);
  const extra = WALLPAPER_OPTIONS % list.length;
  list.forEach((seed, i) => {
    const n = per + (i < extra ? 1 : 0);
    for (let k = 0; k < n; k++) out.push({ seed, style: OPTION_STYLES[k] });
  });
  return out;
}

/**
 * Android's "Basic colors": seeds that ignore the wallpaper. Hues around the
 * wheel at the chroma a phone's presets carry, starting from its own
 * fallback blue.
 */
export const BASIC_SEEDS: readonly number[] = [
  FALLBACK_SEED,
  0xff00796b, // teal
  0xff386a20, // green
  0xff8c5000, // amber
  0xffb3261e, // red
  0xff9c27b0, // purple
];

/**
 * The swatch Android draws for an option: a disc, its top half the primary
 * accent and the bottom quarters the secondary and tertiary — the three
 * accents the seed spreads into under the chosen style, at the tone the
 * picker shows them (the dark scheme's accents: tone 80, `system_accent*_200`).
 */
export function swatchColors(
  seed: number,
  style: SchemeStyle,
): { primary: string; secondary: string; tertiary: string } {
  const roles = schemeRoles(seed, style, true);
  return { primary: roles.primary, secondary: roles.secondary, tertiary: roles.tertiary };
}
