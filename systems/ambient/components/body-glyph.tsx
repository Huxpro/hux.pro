import { cn } from "@/lib/utils";
import type { SunEvent } from "../lib/sun";

// ---------------------------------------------------------------------------
// The sun and the moon as solid glyphs. One family, drawn the same way: the
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
   * Drawn as light rather than ink (the lit part white, the rest a faint
   * white), for where the glyph stands for the body itself in the sky (the
   * pull cue), rather than names it in a readout.
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

/** Eight short rays round the sun's disc, as solid as the disc. */
const RAYS = Array.from({ length: 8 }, (_, i) => (i * 360) / 8);

/** One rounded ray, `deg` round from straight up, from `r` to `r - length` out. */
function Ray({ deg, r, length, fill }: { deg: number; r: number; length: number; fill: string }) {
  return (
    <rect
      x={-0.65}
      y={-r}
      width={1.3}
      height={length}
      rx={0.65}
      transform={`rotate(${deg})`}
      className={fill}
    />
  );
}

/**
 * The sun: the moon's family (solid, the same size), but with rays. A plain
 * lit disc is what a FULL moon looks like, and the two must never be taken for
 * each other: a full moon read as the sun is a phase nobody can see.
 */
export function SunGlyph({ className, light = false }: { className?: string; light?: boolean }) {
  const fill = light ? "fill-white" : "fill-foreground/85";
  return (
    <svg viewBox="-7 -7 14 14" className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden>
      <circle r={3.4} className={fill} />
      {RAYS.map((deg) => (
        <Ray key={deg} deg={deg} r={6.6} length={1.9} fill={fill} />
      ))}
    </svg>
  );
}

/** The sun's four rays that clear the horizon: left, the two diagonals, right. */
const EVENT_RAYS = [-90, -45, 45, 90];

/**
 * A sunrise or a sunset: the sun's family again. Half its disc on a horizon,
 * the rays that clear it, and an arrow for which way it is going. Stands for
 * the sun through the sun-event phases, when the disc is mostly not there.
 */
export function SunEventGlyph({
  event,
  className,
  light = false,
}: {
  event: SunEvent;
  className?: string;
  light?: boolean;
}) {
  const fill = light ? "fill-white" : "fill-foreground/85";
  const rising = event === "sunrise";
  return (
    <svg viewBox="-7 -7 14 14" className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden>
      {/* The horizon, and the half of the sun above it. */}
      <rect x={-6.6} y={4} width={13.2} height={1.3} rx={0.65} className={fill} />
      <path d="M -3.2 3.1 A 3.2 3.2 0 0 1 3.2 3.1 Z" className={fill} />
      <g transform="translate(0 3.1)">
        {EVENT_RAYS.map((deg) => (
          <Ray key={deg} deg={deg} r={6.2} length={1.8} fill={fill} />
        ))}
      </g>
      {/* Which way it is going: up out of the horizon, or down into it. */}
      <rect x={-0.6} y={rising ? -4.8 : -6.8} width={1.2} height={3.2} rx={0.6} className={fill} />
      <path
        d={rising ? "M 0 -6.9 L 2.3 -4.3 L -2.3 -4.3 Z" : "M 0 -1.1 L 2.3 -3.7 L -2.3 -3.7 Z"}
        className={fill}
      />
    </svg>
  );
}
