"use client";

import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import { useRangeDrag } from "./use-range-drag";

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
//
// The pointer is the wrapper's (useRangeDrag): a press anywhere on the track
// moves the value, and a drag keeps it until release wherever the pointer
// wanders. The wrapper reaches a few pixels past the 4px bar on each side so a
// finger can find it, without taking any room in the layout.
// =============================================================================

/**
 * The thumb's width for the press mapping: the desktop disc below, and near
 * enough the native knob on touch, where a drag is relative anyway.
 */
const THUMB_PX = 16;

const SLIDER_CLASS = cn(
  "pointer-events-none block h-1 w-full appearance-none rounded-full",
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
  const { inputRef, wrapperProps } = useRangeDrag({ value, min, max, step, onChange, thumb: THUMB_PX });
  return (
    <div {...wrapperProps} className={cn("relative -my-2.5 w-full cursor-pointer py-2.5", className)}>
      <input
        ref={inputRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText}
        onChange={(e) => onChange(Number(e.target.value))}
        className={SLIDER_CLASS}
        style={{ "--slider-fill": `${Math.min(100, Math.max(0, fill))}%` } as CSSProperties}
      />
    </div>
  );
}
