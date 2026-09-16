"use client";

/**
 * The long sweeps: a year of suns and a month of moons.
 *
 * Both are small multiples of the same ephemeris the day plots use, sampled
 * once per day at a fixed clock time — which is exactly what the month and year
 * play scales sweep, so the plot and the playhead are the same picture.
 */

import { MoonPhaseIcon } from "@/systems/ambient";
import { cn } from "@/lib/utils";
import { date, type MoonDay, type TrackPoint } from "../model";
import {
  Marker,
  MOON_COLOR,
  nearestAngle,
  Plot,
  SUN_COLOR,
  path,
  unwrapDegrees,
} from "./primitives";

// --- Analemma ---------------------------------------------------------------

const A_W = 200;
const A_H = 150;

/**
 * The sun at one clock time on every day of a year.
 *
 * The figure-eight is the equation of time (the earth's elliptical orbit and
 * its tilt) drawn out — the thing a "15° per hour" sun does not have and the
 * reason this repo runs a real ephemeris instead.
 */
export function AnalemmaPlot({
  points,
  now,
  title = "Analemma",
  hint,
  footer,
}: {
  points: TrackPoint[];
  now: TrackPoint;
  title?: string;
  hint?: string;
  /** The extent line under the plot, given the fitted ranges. */
  footer?: (minEl: string, maxEl: string, minAz: string, maxAz: string) => string;
}) {
  if (points.length === 0) return null;
  // At a clock time when the sun is down, a year of azimuths crosses north and
  // the raw values jump 359° → 1°. Unwrap before fitting the axis.
  const azs = unwrapDegrees(points.map((p) => p.azimuth));
  const els = points.map((p) => p.elevation);
  // The figure is small; fit the plot to it rather than to the whole dome.
  const minAz = Math.min(...azs);
  const maxAz = Math.max(...azs);
  const minEl = Math.min(...els);
  const maxEl = Math.max(...els);
  const spanAz = Math.max(4, maxAz - minAz);
  const spanEl = Math.max(4, maxEl - minEl);
  const px = (az: number) => ((az - minAz) / spanAz) * (A_W - 20) + 10;
  const py = (el: number) => A_H - 12 - ((el - minEl) / spanEl) * (A_H - 24);

  // One marker a month, so the loop has a direction.
  const monthly = points
    .map((p, i) => ({ ...p, az: azs[i], i }))
    .filter((p) => p.i % 30 === 0);
  const nowAz = nearestAngle(now.azimuth, (minAz + maxAz) / 2);

  return (
    <Plot
      title={title}
      hint={hint}
      viewBox={`0 0 ${A_W} ${A_H}`}
      svgClassName="h-48"
      footer={
        <p className="font-mono text-[10px] leading-relaxed text-tertiary-foreground">
          {(footer ?? ((a, b, c, d) => `Elevation ${a} → ${b}, azimuth ${c} → ${d} at the same clock time.`))(
            `${minEl.toFixed(1)}°`,
            `${maxEl.toFixed(1)}°`,
            `${minAz.toFixed(1)}°`,
            `${maxAz.toFixed(1)}°`
          )}
        </p>
      }
    >
      <path
        d={path(points.map((p, i) => [px(azs[i]), py(p.elevation)]))}
        fill="none"
        stroke={SUN_COLOR}
        strokeWidth={1.2}
        opacity={0.85}
      />
      {monthly.map((p) => (
        <circle key={p.ms} cx={px(p.az)} cy={py(p.elevation)} r={1.4} fill={SUN_COLOR} opacity={0.6} />
      ))}
      <Marker x={px(nowAz)} y={py(now.elevation)} color={SUN_COLOR} r={3} />
    </Plot>
  );
}

// --- A month of moons -------------------------------------------------------

/**
 * Thirty days as thirty tiles: the phase glyph, and how high the moon gets.
 *
 * The bar is the transit elevation, which is what "how high does it get"
 * means; the tint behind it is the illuminated fraction. Together they are the
 * month-long beat the wallpaper is quietly keeping.
 */
