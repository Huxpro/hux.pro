"use client";

import { useWeather } from "../provider";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { gradient, isFetching } = useWeather();
  const [displayedGradient, setDisplayedGradient] = useState<string>("");
  const [isTransitioning, setIsTransitioning] = useState(false);

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

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsTransitioning(true);

    const timeout = setTimeout(() => {
      setDisplayedGradient(targetGradient);
      requestAnimationFrame(() => {
        setIsTransitioning(false);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [targetGradient, displayedGradient, isFetching]);

  if (!enabled || !displayedGradient) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-300 ease-in-out",
        isTransitioning ? "opacity-0" : "opacity-70 dark:opacity-85"
      )}
      style={{ backgroundImage: displayedGradient }}
    />
  );
}
