"use client";

import { cn } from "@/lib/utils";
import { EDGE_FADE_MASK, isIOSSafariBrowser } from "@/systems/ambient/lib/platform";
import { useDevtool } from "@/systems/devtool";
import { useState } from "react";
import { useWeather } from "../provider";

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { displayedGradient, isGradientTransitioning, softEdgingEnabled } =
    useWeather();
  const { isEnabled: isDevtoolEnabled } = useDevtool();
  const [isIOSSafari] = useState(isIOSSafariBrowser);

  if (!displayedGradient) return null;

  const isVisible = enabled && !isGradientTransitioning;
  const shouldApplySoftEdging =
    softEdgingEnabled && (isIOSSafari || isDevtoolEnabled);
  const gradientStyle: React.CSSProperties = {
    backgroundImage: displayedGradient,
    ...(shouldApplySoftEdging
      ? {
          WebkitMaskImage: EDGE_FADE_MASK,
          maskImage: EDGE_FADE_MASK,
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
