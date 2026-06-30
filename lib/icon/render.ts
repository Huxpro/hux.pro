/**
 * Pure SVG renderer for the app icon.
 *
 * `buildIconSvg(config)` is a *total, deterministic* function: the same config
 * always yields the same SVG string, with no React, DOM, or Next.js. That makes
 * it usable identically by the live editor preview, the dev save route, and the
 * build-time generator — the same "one implementation" discipline as og-core.
 *
 * Fonts: the SVG references font *family names* (e.g. "Newsreader"). When the
 * markup is rendered on a page that already loads those families (the editor)
 * it is WYSIWYG for free. For a *standalone* asset (the committed favicon) the
 * caller passes `fontFaceCss` — an `@font-face` block with the glyphs inlined —
 * so the file is self-contained. See `lib/icon/fonts.ts`.
 */

import {
  MONO_FONT_STACK,
  type IconConfig,
  type TextureSettings,
} from "./config.ts";

export interface BuildIconOptions {
  /** Canvas edge length in px (SVG is square). Default 512. */
  size?: number;
  /**
   * Self-contained `@font-face` CSS to inline (with the font data as a data
   * URI). Omit for on-page rendering where the family is already loaded.
   */
  fontFaceCss?: string;
  /**
   * Force the baked corner radius regardless of config — used for the rounded
   * "app tile" preview. When omitted, `config.cornerRadius` is used.
   */
  cornerRadiusOverride?: number;
  /**
   * Prefix for internal element ids (clip/pattern/gradient/filter). Required
   * to be unique when multiple icons are inlined into the *same* document — as
   * the editor does — so their `url(#…)` references don't cross-wire. Defaults
   * to "icon" (fine for a standalone file).
   */
  idPrefix?: string;
  /**
   * Override the wordmark `font-family`. Defaults to the embeddable mono stack
   * (`'JetBrains Mono', …`) used by the standalone asset. The editor passes
   * `var(--font-mono)` so its on-page preview uses the *exact* JetBrains Mono
   * instance `next/font` loaded site-wide — same typeface, guaranteed WYSIWYG.
   */
  fontFamily?: string;
}

/** XML-escape text content / attribute values. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build the `<defs>` + background-overlay markup for the chosen texture.
 * Returns `{ defs, overlay }` so the caller can place defs once and the overlay
 * rect above the base fill. Reads the *active* style's own settings, so each
 * texture renders with its independent tuning.
 */
