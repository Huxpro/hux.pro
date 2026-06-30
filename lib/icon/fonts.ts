/**
 * Glyph-subset font embedding for the standalone icon asset.
 *
 * A standalone SVG favicon can't rely on the page's fonts, so the wordmark
 * would fall back to a system serif/sans unless the glyphs travel *with* the
 * file. This module fetches a tiny, text-subset `@font-face` from Google Fonts
 * (the `&text=` param returns only the requested glyphs — typically a couple of
 * KB) and inlines the font data as a data URI.
 *
 * Network-dependent and therefore best-effort: every failure path returns
 * `null`, and `buildIconSvg` simply omits the `<style>` block, so the icon still
 * renders (with the platform's fallback font) when offline. This runs only
 * server-side (the dev save route, the build generator) — never in the browser.
 */

import { MONO_GOOGLE_FONT, type IconConfig } from "./config.ts";

// Identify as a modern browser so Google serves woff2; the `text=` subset keeps
// the payload to the handful of glyphs actually drawn.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// A legacy UA makes Google serve a static TrueType (.ttf) instead of woff2.
// resvg renders woff2 at the wrong weight (its decoder mishandles the subset),
// so the *rasterizer* needs ttf; browsers get woff2 fine via the embedded SVG.
const UA_LEGACY = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

const MIME_BY_FORMAT: Record<string, string> = {
  woff2: "font/woff2",
  woff: "font/woff",
  truetype: "font/ttf",
  opentype: "font/otf",
};

/** Build the css2 query for a single family/weight/style + glyph subset. */
function buildCssUrl(config: IconConfig): string | null {
  const family = MONO_GOOGLE_FONT.replace(/ /g, "+");
  // Only the unique glyphs we actually draw need to ship.
  const subset = Array.from(new Set(Array.from(config.text))).join("");
  if (!subset) return null;
  const ital = config.italic ? 1 : 0;
  const axis = `ital,wght@${ital},${Math.round(config.fontWeight)}`;
  return (
    `https://fonts.googleapis.com/css2?family=${family}:${axis}` +
    `&text=${encodeURIComponent(subset)}&display=block`
  );
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchDataUri(
  url: string,
  format: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = MIME_BY_FORMAT[format] ?? "font/woff2";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Fetch the raw wordmark font bytes (glyph-subset) for the rasterizer.
 *
 * Unlike the SVG path, the PNG renderer (resvg) doesn't read inline
 * `@font-face`; it needs the font as a buffer — and specifically a TrueType
 * one, since resvg renders Google's woff2 subset at the wrong weight. The
 * `UA_LEGACY` header makes Google return a static .ttf. Returns `null` on
 * failure so the caller can fall back to a system mono font.
 */
export async function fetchFontBuffer(
  config: IconConfig,
): Promise<Uint8Array | null> {
  const cssUrl = buildCssUrl(config);
  if (!cssUrl) return null;
  try {
    const css = await (
      await fetch(cssUrl, { headers: { "User-Agent": UA_LEGACY } })
    ).text();
    const m = css.match(/url\((https:\/\/[^)]+)\)/i);
    if (!m) return null;
    const res = await fetch(m[1], { headers: { "User-Agent": UA_LEGACY } });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Fetch a self-contained `@font-face` block for the icon's wordmark, with the
 * font binary inlined as a data URI. Returns `null` on any failure so the
 * caller can render without it.
 */
export async function fetchEmbeddedFontFace(
  config: IconConfig,
): Promise<string | null> {
  const cssUrl = buildCssUrl(config);
  if (!cssUrl) return null;

  const css = await fetchText(cssUrl);
  if (!css) return null;

  // Inline every `url(...) format('...')` source the subset CSS references.
  const srcRe = /url\((https:\/\/[^)]+)\)\s*format\(['"]?([a-z0-9-]+)['"]?\)/gi;
  const matches = Array.from(css.matchAll(srcRe));
  if (matches.length === 0) return null;

  let out = css;
  for (const m of matches) {
    const [whole, fontUrl, format] = m;
    const dataUri = await fetchDataUri(fontUrl, format.toLowerCase());
    if (!dataUri) return null; // partial inlining would still hit the network
    out = out.replace(whole, `url(${dataUri}) format('${format}')`);
  }
  return out;
}
