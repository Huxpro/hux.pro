"use client";

import { useAmbient, useLocale } from "@/components/providers";
import { WeatherIcon } from "@/components/ambient/weather-icon";
import { formatLocationLabel } from "@/lib/ambient/location";
import type { WeatherCondition } from "@/lib/ambient/weather";
import { getWeatherConditionLabel } from "@/lib/ambient/weather";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
  const {
    settings,
    location,
    weather,
    debugWeatherOverride,
    debugWeatherOverrideEnabled,
    hasAttemptedWeather,
    isResolvingLocation,
    isFetchingWeather,
    error,
    refresh,
  } = useAmbient();

  const isBootLoading = settings.weatherEnabled && !hasAttemptedWeather && !weather;
  const isReloading = isResolvingLocation || isFetchingWeather;

  // City label: keep last-known city during reloads for a more “iOS widget” feel.
  const cityLabel = location ? formatLocationLabel(location) : null;
  useEffect(() => {
    if (!cityLabel) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleCity(cityLabel);
  }, [cityLabel]);
  const displayCity = cityLabel ?? staleCity ?? t(locale, "widgetWeather");

  const effectiveCondition: WeatherCondition | undefined =
    weather &&
    settings.debugFabEnabled &&
    debugWeatherOverrideEnabled &&
    debugWeatherOverride
      ? debugWeatherOverride.condition
      : weather?.condition;
  const effectiveIsDay: boolean | undefined =
    weather &&
    settings.debugFabEnabled &&
    debugWeatherOverrideEnabled &&
    debugWeatherOverride
      ? debugWeatherOverride.isDay
      : weather?.isDay;

  // Weather: keep last-known weather during reloads, but show a small spinner.
  useEffect(() => {
    if (!weather || !effectiveCondition) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleWeather({
      temperatureC: weather.temperatureC,
      condition: effectiveCondition,
      isDay: effectiveIsDay,
    });
  }, [weather, effectiveCondition, effectiveIsDay]);

  /**
   * Dev-only empty state trigger.
   * Usage: append `?weather=empty` to any page URL (client-only).
   *
   * Note: we intentionally avoid `useSearchParams()` here because it requires
   * Suspense boundaries and can break static prerendering for `/`.
   */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const id = setTimeout(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        setDevForceEmpty(params.get("weather") === "empty");
      } catch {
        setDevForceEmpty(false);
      }
    }, 0);
    return () => clearTimeout(id);
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
    <div
      className={cn(
        "group relative p-5 rounded-2xl",
        "bg-card/50 backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300",
        "hover:border-border hover:bg-card/70"
      )}
    >
      {/* iOS-style header row */}
      <div className="flex items-center justify-between">
        {/* Top-left: city */}
        <div className="min-w-0">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground truncate">
            {displayCity}
          </div>
        </div>

        {/* Right side: geolocation icon OR spinner while reloading */}
        <div className="flex items-center gap-2">
          {isReloading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : settings.locationMode === "accurate" ? (
            <Navigation
              className="h-4 w-4 text-muted-foreground"
              aria-label={t(locale, "locationAccurate")}
            />
          ) : null}
        </div>
      </div>

      {/* Body */}
      {isBootLoading && !displayWeather ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : displayWeather ? (
        <div className="mt-3 flex items-end justify-between gap-4">
          {/* Bottom-left: temperature (drop C) */}
          <div className="font-serif text-4xl leading-none text-foreground tracking-tight tabular-nums">
            {Math.round(displayWeather.temperatureC)}°
          </div>

          {/* Right column: top-right icon + bottom-right label */}
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
  );
}
