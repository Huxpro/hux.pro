"use client";

import { WeatherIcon } from "./weather-icon";
import { useLocale, t } from "@/services";
import { useDevtool } from "@/systems/devtool";
import { useLocation, useWeather } from "../provider";
import { formatLocationLabel, type WeatherCondition, getWeatherConditionLabel } from "../lib";
import { WidgetShell, WidgetHeader, WidgetTitle, WidgetBody } from "@/components/ui/widget";
import { Loader2, Navigation, Sunrise, Sunset } from "lucide-react";
import { useEffect, useState } from "react";

/** Format milliseconds to HH:MM (24h) */
function formatTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function WeatherWidget() {
  const { locale } = useLocale();
  const [devForceEmpty, setDevForceEmpty] = useState(false);
  const [staleCity, setStaleCity] = useState<string | null>(null);
  const [staleWeather, setStaleWeather] = useState<{
    temperatureC: number;
    condition: WeatherCondition;
    isDay?: boolean;
    sunriseMs?: number;
    sunsetMs?: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  const {
    locationMode,
    location,
    isLoading: locationLoading,
    isFetching: locationFetching,
  } = useLocation();

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    weather,
    isLoading: weatherLoading,
    isFetching: weatherFetching,
    error,
    refresh,
    isOverrideEnabled,
    debugOverride,
  } = useWeather();
  const { isEnabled: isDevtoolEnabled } = useDevtool();

  const isBootLoading = !weather && weatherLoading;
  const isReloading =
    locationLoading || locationFetching || weatherLoading || weatherFetching;

  const cityLabel = location ? formatLocationLabel(location) : null;
  useEffect(() => {
    if (!cityLabel) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleCity(cityLabel);
  }, [cityLabel]);
  const displayCity = cityLabel ?? staleCity ?? t(locale, "widgetWeather");

  const effectiveCondition: WeatherCondition | undefined =
    weather && isDevtoolEnabled && isOverrideEnabled && debugOverride
      ? debugOverride.condition
      : weather?.condition;
  const effectiveIsDay: boolean | undefined =
    weather && isDevtoolEnabled && isOverrideEnabled && debugOverride
      ? debugOverride.isDay
      : weather?.isDay;

  useEffect(() => {
    if (!weather || !effectiveCondition) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleWeather({
      temperatureC: weather.temperatureC,
      condition: effectiveCondition,
      isDay: effectiveIsDay,
      sunriseMs: weather.sunriseMs,
      sunsetMs: weather.sunsetMs,
    });
  }, [weather, effectiveCondition, effectiveIsDay]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    try {
      const params = new URLSearchParams(window.location.search);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDevForceEmpty(params.get("weather") === "empty");
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDevForceEmpty(false);
    }
  }, []);

  const displayWeather = devForceEmpty
    ? null
    : weather && effectiveCondition
    ? {
        temperatureC: weather.temperatureC,
        condition: effectiveCondition,
        isDay: effectiveIsDay,
        sunriseMs: weather.sunriseMs,
        sunsetMs: weather.sunsetMs,
      }
    : staleWeather;

  return (
    <WidgetShell>
      {/* Header: City + location indicator left, weather icon right */}
      <WidgetHeader>
        <div className="flex items-center gap-1.5 min-w-0">
          <WidgetTitle className="truncate">{displayCity}</WidgetTitle>
          {isReloading ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
          ) : mounted && locationMode === "accurate" ? (
            <Navigation
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-label={t(locale, "locationAccurate")}
            />
          ) : null}
        </div>
        {displayWeather && (
          <WeatherIcon
            condition={displayWeather.condition}
            isDay={displayWeather.isDay !== false}
            className="h-4 w-4 shrink-0 text-foreground/80"
          />
        )}
      </WidgetHeader>

      <WidgetBody>
        {isBootLoading && !displayWeather ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayWeather ? (
          <div className="flex items-end justify-between gap-4">
            {/* Left: Large temperature aligned bottom-left */}
            <div className="font-serif text-5xl leading-none text-foreground tracking-tight tabular-nums translate-y-2">
              {Math.round(displayWeather.temperatureC)}°
            </div>

            {/* Right: Condition + sunrise/sunset stacked */}
            <div className="flex flex-col items-end justify-end gap-1.5">
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {getWeatherConditionLabel(displayWeather.condition, locale)}
              </div>

              {(displayWeather.sunriseMs || displayWeather.sunsetMs) && (
                <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                  {displayWeather.sunriseMs && (
                    <span className="flex items-center gap-1">
                      <Sunrise className="h-3 w-3" />
                      {formatTime(displayWeather.sunriseMs)}
                    </span>
                  )}
                  {displayWeather.sunsetMs && (
                    <span className="flex items-center gap-1">
                      <Sunset className="h-3 w-3" />
                      {formatTime(displayWeather.sunsetMs)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground leading-relaxed">
              {devForceEmpty ? "no data (dev)" : t(locale, "weatherUnavailable")}
            </div>
            {error && (
              <div className="text-xs font-mono text-muted-foreground/80">
                {error}
              </div>
            )}
            <button
              onClick={() => refresh()}
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              retry
            </button>
          </div>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}
