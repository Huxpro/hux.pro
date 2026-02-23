"use client";

import { cn } from "@/lib/utils";
import { isIPhoneSafariBrowser } from "@/systems/ambient/lib/platform";
import { useDevtool } from "@/systems/devtool";
import { useState } from "react";
import { useWeather } from "../provider";

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

const IOS_EDGE_FADE_DISTANCE_PX = 128;

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { displayedGradient, isGradientTransitioning, softEdgingEnabled } =
    useWeather();
  const { isEnabled: isDevtoolEnabled } = useDevtool();
  const [isIPhoneSafari] = useState(isIPhoneSafariBrowser);

  if (!displayedGradient) return null;

  const isVisible = enabled && !isGradientTransitioning;
  const edgeFadeMask = `linear-gradient(180deg, transparent 0%, black calc(env(safe-area-inset-top) + ${IOS_EDGE_FADE_DISTANCE_PX}px), black calc(100% - env(safe-area-inset-bottom) - ${IOS_EDGE_FADE_DISTANCE_PX}px), transparent 100%)`;
  const shouldApplySoftEdging =
    softEdgingEnabled && (isIPhoneSafari || isDevtoolEnabled);
  const gradientStyle: React.CSSProperties = {
    backgroundImage: displayedGradient,
    ...(shouldApplySoftEdging
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
