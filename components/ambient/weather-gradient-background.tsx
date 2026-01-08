"use client";

import { useWeather } from "@/components/providers";
import { isWeatherGradientEnabledForPath } from "@/lib/ambient/route-config";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * WeatherGradientBackground
 *
 * Renders an ambient gradient background based on current weather conditions.
 * Uses React Query's stale-while-revalidate pattern:
 *
 * 1. On initial load: shows gradient as soon as weather data is available
 * 2. During reload: keeps showing old gradient (React Query keeps stale data)
 * 3. When new data arrives: cross-fades to new gradient smoothly
 *
 * The cross-fade is achieved by animating opacity while updating the gradient.
 */
export function WeatherGradientBackground() {
  const pathname = usePathname();
  const {
    gradient,
    isGradientEnabled,
    isFetching,
  } = useWeather();

  // Track the current and previous gradient for smooth transitions
  const [displayedGradient, setDisplayedGradient] = useState<string>("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const enabledForRoute = isWeatherGradientEnabledForPath(pathname);
  const enabled = isGradientEnabled && enabledForRoute;

  // Compute the target gradient based on current weather/override
  const targetGradient = gradient;

  // Update displayed gradient with smooth transition
  useEffect(() => {
    // Skip if we're still loading (keep showing stale gradient)
    if (isFetching) return;

    // Skip if gradient hasn't actually changed
    if (targetGradient === displayedGradient) return;

    // Skip if there's no new gradient to show
    if (!targetGradient) return;

    // If we have no displayed gradient yet, show immediately (initial load)
    if (!displayedGradient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initial gradient display
      setDisplayedGradient(targetGradient);
      return;
    }

    // Cross-fade to new gradient
    // eslint-disable-next-line react-hooks/set-state-in-effect -- gradient transition
    setIsTransitioning(true);

    // Wait for fade-out, then update gradient, then fade-in
    const timeout = setTimeout(() => {
      setDisplayedGradient(targetGradient);
      // Small delay to ensure the gradient is applied before fading in
      requestAnimationFrame(() => {
        setIsTransitioning(false);
      });
    }, 300); // Match CSS transition duration

    return () => clearTimeout(timeout);
  }, [targetGradient, displayedGradient, isFetching]);

  // Don't render if disabled or no gradient to show
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
