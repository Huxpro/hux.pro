"use client";

import { cn } from "@/lib/utils";
import { WallpaperBackground, useOptionalWallpaper } from "@/systems/wallpaper";
import { useWeather } from "../provider";
import { WeatherGradientBackground } from "./gradient-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const { fullGradientEnabled } = useWeather();
  const wallpaper = useOptionalWallpaper();
  const imageEnabled = wallpaper?.kind === "image";
  // Weather and image are mutually exclusive kinds of the same surface.
  const weatherEnabled = !imageEnabled && fullGradientEnabled;
  const hasWallpaper = imageEnabled || weatherEnabled;

  return (
    <>
      <WeatherGradientBackground enabled={weatherEnabled} />
      <WallpaperBackground enabled={imageEnabled} />
      <div
        className={cn(
          "min-h-screen transition-colors duration-500",
          hasWallpaper ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </>
  );
}
