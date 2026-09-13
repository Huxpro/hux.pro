"use client";

import { cn } from "@/lib/utils";
import { WallpaperBackground } from "../../wallpaper/background";
import { useWallpaper, useWeather } from "../provider";
import { WeatherGradientBackground } from "./gradient-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const { fullGradientEnabled } = useWeather();
  const { effective } = useWallpaper();
  const imageEnabled = effective.source === "image";

  return (
    <>
      {imageEnabled ? <WallpaperBackground /> : effective.source === "weather" ? <WeatherGradientBackground enabled={fullGradientEnabled} /> : null}
      <div
        className={cn(
          "min-h-screen transition-colors duration-500",
          fullGradientEnabled || imageEnabled ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </>
  );
}