export function MoonMonthPlot({
  days,
  nowMs,
  mirror,
  onPick,
  title = "Month · phase and transit height",
  peak = (deg) => `peak ${deg}`,
  tileTitle = (d, lit, transit) => `${d} · ${lit}% lit · transit ${transit}`,
}: {
  days: MoonDay[];
  nowMs: number;
  mirror: boolean;
  onPick: (ms: number) => void;
  title?: string;
  peak?: (deg: string) => string;
  tileTitle?: (date: string, lit: number, transit: string) => string;
}) {
  const maxTransit = Math.max(10, ...days.map((d) => d.transitElevation));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-tertiary-foreground">
          {peak(`${maxTransit.toFixed(0)}°`)}
        </span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {days.map((d) => {
          const current = Math.abs(d.ms - nowMs) < 12 * 3_600_000;
          return (
            <button
              key={d.ms}
              type="button"
              onClick={() => onPick(d.ms)}
              title={tileTitle(date(d.ms), Math.round(d.illumination * 100), `${d.transitElevation.toFixed(0)}°`)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded px-0.5 py-1 transition-colors",
                current ? "bg-accent/70" : "hover:bg-muted/40"
              )}
            >
              <MoonPhaseIcon phase={d.phase} mirror={mirror} className="h-3.5 w-3.5" />
              <span
                aria-hidden
                style={{
                  height: `${Math.max(2, (Math.max(0, d.transitElevation) / maxTransit) * 18)}px`,
                  backgroundColor: MOON_COLOR,
                  opacity: 0.35 + 0.65 * d.illumination,
                }}
                className="w-1 rounded-sm"
              />
              <span className="font-mono text-[8px] tabular-nums text-tertiary-foreground">
                {new Date(d.ms).getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- The phase dial ---------------------------------------------------------

/**
 * Phase as an angle: the moon's position around the sun–earth line.
 *
 * It is the same number as the glyph, drawn the way the derivation uses it —
 * elongation, 0° at new and 180° at full, which is what gates the daytime moon.
 */
export function PhaseDial({
  phase,
  illumination,
  elongation,
  name,
  mirror,
  line = (p, lit, e) => `phase ${p} · ${lit}% lit · elongation ${e}`,
  newLabel = "new",
  fullLabel = "full",
}: {
  phase: number;
  illumination: number;
  elongation: number;
  name: string;
  mirror: boolean;
  line?: (phase: string, lit: number, elongation: string) => string;
  newLabel?: string;
  fullLabel?: string;
}) {
  const angle = phase * 2 * Math.PI;
  const r = 26;
  const cx = 34;
  const cy = 34;
  const x = cx + Math.sin(angle) * r;
  const y = cy - Math.cos(angle) * r;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 68 68" className="h-16 w-16 shrink-0" role="img" aria-label="Moon phase dial">
        <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-foreground/15" strokeWidth={1} />
        <circle cx={cx} cy={cy - r} r={2} className="fill-foreground/30" />
        <text x={cx} y={cy - r - 4} textAnchor="middle" className="fill-tertiary-foreground font-mono" style={{ fontSize: 6 }}>
          {newLabel}
        </text>
        <text x={cx} y={cy + r + 9} textAnchor="middle" className="fill-tertiary-foreground font-mono" style={{ fontSize: 6 }}>
          {fullLabel}
        </text>
        <line x1={cx} y1={cy} x2={x} y2={y} className="stroke-foreground/35" strokeWidth={1} />
        <Marker x={x} y={y} color={MOON_COLOR} r={3.5} />
      </svg>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs text-foreground">
          <MoonPhaseIcon phase={phase} mirror={mirror} className="h-3.5 w-3.5" />
          {name}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {line(phase.toFixed(4), Math.round(illumination * 100), `${elongation.toFixed(1)}°`)}
        </span>
      </div>
    </div>
  );
}
