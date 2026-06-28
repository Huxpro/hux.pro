"use client";

import { cn } from "@/lib/utils";
import { useWeather } from "../provider";
import { GradientStack } from "./gradient-stack";

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { gradientLayers, edgeFadeMask } = useWeather();

  if (gradientLayers.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out",
        enabled ? "opacity-70 dark:opacity-85" : "opacity-0"
      )}
    >
      {/* Full-page background is already viewport-fixed, so the edge mask is
          applied statically (no per-frame tracking needed). */}
      <GradientStack layers={gradientLayers} edgeMask={edgeFadeMask} />
    </div>
  );
}
