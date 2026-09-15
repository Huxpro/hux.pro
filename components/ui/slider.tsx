"use client";

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

// =============================================================================
// Slider — one range input for the icon studio, the Legibility Lab and the
// devtool, styled the way the site's sliders always read on a phone.
//
// Only the track is ours: a thin bar in the theme's ink at a few percent, the
// travelled part in ink, painted as a background gradient stopped at the value
// so the input stays one plain, accessible range control. The thumb is the
// platform's — `appearance-none` on the input alone leaves the native knob in
// place (iOS Safari's flat white pill, Chrome's round one), tinted white by
// `accent-color` where the platform tints it. On a hover-capable pointer the
// native knob is small and grey-ish on some engines, so desktop gets a white
// 16px disc with a soft shadow; touch keeps native, which is what looked right
// on iOS all along.
// =============================================================================

const SLIDER_CLASS = cn(
  "h-1 w-full cursor-pointer appearance-none rounded-full",
  "bg-foreground/15 [background-image:linear-gradient(var(--foreground),var(--foreground))]",
  "[background-size:var(--slider-fill)_100%] bg-no-repeat accent-white",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  // Desktop thumb only — touch keeps the platform's knob.
  "[@media(hover:hover)]:[&::-webkit-slider-thumb]:h-4 [@media(hover:hover)]:[&::-webkit-slider-thumb]:w-4",
  "[@media(hover:hover)]:[&::-webkit-slider-thumb]:appearance-none [@media(hover:hover)]:[&::-webkit-slider-thumb]:rounded-full",
  "[@media(hover:hover)]:[&::-webkit-slider-thumb]:bg-white",
  "[@media(hover:hover)]:[&::-webkit-slider-thumb]:shadow-[0_0_0_0.5px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.25)]",
  "[@media(hover:hover)]:[&::-moz-range-thumb]:h-4 [@media(hover:hover)]:[&::-moz-range-thumb]:w-4",
  "[@media(hover:hover)]:[&::-moz-range-thumb]:rounded-full [@media(hover:hover)]:[&::-moz-range-thumb]:border-0",
  "[@media(hover:hover)]:[&::-moz-range-thumb]:bg-white",
  "[@media(hover:hover)]:[&::-moz-range-thumb]:shadow-[0_0_0_0.5px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.25)]",
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
