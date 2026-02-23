"use client";

import { cn } from "@/lib/utils";
import { useWeather } from "../provider";

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { displayedGradient, isGradientTransitioning, edgeFadeMask } =
    useWeather();

  if (!displayedGradient) return null;

  const isVisible = enabled && !isGradientTransitioning;
  const gradientStyle: React.CSSProperties = {
    backgroundImage: displayedGradient,
    ...(edgeFadeMask
      ? {
          WebkitMaskImage: edgeFadeMask,
          maskImage: edgeFadeMask,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
        }
      : {}),
  };

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out",
        isVisible ? "opacity-70 dark:opacity-85" : "opacity-0"
      )}
      style={gradientStyle}
    />
  );
}
