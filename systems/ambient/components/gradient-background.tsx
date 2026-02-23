"use client";

import { cn } from "@/lib/utils";
import { isIPhoneSafariBrowser } from "@/systems/ambient/lib/platform";
import { useEffect, useState } from "react";
import { useWeather } from "../provider";

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

const IOS_EDGE_FADE_DISTANCE_PX = 128;

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { gradient, isFetching, softEdgingEnabled } = useWeather();
  const [displayedGradient, setDisplayedGradient] = useState<string>("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isIPhoneSafari] = useState(isIPhoneSafariBrowser);

  const targetGradient = gradient;

  useEffect(() => {
    if (isFetching) return;
    if (targetGradient === displayedGradient) return;
    if (!targetGradient) return;

    if (!displayedGradient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayedGradient(targetGradient);
      return;
    }

    setIsTransitioning(true);

    const timeout = setTimeout(() => {
      setDisplayedGradient(targetGradient);
      requestAnimationFrame(() => {
        setIsTransitioning(false);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [targetGradient, displayedGradient, isFetching]);

  // Don't render until we have a gradient to show
  if (!displayedGradient) return null;

  // Visible when enabled AND not transitioning between gradients
  const isVisible = enabled && !isTransitioning;
  const edgeFadeMask =
    `linear-gradient(180deg, transparent 0%, black calc(env(safe-area-inset-top) + ${IOS_EDGE_FADE_DISTANCE_PX}px), black calc(100% - env(safe-area-inset-bottom) - ${IOS_EDGE_FADE_DISTANCE_PX}px), transparent 100%)`;
  const shouldApplySoftEdging = softEdgingEnabled && isIPhoneSafari;
  const gradientStyle: React.CSSProperties = shouldApplySoftEdging
    ? {
        backgroundImage: displayedGradient,
        WebkitMaskImage: edgeFadeMask,
        maskImage: edgeFadeMask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
      }
    : { backgroundImage: displayedGradient };

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
