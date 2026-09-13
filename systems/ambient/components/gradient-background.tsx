"use client";

import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useWeather } from "../provider";
import { GradientStack } from "./gradient-stack";

const WeatherWallpaper = dynamic(
  () => import("./weather-wallpaper").then((m) => m.WeatherWallpaper),
  { ssr: false }
);

interface WeatherGradientBackgroundProps {
  enabled: boolean;
}

export function WeatherGradientBackground({
  enabled,
}: WeatherGradientBackgroundProps) {
  const { gradientLayers, edgeFadeMask } = useWeather();
  const [wallpaperReady, setWallpaperReady] = useState(false);
  const onWallpaperReady = useCallback((ready: boolean) => {
    setWallpaperReady(ready);
  }, []);

  if (gradientLayers.length === 0) return null;

  const maskStyle: React.CSSProperties | undefined = edgeFadeMask
    ? {
        WebkitMaskImage: edgeFadeMask,
        maskImage: edgeFadeMask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
      }
    : undefined;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        "transition-opacity duration-700 ease-in-out",
        enabled ? "opacity-90 dark:opacity-95" : "opacity-0"
      )}
      style={maskStyle}
    >
      {/* CSS grade stays as the fallback (and widget-matching wash) until the
          WebGL wallpaper reports ready, then it sits underneath as a safety. */}
      <GradientStack layers={gradientLayers} />
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-700 ease-in-out",
          wallpaperReady ? "opacity-100" : "opacity-0"
        )}
      >
        <WeatherWallpaper enabled={enabled} onReady={onWallpaperReady} />
      </div>
    </div>
  );
}
