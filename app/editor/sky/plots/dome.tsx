"use client";

/**
 * Where the bodies are, and where they are drawn — the lab's two core plots.
 *
 * The dome is the world: real azimuth and elevation, the horizon as a line.
 * The screen plot is the picture: the same two paths after `sunToScreen` and
 * `stageMoon`. Side by side they are the argument for the stage — the moon's
 * real arc spends the night in the top half of the dome, and the staged one
 * spends it in the band above the page content.
 */

import type { ScreenPoint } from "@/systems/ambient/lib/scene";
import type { RiseSetTimes } from "@/systems/ambient/lib/solar";
import { clock, type TrackPoint } from "../model";
import {
  breakOnWrap,
  GridLine,
  Marker,
  MOON_COLOR,
  path,
  Plot,
  STAGE_COLOR,
  SUN_COLOR,
  Tick,
} from "./primitives";

// --- Sky dome ---------------------------------------------------------------

/** Elevation floor of the dome plot. Below this the sky is long since black. */
const EL_MIN = -60;
const EL_MAX = 90;
const DOME_W = 360;
const DOME_H = EL_MAX - EL_MIN;

const domeY = (el: number) => EL_MAX - Math.max(EL_MIN, Math.min(EL_MAX, el));
const HORIZON_Y = domeY(0);

const COMPASS = [
  { az: 0, label: "N" },
  { az: 90, label: "E" },
  { az: 180, label: "S" },
  { az: 270, label: "W" },
  { az: 360, label: "N" },
];

export interface PlotText {
  title: string;
  legend: string[];
}

export function SkyDomePlot({
  sunTrack,
  moonTrack,
  sun,
  moon,
  events,
  hint,
  text,
  horizonLabel = "horizon",
  nightLabel = "−18° astronomical night",
}: {
  sunTrack: TrackPoint[];
  moonTrack: TrackPoint[];
  sun: { azimuth: number; elevation: number };
  moon: { azimuth: number; elevation: number };
  events: { sun: RiseSetTimes; moon: RiseSetTimes };
  hint?: string;
  text?: PlotText;
  horizonLabel?: string;
  nightLabel?: string;
}) {
  const toXY = (p: TrackPoint): [number, number] => [p.azimuth, domeY(p.elevation)];
  const sunPath = path(breakOnWrap(sunTrack.map(toXY), 180));
  const moonPath = path(breakOnWrap(moonTrack.map(toXY), 180));

  /** The azimuth a body had at a rise/set instant, for a tick on the horizon. */
  const azAt = (track: TrackPoint[], ms: number | null): number | null => {
    if (ms === null || track.length === 0) return null;
    let best = track[0];
    for (const p of track) {
      if (Math.abs(p.ms - ms) < Math.abs(best.ms - ms)) best = p;
    }
    return best.azimuth;
  };

  const horizonEvents = [
    { az: azAt(sunTrack, events.sun.rise), color: SUN_COLOR, label: clock(events.sun.rise) },
    { az: azAt(sunTrack, events.sun.set), color: SUN_COLOR, label: clock(events.sun.set) },
    { az: azAt(moonTrack, events.moon.rise), color: MOON_COLOR, label: clock(events.moon.rise) },
    { az: azAt(moonTrack, events.moon.set), color: MOON_COLOR, label: clock(events.moon.set) },
  ].filter((e): e is { az: number; color: string; label: string } => e.az !== null);

  return (
    <Plot
      title={text?.title ?? "Sky dome · azimuth × elevation"}
      hint={hint}
      viewBox={`0 0 ${DOME_W} ${DOME_H}`}
      svgClassName="h-44"
      legend={[
        { label: text?.legend[0] ?? "sun", color: SUN_COLOR },
        { label: text?.legend[1] ?? "moon", color: MOON_COLOR },
      ]}
    >
      {/* Below the horizon, and the deeper band where twilight is over. */}
      <rect x={0} y={HORIZON_Y} width={DOME_W} height={DOME_H - HORIZON_Y} className="fill-foreground/[0.06]" />
      <rect x={0} y={domeY(-18)} width={DOME_W} height={DOME_H - domeY(-18)} className="fill-foreground/[0.06]" />

      <GridLine y={domeY(60)} x2={DOME_W} label="60°" />
      <GridLine y={domeY(30)} x2={DOME_W} label="30°" />
      <GridLine y={HORIZON_Y} x2={DOME_W} label={horizonLabel} strong />
      <GridLine y={domeY(-18)} x2={DOME_W} label={nightLabel} />

      {COMPASS.map((c) => (
        <g key={`${c.az}-${c.label}`}>
          <line
            x1={c.az}
            x2={c.az}
            y1={0}
            y2={DOME_H}
            className="stroke-foreground/10"
            strokeWidth={0.5}
          />
          <text
            x={c.az === 0 ? 3 : c.az === 360 ? 357 : c.az}
            y={DOME_H - 3}
            textAnchor={c.az === 0 ? "start" : c.az === 360 ? "end" : "middle"}
            className="fill-tertiary-foreground font-mono"
            style={{ fontSize: 8 }}
          >
            {c.label}
          </text>
        </g>
      ))}

      <path d={sunPath} fill="none" stroke={SUN_COLOR} strokeWidth={1.5} opacity={0.85} />
      <path d={moonPath} fill="none" stroke={MOON_COLOR} strokeWidth={1.5} opacity={0.85} />

      {horizonEvents.map((e, i) => (
        <Tick key={i} x={e.az} y={HORIZON_Y} length={8} color={e.color} label={e.label} labelDy={10} />
      ))}

      <Marker
        x={sun.azimuth}
        y={domeY(sun.elevation)}
        color={SUN_COLOR}
        r={4}
        title={`Sun ${sun.elevation.toFixed(1)}° / ${Math.round(sun.azimuth)}°`}
      />
      <Marker
        x={moon.azimuth}
        y={domeY(moon.elevation)}
        color={MOON_COLOR}
        r={4}
        title={`Moon ${moon.elevation.toFixed(1)}° / ${Math.round(moon.azimuth)}°`}
      />
    </Plot>
  );
}

