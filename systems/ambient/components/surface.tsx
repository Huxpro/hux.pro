"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getRouteGradientDefault,
  matchRoutePattern,
} from "../lib/route-config";
import { useWeather } from "../provider";
import { WeatherGradientBackground } from "./gradient-background";

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isGradientEnabledForPath } = useWeather();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const enabled = hasMounted
    ? isGradientEnabledForPath(pathname)
    : getRouteGradientDefault(matchRoutePattern(pathname));

  return (
    <>
      <WeatherGradientBackground enabled={enabled} />
      <div
        className={cn(
          "min-h-screen transition-colors duration-300",
          enabled ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </>
  );
}
