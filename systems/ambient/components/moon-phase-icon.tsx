"use client";

import { cn } from "@/lib/utils";

/**
 * The lit part of the lunar disc for a phase in [0, 1).
 *
 * The terminator is an ellipse of half-width |cos(2πp)|; waxing lights the
 * right limb (northern hemisphere), and `mirror` flips it for the south —
 * the same geometry the wallpaper shader draws, in eleven lines of SVG. Shared
 * so the devtool's status line, the Sky Engine Lab's phase dial and anything
 * else that needs a moon show the same moon.
 */
export function MoonPhaseIcon({
  phase,
  mirror = false,
  className,
}: {
  phase: number;
  mirror?: boolean;
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
      <circle r={r} className="fill-muted-foreground/25" />
      <path d={`M 0 ${-r} ${limb} ${terminator} Z`} className="fill-foreground/85" />
    </svg>
  );
}
