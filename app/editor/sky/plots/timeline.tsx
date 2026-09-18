"use client";

/**
 * The day, twice over: painted, and measured.
 *
 * The strip is the devtool's day-sky gradient — 72 scenes reduced to one colour
 * each — with a moon-visibility track under it, so "the moon is up but the sky
 * is not dark enough yet" is a thing you can see rather than infer. The
 * sparklines below take the same 72 scenes and plot the scalars the derivation
 * actually multiplies together.
 */

import { rgbToCss, type RGB, type WeatherScene } from "@/systems/ambient/lib/scene";
import type { RiseSetTimes } from "@/systems/ambient/lib/solar";
import { cn } from "@/lib/utils";
import { clock } from "../model";
import { useSkyText } from "../i18n";
import { MOON_COLOR, SUN_COLOR, path } from "./primitives";

const W = 1440; // one x unit per minute of the day
const TRACK_H = 26;

/** Minutes past local midnight, for a timestamp on the day in view. */
function minutesInto(ms: number | null, dayStartMs: number): number | null {
  if (ms === null) return null;
  const m = (ms - dayStartMs) / 60_000;
  return m >= 0 && m <= 1440 ? m : null;
}

export function DayTimeline({
  colors,
  scenes,
  dayStartMs,
  events,
  nowMinutes,
  realNowMinutes,
  onScrub,
}: {
  colors: RGB[];
  scenes: WeatherScene[];
  dayStartMs: number;
  events: { sun: RiseSetTimes; moon: RiseSetTimes };
  nowMinutes: number;
  realNowMinutes: number | null;
  onScrub: (minutes: number) => void;
}) {
  const { L, locale } = useSkyText();
  const at = (ms: number | null) => clock(ms, locale);
  const gradient = `linear-gradient(90deg, ${colors
    .map((c, i) => `${rgbToCss(c)} ${((i / (colors.length - 1)) * 100).toFixed(1)}%`)
    .join(", ")})`;

  const ticks = [
    { m: minutesInto(events.sun.rise, dayStartMs), label: `↑ ${at(events.sun.rise)}`, color: SUN_COLOR },
    { m: minutesInto(events.sun.set, dayStartMs), label: `↓ ${at(events.sun.set)}`, color: SUN_COLOR },
    { m: minutesInto(events.moon.rise, dayStartMs), label: `↑ ${at(events.moon.rise)}`, color: MOON_COLOR },
    { m: minutesInto(events.moon.set, dayStartMs), label: `↓ ${at(events.moon.set)}`, color: MOON_COLOR },
  ].filter((t): t is { m: number; label: string; color: string } => t.m !== null);

  const pct = (m: number) => `${((m / 1440) * 100).toFixed(3)}%`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {L.dayTimeline}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-tertiary-foreground">
          {at(dayStartMs + nowMinutes * 60_000)}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-lg ring-1 ring-border/50">
        <div className="h-16" style={{ backgroundImage: gradient }} />

        {/* Moon visibility: opacity is `scene.moon.visible`, so a moon that is
            up in a bright sky reads as the faint band it is on screen. */}
        <svg
          viewBox={`0 0 ${W} ${TRACK_H}`}
          preserveAspectRatio="none"
          className="block h-6 w-full bg-foreground/15"
          role="img"
          aria-label={L.moonTrack}
        >
          {scenes.map((scene, i) => {
            const x = (i / scenes.length) * W;
            const w = W / scenes.length + 0.5;
            if (scene.moon.visible < 0.004) return null;
            return (
              <rect
                key={i}
                x={x}
                y={0}
                width={w}
                height={TRACK_H}
                fill={MOON_COLOR}
                opacity={0.12 + 0.88 * scene.moon.visible}
              />
            );
          })}
          <path
            d={path(
              scenes.map((s, i) => [
                (i / (scenes.length - 1)) * W,
                TRACK_H - Math.max(0, Math.min(1, (s.moon.elevation + 20) / 110)) * TRACK_H,
              ])
            )}
            fill="none"
            stroke={MOON_COLOR}
            strokeWidth={1.5}
            opacity={0.8}
          />
        </svg>

        {ticks.map((t, i) => (
          <span
            key={i}
            aria-hidden
            title={t.label}
            style={{ left: pct(t.m), backgroundColor: t.color }}
            className="pointer-events-none absolute top-0 h-16 w-px opacity-80"
          />
        ))}
        {realNowMinutes !== null && (
          <span
            aria-hidden
            title={L.realTimeOfDay}
            style={{ left: pct(realNowMinutes) }}
            className="pointer-events-none absolute inset-y-0 border-l border-dashed border-white/70 mix-blend-difference"
          />
        )}
        <input
          type="range"
          min={0}
          max={1439}
          step={1}
          value={Math.round(nowMinutes)}
          onChange={(e) => onScrub(Number(e.target.value))}
          aria-label={L.scrubDay}
          aria-valuetext={at(dayStartMs + nowMinutes * 60_000)}
          className={cn(
            "absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent",
            "[&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent",
            "[&::-webkit-slider-thumb]:h-[88px] [&::-webkit-slider-thumb]:w-[3px] [&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.55)]",
            "[&::-moz-range-track]:bg-transparent",
            "[&::-moz-range-thumb]:h-[88px] [&::-moz-range-thumb]:w-[3px] [&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
          )}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
        {ticks.map((t, i) => (
          <span key={i} className="flex items-center gap-1">
            <span aria-hidden style={{ backgroundColor: t.color }} className="h-2 w-[2px]" />
            {t.label}
          </span>
        ))}
        {events.sun.alwaysUp && <span>{L.sunNeverSets}</span>}
        {events.sun.alwaysDown && <span>{L.sunNeverRises}</span>}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Derived scalars
// -----------------------------------------------------------------------------

export interface Series {
  label: string;
  color: string;
  /** 0..1 across the day. */
  values: number[];
  /** What the number is at the instant in view. */
  now: number;
  title: string;
}

/**
 * Every multiplicand of the derivation, across the day.
 *
 * `moon.visible` is a product of three gates; `stars` of four. Plotted next to
 * each other you can see which one is doing the work — and which one is the
 * reason the moon went out at 21:40.
 */
export function Sparklines({ series, nowFraction }: { series: Series[]; nowFraction: number }) {
  const w = 120;
  const h = 26;
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
      {series.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-col gap-0.5" title={s.title}>
          <div className="flex items-baseline justify-between gap-2 font-mono text-[10px]">
            <span className="truncate text-muted-foreground">{s.label}</span>
            <span className="tabular-nums text-foreground/85">{s.now.toFixed(2)}</span>
          </div>
          <svg
            viewBox={`0 0 ${w} ${h}`}
            preserveAspectRatio="none"
            className="h-6 w-full rounded bg-muted/20"
            role="img"
            aria-label={`${s.label} across the day`}
          >
            <path
              d={
                path(s.values.map((v, i) => [(i / (s.values.length - 1)) * w, h - v * (h - 2) - 1])) +
                ` L ${w} ${h} L 0 ${h} Z`
              }
              fill={s.color}
              opacity={0.16}
            />
            <path
              d={path(s.values.map((v, i) => [(i / (s.values.length - 1)) * w, h - v * (h - 2) - 1]))}
              fill="none"
              stroke={s.color}
              strokeWidth={1.2}
            />
            <line
              x1={nowFraction * w}
              x2={nowFraction * w}
              y1={0}
              y2={h}
              className="stroke-foreground/45"
              strokeWidth={0.8}
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
