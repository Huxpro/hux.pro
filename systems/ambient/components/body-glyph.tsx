import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// The sun and the moon as solid glyphs — one family, drawn the same way: the
// whole disc faint, and the lit part solid. The moon's lit part is its real
// phase; the sun is all lit. Used wherever the sky's two bodies are named
// rather than drawn: the devtool's readouts, the sky window's edge hints, the
// pull cue.
// ---------------------------------------------------------------------------

/**
 * The moon, lit for a phase in [0, 1). The terminator is an ellipse of
 * half-width |cos(2πp)|; waxing lights the right limb (northern hemisphere),
 * and `mirror` flips it for the south.
 */
export function MoonGlyph({
  phase,
  mirror = false,
  light = false,
  className,
}: {
  phase: number;
  mirror?: boolean;
  /**
   * Drawn as light rather than ink — the lit part white, the rest a breath of
   * it — for where the glyph stands for the body itself in the sky (the pull
   * cue), rather than names it in a readout.
   */
  light?: boolean;
  className?: string;
}) {
  const r = 6;
  const p = ((phase % 1) + 1) % 1;
  const k = Math.cos(p * 2 * Math.PI);
  const rx = Math.max(0.01, Math.abs(k) * r);
  const waxing = p < 0.5;
  // Outer limb: right semicircle when waxing, left when waning (top → bottom).
  const limb = waxing ? `A ${r} ${r} 0 0 1 0 ${r}` : `A ${r} ${r} 0 0 0 0 ${r}`;
  // Return along the terminator ellipse (bottom → top). Crescent (k > 0)
  // curves back on the same side as the limb; gibbous (k < 0) bulges across.
  const sweep = waxing ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0;
  const terminator = `A ${rx} ${r} 0 0 ${sweep} 0 ${-r}`;
  return (
    <svg
      viewBox="-7 -7 14 14"
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      aria-hidden
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      <circle r={r} className={light ? "fill-white/20" : "fill-muted-foreground/25"} />
      <path
        d={`M 0 ${-r} ${limb} ${terminator} Z`}
        className={light ? "fill-white" : "fill-foreground/85"}
      />
    </svg>
  );
}

/** The sun: the moon's family, all lit — a solid disc in a faint one. */
export function SunGlyph({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="-7 -7 14 14" className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden>
      <circle r={6.5} className={light ? "fill-white/25" : "fill-muted-foreground/25"} />
      <circle r={4.5} className={light ? "fill-white" : "fill-foreground/85"} />
    </svg>
  );
}
