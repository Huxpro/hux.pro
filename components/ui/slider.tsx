"use client";

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

// =============================================================================
// Slider — the iOS UISlider, as one range input.
//
// A thin track, the travelled part in ink, a white round thumb with a soft
// shadow that grows a touch under the pointer. One component for every slider
// on the site — the icon studio, the Legibility Lab, the devtool — so a
// slider reads the same wherever a number is settled by dragging.
//
// The fill is painted as a background gradient stopped at the value, so the
// track needs no second element and the input stays a plain, accessible
// range control. `--slider-fill` is the stop, set inline from the value.
// =============================================================================

export const SLIDER_CLASS = cn(
  "h-1 w-full cursor-pointer appearance-none rounded-full bg-muted",
  "[background-image:linear-gradient(var(--foreground),var(--foreground))]",
  "[background-size:var(--slider-fill)_100%] bg-no-repeat",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  // Thumb — WebKit / Blink
  "[&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:w-[22px] [&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
  "[&::-webkit-slider-thumb]:shadow-[0_0.5px_4px_rgba(0,0,0,0.12),0_6px_13px_rgba(0,0,0,0.12)]",
  "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150",
  "[&:active::-webkit-slider-thumb]:scale-110",
  // Thumb — Gecko
  "[&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white",
  "[&::-moz-range-thumb]:shadow-[0_0.5px_4px_rgba(0,0,0,0.12),0_6px_13px_rgba(0,0,0,0.12)]",
  "[&::-moz-range-track]:bg-transparent",
);

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  className,
  "aria-label": ariaLabel,
  "aria-valuetext": ariaValueText,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
  "aria-valuetext"?: string;
}) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={ariaLabel}
      aria-valuetext={ariaValueText}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(SLIDER_CLASS, className)}
      style={{ "--slider-fill": `${Math.min(100, Math.max(0, fill))}%` } as CSSProperties}
    />
  );
}
