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
 *
 * The wordmark is always set in the site's mono family (JetBrains Mono) and
 * drawn verbatim (no case transform) — the icon is a terminal-style system
 * mark, by design, so typeface and casing are not levers.
 */

/** Background treatment. "solid" plus the texture/gradient family. */
export type IconBackgroundStyle =
  | "solid"
  | "dots"
  | "grid"
  | "lines"
  | "noise"
  | "gradient";

/**
 * Per-texture parameters. Each texture style owns its *own* copy of these, so
 * switching styles never inherits another texture's tuning — dots can be faint
 * white while a gradient keeps its own end color and angle, independently.
 *
 * Not every field applies to every style (gradient ignores `scale`; only
 * `lines`/`gradient` use `angle`; only `gradient` uses `gradientColor`), but a
 * uniform shape keeps normalization and the editor simple.
 */
export interface TextureSettings {
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

export interface IconBackground {
  /** Active background treatment. */
  style: IconBackgroundStyle;
  /** Base canvas fill, shared across all styles. */
  color: string;
  /** Independent settings per texture style. */
  dots: TextureSettings;
  grid: TextureSettings;
  lines: TextureSettings;
  noise: TextureSettings;
  gradient: TextureSettings;
}

export interface IconConfig {
  // --- Typography ----------------------------------------------------------
  /** The wordmark. "mostly just the name of the site." Drawn verbatim, mono. */
  text: string;
  /** Numeric weight (100–900). */
  fontWeight: number;
  /** Font size as a fraction of the canvas edge (0–1). */
  fontSize: number;
  /** Tracking in em (can be negative). */
  letterSpacing: number;
  italic: boolean;
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

/** The mono stack the wordmark is always set in. */
export const MONO_FONT_STACK = "'JetBrains Mono', ui-monospace, monospace";
/** The embeddable Google font backing the mono stack. */
export const MONO_GOOGLE_FONT = "JetBrains Mono";

/** Texture styles (everything except the plain `solid` fill). */
export const TEXTURE_STYLES: Exclude<IconBackgroundStyle, "solid">[] = [
  "dots",
  "grid",
  "lines",
  "noise",
  "gradient",
];

/** Per-texture default tunings — distinct so each style looks right on its own. */
const TEXTURE_DEFAULTS: Record<
  Exclude<IconBackgroundStyle, "solid">,
  TextureSettings
> = {
  dots: { textureColor: "#ffffff", textureOpacity: 0.06, scale: 0.5, angle: 0, gradientColor: "#2a2a2a" },
  grid: { textureColor: "#ffffff", textureOpacity: 0.07, scale: 0.5, angle: 0, gradientColor: "#2a2a2a" },
  lines: { textureColor: "#ffffff", textureOpacity: 0.05, scale: 0.4, angle: 45, gradientColor: "#2a2a2a" },
  noise: { textureColor: "#ffffff", textureOpacity: 0.12, scale: 0.5, angle: 0, gradientColor: "#2a2a2a" },
  gradient: { textureColor: "#ffffff", textureOpacity: 0, scale: 0.5, angle: 120, gradientColor: "#2a2a2a" },
};

/**
 * Default icon — the terminal-style system mark.
 *
 * Mono "λHUX" (the site's λ system identifier) on the paco.me-inspired
 * `#1a1a1a` canvas, lifted by a barely-there grid. Grayscale only.
 */
export const DEFAULT_ICON_CONFIG: IconConfig = {
  text: "λHUX",
  fontWeight: 300,
  fontSize: 0.3,
  letterSpacing: 0.04,
  italic: false,
  textColor: "#ededed",
  offsetX: 0,
  offsetY: 0,
  background: {
    style: "grid",
    color: "#1a1a1a",
    dots: { ...TEXTURE_DEFAULTS.dots },
    grid: { ...TEXTURE_DEFAULTS.grid },
    lines: { ...TEXTURE_DEFAULTS.lines },
    noise: { ...TEXTURE_DEFAULTS.noise },
    gradient: { ...TEXTURE_DEFAULTS.gradient },
  },
  cornerRadius: 0,
};

/** Short wordmark presets surfaced as quick-picks in the editor. */
export const TEXT_PRESETS = ["λHUX", "hux", "λhux", "λ", "hux.pro"] as const;

const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const BACKGROUND_STYLES: IconBackgroundStyle[] = [
  "solid",
  ...TEXTURE_STYLES,
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

function normalizeTexture(
  input: unknown,
  d: TextureSettings,
): TextureSettings {
  const t = (input ?? {}) as Partial<TextureSettings>;
  return {
    textureColor: str(t.textureColor, d.textureColor),
    textureOpacity: num(t.textureOpacity, d.textureOpacity, 0, 1),
    scale: num(t.scale, d.scale, 0, 1),
    angle: num(t.angle, d.angle, 0, 360),
    gradientColor: str(t.gradientColor, d.gradientColor),
  };
}

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
    fontWeight: num(raw.fontWeight, d.fontWeight, 100, 900),
    fontSize: num(raw.fontSize, d.fontSize, 0.1, 0.95),
    letterSpacing: num(raw.letterSpacing, d.letterSpacing, -0.2, 0.5),
    italic: bool(raw.italic, d.italic),
    textColor: str(raw.textColor, d.textColor),
    offsetX: num(raw.offsetX, d.offsetX, -0.5, 0.5),
    offsetY: num(raw.offsetY, d.offsetY, -0.5, 0.5),
    background: {
      style: oneOf(bg.style, BACKGROUND_STYLES, dbg.style),
      color: str(bg.color, dbg.color),
      dots: normalizeTexture(bg.dots, dbg.dots),
      grid: normalizeTexture(bg.grid, dbg.grid),
      lines: normalizeTexture(bg.lines, dbg.lines),
      noise: normalizeTexture(bg.noise, dbg.noise),
      gradient: normalizeTexture(bg.gradient, dbg.gradient),
    },
    cornerRadius: num(raw.cornerRadius, d.cornerRadius, 0, 0.5),
  };
}
