"use client";

import { WeatherGradientBackground } from "./gradient-background";
import { useWeather } from "../provider";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isGradientEnabledForPath } = useWeather();

  const enabled = isGradientEnabledForPath(pathname);

  return (
    <>
      <WeatherGradientBackground enabled={enabled} />
      <div
        className={cn(
          "min-h-screen",
          enabled ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </>
  );
}
