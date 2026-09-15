"use client";

/**
 * The plot kit: plain SVG, no chart library.
 *
 * None of the lab's plots exceeds a few hundred points, and the repo already
 * draws its moon phase as eleven lines of SVG — so a path string and a `<g>`
 * of ticks is the whole apparatus. It also means the plots inherit the page's
 * theme tokens and stay legible in both.
 */

import { cn } from "@/lib/utils";

/** The two bodies, in one colour each, everywhere in the lab. */
export const SUN_COLOR = "#f0a63c";
export const MOON_COLOR = "#8fa6c4";
/** The staged (drawn) path, as opposed to the real one. */
export const STAGE_COLOR = "#7cc4a4";

export function Plot({
  title,
  hint,
  viewBox,
  children,
  legend,
  footer,
  className,
  svgClassName,
}: {
  title: string;
  hint?: string;
  viewBox: string;
  children: React.ReactNode;
  legend?: { label: string; color: string; dashed?: boolean }[];
  footer?: React.ReactNode;
  className?: string;
  svgClassName?: string;
}) {
  return (
    <figure className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {hint && (
          <span className="truncate font-mono text-[10px] tabular-nums text-tertiary-foreground">
            {hint}
          </span>
        )}
      </figcaption>
      <svg
        viewBox={viewBox}
        preserveAspectRatio="none"
        className={cn(
          "w-full rounded-lg bg-muted/15 ring-1 ring-border/50",
          svgClassName,
        )}
        role="img"
        aria-label={title}
      >
        {children}
      </svg>
      {legend && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {legend.map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground"
            >
              <span
                aria-hidden
                style={{
                  backgroundColor: item.dashed ? "transparent" : item.color,
                  borderTop: item.dashed ? `1.5px dashed ${item.color}` : undefined,
                }}
                className="inline-block h-[2px] w-3.5"
              />
              {item.label}
            </span>
          ))}
        </div>
      )}
      {footer}
    </figure>
  );
}

/** An SVG path through points, skipping the gaps a `null` marks. */
export function path(points: ([number, number] | null)[]): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)} `;
    pen = true;
  }
  return d.trim();
}

/**
 * Break a path wherever x jumps more than `maxJump`.
 *
 * Azimuth is cyclic: a body crossing due north steps 359° → 1°, which drawn
 * literally is a line straight back across the plot. This inserts the gap.
 */
export function breakOnWrap(
  points: [number, number][],
  maxJump: number
): ([number, number] | null)[] {
  const out: ([number, number] | null)[] = [];
  for (let i = 0; i < points.length; i++) {
    if (i > 0 && Math.abs(points[i][0] - points[i - 1][0]) > maxJump) out.push(null);
    out.push(points[i]);
  }
  return out;
}

/**
 * Make a run of azimuths continuous.
 *
 * A body that crosses due north steps 359° → 1°. `breakOnWrap` is right when
 * the x axis really is the compass; when the axis is fitted to the data (the
 * analemma), the jump has to be undone instead, or one crossing stretches the
 * plot across the whole circle.
 */
export function unwrapDegrees(values: number[]): number[] {
  const out: number[] = [];
  let offset = 0;
  for (let i = 0; i < values.length; i++) {
    if (i > 0) {
      const delta = values[i] + offset - out[i - 1];
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
    }
    out.push(values[i] + offset);
  }
  return out;
}

/** The representative of `value` (mod 360) nearest to `near`. */
export function nearestAngle(value: number, near: number): number {
  return value + Math.round((near - value) / 360) * 360;
}

/** A dot with a halo, for "here is the body right now". */
export function Marker({
  x,
  y,
  color,
  r = 3,
  opacity = 1,
  title,
}: {
  x: number;
  y: number;
  color: string;
  r?: number;
  opacity?: number;
  title?: string;
}) {
  return (
    <g opacity={opacity}>
      {title && <title>{title}</title>}
      <circle cx={x} cy={y} r={r * 2.2} fill={color} opacity={0.18} />
      <circle cx={x} cy={y} r={r} fill={color} />
    </g>
  );
}

/** A tick on an axis, with an optional label under it. */
export function Tick({
  x,
  y,
  length = 4,
  label,
  color,
  labelDy = 9,
}: {
  x: number;
  y: number;
  length?: number;
  label?: string;
  color?: string;
  labelDy?: number;
}) {
  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={y - length / 2}
        y2={y + length / 2}
        stroke={color ?? "currentColor"}
        strokeWidth={1}
        className={color ? undefined : "text-tertiary-foreground"}
      />
      {label && (
        <text
          x={x}
          y={y + labelDy}
          textAnchor="middle"
          fill={color ?? "currentColor"}
          className={cn("font-mono", color ? undefined : "fill-tertiary-foreground")}
          style={{ fontSize: 7 }}
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** A horizontal rule with a right-aligned label — the plots' y gridline. */
export function GridLine({
  y,
  x2,
  label,
  strong = false,
}: {
  y: number;
  x2: number;
  label?: string;
  strong?: boolean;
}) {
  return (
    <g>
      <line
        x1={0}
        x2={x2}
        y1={y}
        y2={y}
        strokeWidth={strong ? 1 : 0.5}
        strokeDasharray={strong ? undefined : "2 3"}
        className={strong ? "stroke-foreground/35" : "stroke-foreground/15"}
      />
      {label && (
        <text
          x={2}
          y={y - 2}
          className="fill-tertiary-foreground font-mono"
          style={{ fontSize: 7 }}
        >
          {label}
        </text>
      )}
    </g>
  );
}
