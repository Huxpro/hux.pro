"use client";

import { cn } from "@/lib/utils";
import { useWeather } from "../provider";
import { WeatherGradientBackground } from "./gradient-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const { fullGradientEnabled } = useWeather();

  return (
    <>
      <WeatherGradientBackground enabled={fullGradientEnabled} />
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
