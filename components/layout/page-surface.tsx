"use client";

import { useAmbient } from "@/components/providers";
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
  const { settings } = useAmbient();

  const gradientEnabled =
    settings.weatherGradientEnabled && isWeatherGradientEnabledForPath(pathname);

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
