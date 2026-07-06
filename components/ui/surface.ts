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
 */

/** Card-fill opacities allowed by the glass layer. Opaque is intentionally absent. */
const FILL = {
  50: "bg-card/50",
  60: "bg-card/60",
  70: "bg-card/70",
} as const;

const ELEVATION = {
  raised: "shadow-raised",
  overlay: "shadow-overlay",
  none: "",
} as const;

export interface SurfaceOptions {
  /** Elevation tier → shadow token. Defaults to "overlay". */
  elevation?: keyof typeof ELEVATION;
  /** Glass fill opacity. The design language clamps this to 50–70. Defaults to 70. */
  fill?: keyof typeof FILL;
}

export function surface({ elevation = "overlay", fill = 70 }: SurfaceOptions = {}) {
  return cn(FILL[fill], "backdrop-blur-xl border border-border/50", ELEVATION[elevation]);
}
