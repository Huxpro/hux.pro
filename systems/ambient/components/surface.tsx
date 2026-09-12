"use client";

import { cn } from "@/lib/utils";
import { useWeather } from "../provider";
import { WallpaperBackground } from "./wallpaper-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const { fullGradientEnabled } = useWeather();

  return (
    <>
      <WallpaperBackground enabled={fullGradientEnabled} />
      <div
        className={cn(
          "min-h-screen transition-colors duration-500",
          fullGradientEnabled ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </>
  );
}
