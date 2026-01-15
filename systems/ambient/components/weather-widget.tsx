"use client";

import { WeatherIcon } from "./weather-icon";
import { useLocale, t } from "@/services";
import { useDevtool } from "@/systems/devtool";
import { useLocation, useWeather } from "../provider";
import { formatLocationLabel, type WeatherCondition, getWeatherConditionLabel } from "../lib";
import { WidgetShell, WidgetTitle } from "@/components/ui/widget";
import { Loader2, Navigation } from "lucide-react";
import { useEffect, useState } from "react";

export function WeatherWidget() {
  const { locale } = useLocale();
  const [devForceEmpty, setDevForceEmpty] = useState(false);
  const [staleCity, setStaleCity] = useState<string | null>(null);
  const [staleWeather, setStaleWeather] = useState<{
    temperatureC: number;
    condition: WeatherCondition;
    isDay?: boolean;
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
      }
    : staleWeather;

  return (
    <WidgetShell>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <WidgetTitle className="truncate">{displayCity}</WidgetTitle>
          </div>
          <div className="flex items-center gap-2">
            {isReloading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : mounted && locationMode === "accurate" ? (
              <Navigation
                className="h-4 w-4 text-muted-foreground"
                aria-label={t(locale, "locationAccurate")}
              />
            ) : null}
          </div>
        </div>

        {isBootLoading && !displayWeather ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : displayWeather ? (
          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="font-serif text-4xl leading-none text-foreground tracking-tight tabular-nums">
              {Math.round(displayWeather.temperatureC)}°
            </div>
            <div className="flex flex-col items-end justify-between min-h-[52px]">
              <div className="text-foreground/80">
                <WeatherIcon
                  condition={displayWeather.condition}
                  isDay={displayWeather.isDay !== false}
                  className="h-4 w-4"
                />
              </div>
              <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {getWeatherConditionLabel(displayWeather.condition, locale)}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
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
      </div>
    </WidgetShell>
  );
}
