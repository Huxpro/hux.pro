import {
  Hct,
  MaterialDynamicColors,
  SchemeExpressive,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeTonalSpot,
  SchemeVibrant,
  hexFromArgb,
  type DynamicColor,
  type DynamicScheme,
} from "@material/material-color-utilities";

// =============================================================================
// Dynamic color — the Android theme's palette, from the wallpaper.
//
// What Android 12+ does with a wallpaper, with Google's own library: one
// source colour → five tonal palettes (primary, secondary, tertiary, neutral,
// neutral variant) → the colour *roles* a component paints with. The roles
// are the contract, never the tones: a widget asks for `surface-container`
// and `on-surface-variant`, and whatever wallpaper is up, in whatever theme,
// those two are legible against each other by construction.
//
// The source is the wallpaper's dominant colour, the same one the ambient
// profiler already measures for the glass tint and the glow (a photograph's
// measured once, the Sky's read off the live scene). A grey picture has no
// colour to give, so — like Android, which falls back to a default seed when
// a wallpaper yields no usable colour — it gets Google Blue.
//
// The spec is 2025: Material 3 Expressive's colour, which is what a phone on
// Android 16 generates from the same wallpaper.
// =============================================================================

/**
 * The "Wallpaper colors" styles Android offers under Wallpaper & style, by
 * the names its schemes carry. `tonal-spot` is Android's default.
 */
export type SchemeStyle =
  | "tonal-spot"
  | "neutral"
  | "vibrant"
  | "expressive"
  | "monochrome";

export const SCHEME_STYLES: readonly SchemeStyle[] = [
  "tonal-spot",
  "neutral",
  "vibrant",
  "expressive",
  "monochrome",
];

/** Android's fallback seed when the wallpaper gives no colour: Google Blue. */
export const FALLBACK_SEED = 0xff1b6ef3;

/** The roles the Android theme publishes, as `--md-<name>`. */
const ROLES: Record<string, DynamicColor> = {
  primary: MaterialDynamicColors.primary,
  "on-primary": MaterialDynamicColors.onPrimary,
  "primary-container": MaterialDynamicColors.primaryContainer,
  "on-primary-container": MaterialDynamicColors.onPrimaryContainer,
  secondary: MaterialDynamicColors.secondary,
  "on-secondary": MaterialDynamicColors.onSecondary,
  "secondary-container": MaterialDynamicColors.secondaryContainer,
  "on-secondary-container": MaterialDynamicColors.onSecondaryContainer,
  tertiary: MaterialDynamicColors.tertiary,
  "on-tertiary": MaterialDynamicColors.onTertiary,
  "tertiary-container": MaterialDynamicColors.tertiaryContainer,
  "on-tertiary-container": MaterialDynamicColors.onTertiaryContainer,
  surface: MaterialDynamicColors.surface,
  "surface-dim": MaterialDynamicColors.surfaceDim,
  "surface-bright": MaterialDynamicColors.surfaceBright,
  "surface-container-lowest": MaterialDynamicColors.surfaceContainerLowest,
  "surface-container-low": MaterialDynamicColors.surfaceContainerLow,
  "surface-container": MaterialDynamicColors.surfaceContainer,
  "surface-container-high": MaterialDynamicColors.surfaceContainerHigh,
  "surface-container-highest": MaterialDynamicColors.surfaceContainerHighest,
  "on-surface": MaterialDynamicColors.onSurface,
  "on-surface-variant": MaterialDynamicColors.onSurfaceVariant,
  outline: MaterialDynamicColors.outline,
  "outline-variant": MaterialDynamicColors.outlineVariant,
  "inverse-surface": MaterialDynamicColors.inverseSurface,
  "inverse-on-surface": MaterialDynamicColors.inverseOnSurface,
  "inverse-primary": MaterialDynamicColors.inversePrimary,
  "primary-fixed-dim": MaterialDynamicColors.primaryFixedDim,
  "on-primary-fixed": MaterialDynamicColors.onPrimaryFixed,
};

export const ROLE_NAMES = Object.keys(ROLES);

function makeScheme(
  style: SchemeStyle,
  source: Hct,
  isDark: boolean,
): DynamicScheme {
  const args = [source, isDark, 0, "2025"] as const;
  switch (style) {
    case "neutral":
      return new SchemeNeutral(...args);
    case "vibrant":
      return new SchemeVibrant(...args);
    case "expressive":
      return new SchemeExpressive(...args);
    case "monochrome":
      return new SchemeMonochrome(...args);
    case "tonal-spot":
    default:
      return new SchemeTonalSpot(...args);
  }
}

export type RoleMap = Record<string, string>;

/** Every published role as `#rrggbb`, for one theme. */
export function schemeRoles(
  seed: number,
  style: SchemeStyle,
  isDark: boolean,
): RoleMap {
  const scheme = makeScheme(style, Hct.fromInt(seed), isDark);
  const out: RoleMap = {};
  for (const [name, color] of Object.entries(ROLES)) {
    out[name] = hexFromArgb(color.getArgb(scheme));
  }
  return out;
}

// -----------------------------------------------------------------------------
// OKLCH → ARGB, for the profiler's tint
// -----------------------------------------------------------------------------

const toByte = (x: number) => {
  const v = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
};

/** An OKLCH colour as an opaque ARGB int, clamped into sRGB. */
export function argbFromOklch(l: number, c: number, h: number): number {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = toByte(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_);
  const g = toByte(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_);
  const bl = toByte(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_);
  return ((0xff << 24) | (r << 16) | (g << 8) | bl) >>> 0;
}

/** Below this OKLCH chroma a picture is grey (the glow's threshold too). */
export const GREY_CHROMA = 0.03;

/**
 * The seed for a wallpaper tint. The profiler's lightness is the picture's,
 * which says nothing about the palette Android would build (tonal palettes
 * span every tone), so the seed takes the hue and chroma at a mid tone.
 */
export function seedFromTint(
  tint: { h: number; c: number } | null,
): number {
  if (!tint || tint.c < GREY_CHROMA) return FALLBACK_SEED;
  return argbFromOklch(0.62, Math.max(tint.c, 0.08), tint.h);
}

/** `--md-<role>` declarations for one theme, as a CSS block body. */
export function roleDeclarations(roles: RoleMap, prefix: string): string {
  return Object.entries(roles)
    .map(([name, hex]) => `--${prefix}-${name}: ${hex};`)
    .join(" ");
}
