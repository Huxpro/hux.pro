// =============================================================================
// Colour maths shared by the runtime policy (`legibility.ts`) and the
// build-time profiler (`scripts/wallpaper-profile.ts`): sRGB ↔ OKLab, the
// transform the browser uses for `oklch()`, so a profile measured from a file
// and one read off the live sky speak the same language. No imports, so the
// script can load it under plain Node.
// =============================================================================

/** sRGB channels, 0..1. */
export type RGB01 = readonly [number, number, number];
export type Lab = { L: number; a: number; b: number };

export function srgbToLinear01(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function linearToSrgb01(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, c));
}

/** sRGB (0..1 channels) → OKLab. */
export function rgb01ToOklab([r, g, b]: RGB01): Lab {
  const lr = srgbToLinear01(r);
  const lg = srgbToLinear01(g);
  const lb = srgbToLinear01(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab → sRGB (0..1 channels, clamped). */
export function oklabToRgb01({ L, a, b }: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    linearToSrgb01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** WCAG relative luminance of sRGB (0..1 channels). */
export function relativeLuminance01([r, g, b]: RGB01): number {
  return 0.2126 * srgbToLinear01(r) + 0.7152 * srgbToLinear01(g) + 0.0722 * srgbToLinear01(b);
}

/**
 * The page colour of each theme, in sRGB bytes — `--background` in
 * globals.css (white, and #1a1a1a). The one place the number lives outside
 * the stylesheet; everything that composites "over the page" derives from it.
 */
export const PAGE_RGB: Record<"light" | "dark", readonly [number, number, number]> = {
  light: [255, 255, 255],
  dark: [26, 26, 26],
};
