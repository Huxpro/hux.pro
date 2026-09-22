"use client";

import { t, useLocale } from "@/services";
import { Loader2, Sunrise, Sunset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  formatClockTime,
  getWeatherConditionLabel,
  type WeatherCondition,
} from "../lib";
import { useWeather } from "../provider";

import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
// ---------------------------------------------------------------------------
// WeatherNow — the shared weather "body".
//
// The mirror of <NowPlaying /> in the music system: a pure presentational card
// body bound to the ambient provider, reused by both the homepage WeatherWidget
// and the dock phase-change panel so the readout stays identical everywhere.
//
// `useDisplayWeather()` centralises the data resolution (debug overrides,
// stale-while-revalidate, dev "empty" flag) so any consumer — the body here or
// the widget's own header icon — sees the same effective weather.
// ---------------------------------------------------------------------------

export interface DisplayWeather {
  temperatureC: number;
  condition: WeatherCondition;
  isDay?: boolean;
  sunriseMs?: number;
  sunsetMs?: number;
}

export function useDisplayWeather() {
  const {
    weather,
    scene,
    isLoading,
    error,
    refresh,
  } = useWeather();

  const [staleWeather, setStaleWeather] = useState<DisplayWeather | null>(null);
  const [devForceEmpty, setDevForceEmpty] = useState(false);

  // The scene already resolved the devtool's condition override and the
  // effective clock's day/night, so the icon can never disagree with the sky.
  const effectiveCondition: WeatherCondition | undefined = weather
    ? scene.condition
    : undefined;
  const effectiveIsDay = scene.sun.isDay;

  const current = useMemo<DisplayWeather | null>(
    () =>
      weather && effectiveCondition
        ? {
            temperatureC: weather.temperatureC,
            condition: effectiveCondition,
            isDay: effectiveIsDay,
            sunriseMs: weather.sunriseMs,
            sunsetMs: weather.sunsetMs,
          }
        : null,
    [weather, effectiveCondition, effectiveIsDay]
  );

  useEffect(() => {
    if (!current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleWeather(current);
  }, [current]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const params = new URLSearchParams(window.location.search);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDevForceEmpty(params.get("weather") === "empty");
    } catch {
      setDevForceEmpty(false);
    }
  }, []);

  const displayWeather: DisplayWeather | null = devForceEmpty
    ? null
    : current ?? staleWeather;

  return {
    displayWeather,
    isBootLoading: !weather && isLoading,
    error,
    refresh,
    devForceEmpty,
  };
}

export function WeatherNow() {
  const { locale } = useLocale();
  const { displayWeather, isBootLoading, error, refresh, devForceEmpty } =
    useDisplayWeather();

  if (isBootLoading && !displayWeather) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (displayWeather) {
    return (
      <div className="flex items-end justify-between gap-4">
        {/* Left: Large temperature aligned bottom-left */}
        <div className="font-serif text-5xl leading-none text-foreground tracking-tight tabular-nums translate-y-2">
          {Math.round(displayWeather.temperatureC)}°
        </div>

        {/* Right: Condition + sunrise/sunset stacked */}
        <div className="flex flex-col items-end justify-end gap-1.5">
          <div className={TYPE.label}>
            {getWeatherConditionLabel(displayWeather.condition, locale)}
          </div>

          {(displayWeather.sunriseMs || displayWeather.sunsetMs) && (
            <div className={cn("flex items-center gap-3", TYPE.meta)}>
              {displayWeather.sunriseMs && (
                <span className="flex items-center gap-1">
                  <Sunrise className="h-3 w-3" />
                  {formatClockTime(displayWeather.sunriseMs, locale)}
                </span>
              )}
              {displayWeather.sunsetMs && (
                <span className="flex items-center gap-1">
                  <Sunset className="h-3 w-3" />
                  {formatClockTime(displayWeather.sunsetMs, locale)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={TYPE.body}>
        {devForceEmpty ? "no data (dev)" : t(locale, "weatherUnavailable")}
      </div>
      {error && (
        <div className={TYPE.meta}>{error}</div>
      )}
      <button
        type="button"
        onClick={() => refresh()}
        className={cn(
          "pressable -mx-2 inline-flex min-h-7 items-center rounded-md px-2 outline-none",
          TYPE.nav,
          "hover:bg-foreground/[0.06] hover:text-foreground",
          "focus-visible:bg-foreground/[0.08] focus-visible:text-foreground",
          "active:bg-foreground/[0.10] active:text-foreground",
        )}
      >
        {t(locale, "weatherRetry")}
      </button>
    </div>
  );
}