function buildBackground(
  config: IconConfig,
  size: number,
  rx: number,
  idPrefix: string,
): { defs: string; base: string; overlay: string } {
  const { background: bg } = config;
  const base = `<rect width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="${esc(
    bg.color,
  )}"/>`;

  // The active texture's own parameters (undefined for the plain solid fill).
  const tex: TextureSettings | undefined =
    bg.style === "solid" ? undefined : bg[bg.style];

  // A clip so textures honor the baked corner radius.
  const clipId = `${idPrefix}Clip`;
  const gradId = `${idPrefix}Grad`;
  const noiseId = `${idPrefix}Noise`;
  const texId = `${idPrefix}Tex`;
  const clip = `<clipPath id="${clipId}"><rect width="${size}" height="${size}" rx="${rx}" ry="${rx}"/></clipPath>`;
  const wrap = (inner: string) => `<g clip-path="url(#${clipId})">${inner}</g>`;

  // Plain fill (and the type-narrowing guard for `tex` below).
  if (bg.style === "solid" || !tex) {
    return { defs: clip, base, overlay: "" };
  }

  if (bg.style === "gradient") {
    // Angle → gradient vector on the unit square.
    const rad = (tex.angle * Math.PI) / 180;
    const x2 = (Math.cos(rad) * 0.5 + 0.5).toFixed(4);
    const y2 = (Math.sin(rad) * 0.5 + 0.5).toFixed(4);
    const x1 = (0.5 - Math.cos(rad) * 0.5).toFixed(4);
    const y1 = (0.5 - Math.sin(rad) * 0.5).toFixed(4);
    const defs =
      clip +
      `<linearGradient id="${gradId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
      `<stop offset="0" stop-color="${esc(bg.color)}"/>` +
      `<stop offset="1" stop-color="${esc(tex.gradientColor)}"/>` +
      `</linearGradient>`;
    const overlay = `<rect width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="url(#${gradId})"/>`;
    return { defs, base, overlay };
  }

  if (bg.style === "noise") {
    // feTurbulence fractal noise, tinted to the texture color and faded.
    // baseFrequency grows with `scale` for finer grain.
    const freq = (0.4 + tex.scale * 1.4).toFixed(3);
    const defs =
      clip +
      `<filter id="${noiseId}" x="0" y="0" width="100%" height="100%">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" stitchTiles="stitch" result="n"/>` +
      `<feColorMatrix in="n" type="saturate" values="0"/>` +
      `</filter>`;
    const overlay = wrap(
      `<rect width="${size}" height="${size}" filter="url(#${noiseId})" opacity="${tex.textureOpacity}" fill="${esc(
        tex.textureColor,
      )}"/>`,
    );
    return { defs, base, overlay };
  }

  // Tiled patterns: dots / grid / lines. Tile size shrinks as scale grows.
  const tile = Math.round(size * (0.18 - tex.scale * 0.13)); // ~ size*0.05–0.18
  const t = Math.max(8, tile);
  let patternBody = "";
  let patternTransform = "";

  if (bg.style === "dots") {
    const r = Math.max(1, t * 0.12);
    patternBody = `<circle cx="${(t / 2).toFixed(2)}" cy="${(t / 2).toFixed(
      2,
    )}" r="${r.toFixed(2)}" fill="${esc(tex.textureColor)}"/>`;
  } else if (bg.style === "grid") {
    const w = Math.max(1, t * 0.04);
    patternBody =
      `<path d="M ${t} 0 L 0 0 0 ${t}" fill="none" stroke="${esc(
        tex.textureColor,
      )}" stroke-width="${w.toFixed(2)}"/>`;
  } else {
    // lines
    const w = Math.max(1, t * 0.18);
    patternBody = `<rect x="0" y="0" width="${(w).toFixed(
      2,
    )}" height="${t}" fill="${esc(tex.textureColor)}"/>`;
    patternTransform = ` patternTransform="rotate(${tex.angle})"`;
  }

  const defs =
    clip +
    `<pattern id="${texId}" width="${t}" height="${t}" patternUnits="userSpaceOnUse"${patternTransform}>${patternBody}</pattern>`;
  const overlay = wrap(
    `<rect width="${size}" height="${size}" fill="url(#${texId})" opacity="${tex.textureOpacity}"/>`,
  );
  return { defs, base, overlay };
}

/**
 * Render the icon to an SVG string.
 */
export function buildIconSvg(
  config: IconConfig,
  options: BuildIconOptions = {},
): string {
  const size = options.size ?? 512;
  const idPrefix = options.idPrefix ?? "icon";
  const rx =
    (options.cornerRadiusOverride ?? config.cornerRadius) * size;

  const { defs, base, overlay } = buildBackground(config, size, rx, idPrefix);

  // Typography
  const fontSizePx = config.fontSize * size;
  const cx = size / 2 + config.offsetX * size;
  const cy = size / 2 + config.offsetY * size;
  const letterSpacingPx = config.letterSpacing * fontSizePx;
  const text = config.text;

  const style = options.fontFaceCss
    ? `<style>${options.fontFaceCss}</style>`
    : "";

  // `dominant-baseline:central` + `text-anchor:middle` centers the glyphs on
  // (cx, cy) across renderers far more reliably than dy hacks.
  const textEl =
    `<text x="${cx.toFixed(2)}" y="${cy.toFixed(2)}" ` +
    `font-family="${options.fontFamily ?? MONO_FONT_STACK}" ` +
    `font-size="${fontSizePx.toFixed(2)}" ` +
    `font-weight="${config.fontWeight}" ` +
    `font-style="${config.italic ? "italic" : "normal"}" ` +
    `letter-spacing="${letterSpacingPx.toFixed(3)}" ` +
    `fill="${esc(config.textColor)}" ` +
    `text-anchor="middle" dominant-baseline="central" ` +
    `xml:space="preserve">${esc(text)}</text>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(text)}">` +
    `<defs>${defs}</defs>${style}${base}${overlay}${textEl}</svg>`
  );
}

/** Convenience: SVG markup as a `data:` URI (for `<img src>` previews). */
export function iconSvgDataUri(
  config: IconConfig,
  options: BuildIconOptions = {},
): string {
  const svg = buildIconSvg(config, options);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