// --- Screen space -----------------------------------------------------------

export interface StagedPoint {
  ms: number;
  sun: ScreenPoint;
  moon: ScreenPoint;
  /** How strongly the moon is drawn at this instant, 0..1. */
  moonVisible: number;
}

/**
 * The same day, after composition.
 *
 * The shaded band is everything below the moon stage's floor — the strip the
 * hero, the greeting and the widget grid occupy. Mapping the moon's elevation
 * linearly puts most of a night's moon in there, behind the page; the stage is
 * what lifts it out, and moving `staging.moon.rise` moves this band with it.
 */
export function ScreenPlot({
  track,
  sun,
  moon,
  moonVisible,
  moonSize,
  contentTop,
  portrait,
  hint,
  text,
  bandLabel = "page content · widget grid",
}: {
  track: StagedPoint[];
  sun: ScreenPoint;
  moon: ScreenPoint;
  moonVisible: number;
  moonSize: number;
  contentTop: number;
  portrait: boolean;
  hint?: string;
  text?: PlotText;
  bandLabel?: string;
}) {
  const W = portrait ? 100 : 178;
  const H = portrait ? 178 : 100;
  const sx = (x: number) => x * W;
  // Scene y runs bottom → top; SVG y runs top → bottom.
  const sy = (y: number) => (1 - y) * H;

  const sunPath = path(track.map((p) => [sx(p.sun.x), sy(p.sun.y)] as [number, number]));
  // The moon's staged path is only meaningful where the moon is actually shown.
  const moonPath = path(
    track.map((p) =>
      p.moonVisible > 0.02 ? ([sx(p.moon.x), sy(p.moon.y)] as [number, number]) : null
    )
  );
  const moonGhost = path(track.map((p) => [sx(p.moon.x), sy(p.moon.y)] as [number, number]));

  return (
    <Plot
      title={text?.title ?? "Screen space · where it is drawn"}
      hint={hint}
      viewBox={`0 0 ${W} ${H}`}
      svgClassName={portrait ? "h-64" : "h-44"}
      legend={[
        { label: text?.legend[0] ?? "sun", color: SUN_COLOR },
        { label: text?.legend[1] ?? "moon (shown)", color: STAGE_COLOR },
        { label: text?.legend[2] ?? "moon (staged, hidden)", color: MOON_COLOR, dashed: true },
      ]}
    >
      <rect x={0} y={0} width={W} height={H} className="fill-transparent" />
      {/* The band behind the page content. */}
      <rect
        x={0}
        y={sy(contentTop)}
        width={W}
        height={H - sy(contentTop)}
        className="fill-foreground/[0.07]"
      />
      <line
        x1={0}
        x2={W}
        y1={sy(contentTop)}
        y2={sy(contentTop)}
        className="stroke-foreground/25"
        strokeDasharray="3 3"
        strokeWidth={0.6}
      />
      <text
        x={3}
        y={sy(contentTop) + 8}
        className="fill-tertiary-foreground font-mono"
        style={{ fontSize: 5.5 }}
      >
        {bandLabel}
      </text>

      <path d={moonGhost} fill="none" stroke={MOON_COLOR} strokeWidth={0.8} strokeDasharray="2 2" opacity={0.6} />
      <path d={sunPath} fill="none" stroke={SUN_COLOR} strokeWidth={1.2} opacity={0.85} />
      <path d={moonPath} fill="none" stroke={STAGE_COLOR} strokeWidth={1.6} />

      <Marker x={sx(sun.x)} y={sy(sun.y)} color={SUN_COLOR} r={2.6} />
      <Marker
        x={sx(moon.x)}
        y={sy(moon.y)}
        color={STAGE_COLOR}
        r={2.2 * moonSize}
        opacity={0.25 + 0.75 * moonVisible}
      />
      <rect
        x={0.5}
        y={0.5}
        width={W - 1}
        height={H - 1}
        fill="none"
        className="stroke-foreground/25"
        strokeWidth={1}
      />
    </Plot>
  );
}
