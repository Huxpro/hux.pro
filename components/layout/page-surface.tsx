"use client";

import { useWeather } from "@/components/providers";
import { isWeatherGradientEnabledForPath } from "@/lib/ambient/route-config";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";

export function PageSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  const { isGradientEnabled } = useWeather();

  const gradientEnabled =
    isGradientEnabled && isWeatherGradientEnabledForPath(pathname);

  return (
    <div
      className={cn(
        "min-h-screen",
        gradientEnabled ? "bg-transparent" : "bg-background",
        className
      )}
    >
      {children}
    </div>
  );
}
