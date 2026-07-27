import { cn } from "@/lib/utils";

/**
 * Liquid-Glass surface — the single recipe for the System-UI floating layer.
 *
 * Every floating overlay on the site (the FAB, the Live Activity pill & panel,
 * the command palette, language toasts, hover peeks) is *frosted glass over the
 * page*: a translucent `card` fill so the blur shows through, `backdrop-blur-xl`
 * to actually frost it, and a hairline `border` that does most of the separating
 * in dark mode (a black shadow on a dark surface barely reads).
 *
 * Per the design philosophy the fill sits at **0.5–0.7 opacity — never opaque**,
 * or the `backdrop-blur` is invisible and the surface stops belonging to the
 * glass layer. That constraint is encoded here: `fill` only accepts 50/60/70, so
 * an opaque surface (e.g. the old `bg-background/95`) is simply not expressible
 * through this API. Reach for `surface()` instead of hand-rolling the classes.
 *
 * Elevation tiers, matching the `--shadow-*` tokens (see globals.css):
 *   • "raised"  — resting controls just off the page: the pill, the FAB.
 *   • "overlay" — focus / modal surfaces floating clearly above content:
 *                 expanded panels, the command palette, decision dialogs.
 *   • "none"    — the glass, but the shadow belongs to a *different* visible
 *                 surface: hover-peek panels whose inner card/thumb casts the
 *                 lift, so the container itself stays flat. Callers opt into a
 *                 shadow class per use.
 *
 * ── The recipe as data ──────────────────────────────────────────────────────
 * The invariants below are the machine-readable twin of the class output. Any
 * non-CSS consumer that needs the *numbers* behind a surface (the design lab at
 * /editor/surface plots and renders from them) reads `glassSpec()` rather than
 * re-transcribing the recipe — so the doc and the primitive can never drift.
 */

/** The plane every sanctioned glass surface lives on. */
export const GLASS_PLANE = "card" as const;
/** `backdrop-blur-xl`, as a class and as its px value — the frost radius. */
export const GLASS_BLUR_CLASS = "backdrop-blur-xl";
export const GLASS_BLUR_PX = 24;
/** `border border-border/50` — the hairline that does the separating in dark mode. */
export const GLASS_BORDER_CLASS = "border border-border/50";
export const GLASS_BORDER_ALPHA = 50;
/** The fill opacities the glass layer permits. Opaque is intentionally absent. */
export const GLASS_FILLS = [50, 60, 70] as const;

export type Fill = (typeof GLASS_FILLS)[number];
export type Elevation = "raised" | "overlay" | "none";

/**
 * elevation → shadow token stem. The utility class `shadow-raised` and the CSS
 * custom property `--shadow-raised` share this stem, so both `surface()` (which
 * wants the class) and numeric consumers (which want `var(--shadow-raised)`)
 * derive from one string instead of two copies.
 */
export const ELEVATION_TOKEN: Record<Elevation, string | null> = {
  raised: "shadow-raised",
  overlay: "shadow-overlay",
  none: null,
};

const FILL_CLASS: Record<Fill, string> = {
  50: "bg-card/50",
  60: "bg-card/60",
  70: "bg-card/70",
};

export interface SurfaceOptions {
  /** Elevation tier → shadow token. Defaults to "overlay". */
  elevation?: Elevation;
  /** Glass fill opacity. The design language clamps this to 50–70. Defaults to 70. */
  fill?: Fill;
}

export function surface({ elevation = "overlay", fill = 70 }: SurfaceOptions = {}) {
  return cn(
    FILL_CLASS[fill],
    GLASS_BLUR_CLASS,
    GLASS_BORDER_CLASS,
    ELEVATION_TOKEN[elevation] ?? ""
  );
}

/** The numeric spec behind a surface — plane/α/blur/border/shadow as data. */
export interface GlassSpec {
  plane: typeof GLASS_PLANE;
  /** Fill opacity α, 0–100. */
  alpha: Fill;
  /** Frost radius in px. */
  blurPx: number;
  /** Border opacity 0–100. */
  borderAlpha: number;
  /** Shadow token stem (e.g. "shadow-overlay") or null for the delegated tier. */
  shadowToken: string | null;
}

/**
 * The machine-readable twin of `surface()`: same inputs, but the numbers rather
 * than the class string. Consumed by the design lab so its plot can never fall
 * out of sync with what `surface()` actually renders.
 */
export function glassSpec({
  elevation = "overlay",
  fill = 70,
}: SurfaceOptions = {}): GlassSpec {
  return {
    plane: GLASS_PLANE,
    alpha: fill,
    blurPx: GLASS_BLUR_PX,
    borderAlpha: GLASS_BORDER_ALPHA,
    shadowToken: ELEVATION_TOKEN[elevation],
  };
}
