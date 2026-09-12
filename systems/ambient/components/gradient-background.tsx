"use client";

import { cn } from "@/lib/utils";
import { useWeather } from "../provider";
import { GradientStack } from "./gradient-stack";
import { WeatherWallpaper } from "./weather-wallpaper";

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { gradientLayers, edgeFadeMask, wallpaperScene } = useWeather();

  if (gradientLayers.length === 0 && !wallpaperScene) return null;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out",
        enabled ? "opacity-80 dark:opacity-100" : "opacity-0"
      )}
    >
      {/* CSS underlay doubles as the widget-matching fallback while the
          living wallpaper (WebGL sky + particles) fades in on top. */}
      <GradientStack layers={gradientLayers} edgeMask={edgeFadeMask} />
      <WeatherWallpaper
        scene={wallpaperScene}
        enabled={enabled}
        edgeMask={edgeFadeMask}
      />
    </div>
  );
}
