/**
 * App-icon configuration — the single source of truth for the generative icon.
 *
 * This module is intentionally free of any React / Next.js imports so the exact
 * same config + normalization is shared by:
 *   - the editor (`app/editor/icon`),
 *   - the dev save route (`app/api/icon`),
 *   - the build-time generator (`scripts/icon-generate.ts`), and
 *   - the SVG renderer (`lib/icon/render.ts`).
 *
 * The committed config lives at `content/icon.json`. The icon is a *pure
 * function* of this config — same config in, byte-identical SVG out — which is
 * what makes the design "stable" and "generative" rather than a one-off asset.
 */

/** Which font stack the wordmark is set in. Mirrors the site's three families. */
export type IconFontFamily = "sans" | "serif" | "mono";

/** Casing applied to the wordmark before it is drawn. */
export type IconTextTransform = "none" | "lower" | "upper";

/** Background treatment. "solid" plus the texture/gradient family. */
export type IconBackgroundStyle =
  | "solid"
  | "dots"
  | "grid"
  | "lines"
  | "noise"
  | "gradient";

export interface IconBackground {
  /** Background treatment. */
  style: IconBackgroundStyle;
  /** Base fill (the canvas color). */
  color: string;
  /** Texture / pattern ink color (dots, grid, lines, noise). */
  textureColor: string;
  /** Texture ink opacity, 0–1. Keep low for "quiet" textures. */
  textureOpacity: number;
  /** Texture density / feature size, 0–1 (higher = denser / finer). */
  scale: number;
  /** Angle in degrees for `lines` and `gradient`. */
  angle: number;
  /** Second stop for the `gradient` style. */
  gradientColor: string;
}

export interface IconConfig {
  // --- Typography ----------------------------------------------------------
  /** The wordmark. "mostly just the name of the site." */
  text: string;
  fontFamily: IconFontFamily;
  /** Numeric weight (100–900). */
  fontWeight: number;
  /** Font size as a fraction of the canvas edge (0–1). */
  fontSize: number;
  /** Tracking in em (can be negative). */
  letterSpacing: number;
  italic: boolean;
  textTransform: IconTextTransform;
  /** Wordmark fill color. */
  textColor: string;
  /** Horizontal nudge as a fraction of the canvas edge (-0.5–0.5). */
  offsetX: number;
  /** Vertical nudge as a fraction of the canvas edge (-0.5–0.5). */
  offsetY: number;

  // --- Background ----------------------------------------------------------
  background: IconBackground;

  /** Baked corner radius as a fraction of the canvas edge (0 = full bleed). */
  cornerRadius: number;
}

/**
 * Default icon — a quiet, on-brand mark.
 *
 * Lowercase serif "hux" (the site's literary voice) on the paco.me-inspired
 * `#1a1a1a` canvas, lifted by a barely-there dot texture. Grayscale only, no
 * accent colors, per the design system.
 */
export const DEFAULT_ICON_CONFIG: IconConfig = {
  text: "hux",
  fontFamily: "serif",
  fontWeight: 500,
  fontSize: 0.46,
  letterSpacing: -0.02,
  italic: false,
  textTransform: "lower",
  textColor: "#ededed",
  offsetX: 0,
  offsetY: 0,
  background: {
    style: "dots",
    color: "#1a1a1a",
    textureColor: "#ffffff",
    textureOpacity: 0.06,
    scale: 0.5,
    angle: 45,
    gradientColor: "#2a2a2a",
  },
  cornerRadius: 0,
};

/** Short wordmark presets surfaced as quick-picks in the editor. */
export const TEXT_PRESETS = ["hux", "λhux", "λ", "H", "hux.pro"] as const;

const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const FONT_FAMILIES: IconFontFamily[] = ["sans", "serif", "mono"];
const TEXT_TRANSFORMS: IconTextTransform[] = ["none", "lower", "upper"];
const BACKGROUND_STYLES: IconBackgroundStyle[] = [
  "solid",
  "dots",
  "grid",
  "lines",
  "noise",
  "gradient",
];

const oneOf = <T,>(value: unknown, allowed: T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const str = (value: unknown, fallback: string): string =>
  typeof value === "string" ? value : fallback;

const num = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => (isFiniteNumber(value) ? clamp(value, min, max) : fallback);

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

/**
 * Coerce arbitrary (possibly partial / untrusted) input into a valid
 * `IconConfig`, filling gaps from `DEFAULT_ICON_CONFIG` and clamping ranges.
 *
 * Used by the save route and generator so a hand-edited or stale `icon.json`
 * can never produce a broken render — the icon always draws *something*.
 */
export function normalizeIconConfig(input: unknown): IconConfig {
  const raw = (input ?? {}) as Partial<IconConfig>;
  const d = DEFAULT_ICON_CONFIG;
  const bg = (raw.background ?? {}) as Partial<IconBackground>;
  const dbg = d.background;

  return {
    text: str(raw.text, d.text).slice(0, 24),
    fontFamily: oneOf(raw.fontFamily, FONT_FAMILIES, d.fontFamily),
    fontWeight: num(raw.fontWeight, d.fontWeight, 100, 900),
    fontSize: num(raw.fontSize, d.fontSize, 0.1, 0.95),
    letterSpacing: num(raw.letterSpacing, d.letterSpacing, -0.2, 0.5),
    italic: bool(raw.italic, d.italic),
    textTransform: oneOf(raw.textTransform, TEXT_TRANSFORMS, d.textTransform),
    textColor: str(raw.textColor, d.textColor),
    offsetX: num(raw.offsetX, d.offsetX, -0.5, 0.5),
    offsetY: num(raw.offsetY, d.offsetY, -0.5, 0.5),
    background: {
      style: oneOf(bg.style, BACKGROUND_STYLES, dbg.style),
      color: str(bg.color, dbg.color),
      textureColor: str(bg.textureColor, dbg.textureColor),
      textureOpacity: num(bg.textureOpacity, dbg.textureOpacity, 0, 1),
      scale: num(bg.scale, dbg.scale, 0, 1),
      angle: num(bg.angle, dbg.angle, 0, 360),
      gradientColor: str(bg.gradientColor, dbg.gradientColor),
    },
    cornerRadius: num(raw.cornerRadius, d.cornerRadius, 0, 0.5),
  };
}

/** Map a font family choice to a CSS `font-family` list with fallbacks. */
export function fontFamilyStack(family: IconFontFamily): string {
  switch (family) {
    case "serif":
      return "'Newsreader', 'Noto Serif SC', Georgia, serif";
    case "mono":
      return "'JetBrains Mono', ui-monospace, monospace";
    case "sans":
    default:
      return "'Inter', system-ui, sans-serif";
  }
}

/** The primary (embeddable) Google font for a family choice. */
export function googleFontName(family: IconFontFamily): string {
  switch (family) {
    case "serif":
      return "Newsreader";
    case "mono":
      return "JetBrains Mono";
    case "sans":
    default:
      return "Inter";
  }
}
