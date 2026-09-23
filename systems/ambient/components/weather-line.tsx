"use client";

import { useLocale } from "@/services";
import { useEffect, useState } from "react";
import { formatLocationLabel } from "../lib";
import { useAmbientTime, useLocation } from "../provider";
import { useDisplayWeather } from "./weather-now";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// WeatherLine — the home screen's weather, said the way a lock screen says it.
//
// One line over the greeting: the date, the place, the temperature. The sky
// behind the page already shows the condition, and the dock's sunrise/sunset
// pill already carries the sun times, so what is left to say in words is
// small enough to be a line rather than a card.
//
// Each part is dropped rather than replaced while it is unknown: no weather
// yet reads as the date and the place, not as a spinner or "unavailable".
// The line is client-only (the date and the place are this visitor's), so it
// fades in after mount instead of rendering a server guess.
// ---------------------------------------------------------------------------

function formatDate(ms: number, locale: "en" | "zh"): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(ms);
  } catch {
    return "";
  }
}

export function WeatherLine({ className }: { className?: string }) {
  const { locale } = useLocale();
  const { nowMs } = useAmbientTime();
  const { location } = useLocation();
  const { displayWeather } = useDisplayWeather();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const parts = mounted
    ? [
        formatDate(nowMs, locale),
        location ? formatLocationLabel(location) : null,
        displayWeather ? `${Math.round(displayWeather.temperatureC)}°` : null,
      ].filter((part): part is string => !!part)
    : [];

  return (
    <p
      aria-hidden={parts.length === 0}
      className={cn(
        "text-sm text-muted-foreground tabular-nums transition-opacity duration-500",
        parts.length ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {parts.join(" · ") || " "}
    </p>
  );
}
