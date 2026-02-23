"use client";

import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormFactor } from "../lib/route-config";
import { useWeather } from "../provider";
import { WeatherGradientBackground } from "./gradient-background";

const DESKTOP_BREAKPOINT = "(min-width: 768px)";

function useFormFactor(): FormFactor | null {
  const [formFactor, setFormFactor] = useState<FormFactor | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_BREAKPOINT);
    setFormFactor(mq.matches ? "desktop" : "mobile");

    const handler = (e: MediaQueryListEvent) => {
      setFormFactor(e.matches ? "desktop" : "mobile");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return formFactor;
}

export function AmbientSurface({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isGradientEnabledForPath } = useWeather();
  const formFactor = useFormFactor();

  const enabled = formFactor
    ? isGradientEnabledForPath(pathname, formFactor)
    : false;

  return (
    <>
      <WeatherGradientBackground enabled={enabled} />
      <div
        className={cn(
          "min-h-screen transition-colors duration-500",
          enabled ? "bg-transparent" : "bg-background"
        )}
      >
        {children}
      </div>
    </>
  );
}
