"use client";

import { useAmbient, useTheme } from "@/components/providers";
import { getWeatherGradient } from "@/lib/ambient/gradient";
import { isWeatherGradientEnabledForPath } from "@/lib/ambient/route-config";
import { usePathname } from "next/navigation";

export function WeatherGradientBackground() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { settings, weather, debugWeatherOverride, debugWeatherOverrideEnabled } =
    useAmbient();

  const enabledForRoute = isWeatherGradientEnabledForPath(pathname);
  const enabled = settings.weatherGradientEnabled && enabledForRoute;

  const effectiveWeather = weather
    ? {
        ...weather,
        ...(settings.debugFabEnabled &&
        debugWeatherOverrideEnabled &&
        debugWeatherOverride
          ? debugWeatherOverride
          : null),
      }
    : null;

  if (!enabled || !effectiveWeather) return null;

  const gradient = getWeatherGradient({
    condition: effectiveWeather.condition,
    isDay: effectiveWeather.isDay,
    theme,
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 opacity-70 dark:opacity-85 transition-opacity"
      style={{ backgroundImage: gradient.backgroundImage }}
    />
  );
}
