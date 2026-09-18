"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { sizeSpec } from "@/components/ui/widget-grid";
import { useWidgetSize } from "@/components/ui/widget-size";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Loader2, Navigation, Sunrise, Sunset } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatClockTime,
  formatLocationLabel,
  getWeatherConditionLabel,
} from "../lib";
import { useLocation, useWeather } from "../provider";
import { WeatherIcon } from "./weather-icon";
import { useDisplayWeather, WeatherNow, type DisplayWeather } from "./weather-now";

// ---------------------------------------------------------------------------
// Weather Widget — homepage grid card.
//
// Header (city + location indicator + condition icon) is widget-specific; the
// body is the shared <WeatherNow /> so the homepage and the dock phase panel
// render an identical readout.
//
// Footprints: one cell is the readout — temperature, condition, sunrise and
// sunset. Two cells wide is the *day*: the readout gains what the air is
// doing (feels like, humidity, wind), and the second cell draws the sun's
// arc with the sun where it is right now, sunrise and sunset at its feet.
// The widget declares no height: there is no taller weather here.
// ---------------------------------------------------------------------------

export const WEATHER_WIDGET_SIZE = sizeSpec([1, 1], [2, 1], [1, 1]);

export function WeatherWidget() {
  const { locale } = useLocale();
  const { w } = useWidgetSize(WEATHER_WIDGET_SIZE.default);
  const [mounted, setMounted] = useState(false);
  const [staleCity, setStaleCity] = useState<string | null>(null);

  const {
    locationMode,
    location,
    isLoading: locationLoading,
    isFetching: locationFetching,
  } = useLocation();

  const { displayWeather, refresh } = useDisplayWeather();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const cityLabel = location ? formatLocationLabel(location) : null;
  useEffect(() => {
    if (!cityLabel) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStaleCity(cityLabel);
  }, [cityLabel]);
  const displayCity = cityLabel ?? staleCity ?? t(locale, "widgetWeather");

  const isReloading = locationLoading || locationFetching;

  return (
    <WidgetShell onOpen={refresh}>
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
        {w >= 2 && displayWeather ? (
          <WeatherDay weather={displayWeather} />
        ) : (
          <WeatherNow />
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// The two-cell-wide body: readout with the air, and the sun's arc.
// ---------------------------------------------------------------------------

function WeatherDay({ weather }: { weather: DisplayWeather }) {
  const { locale } = useLocale();
  const { weather: raw } = useWeather();

  const details: string[] = [];
  if (raw?.apparentTemperatureC !== undefined) {
    details.push(
      `${t(locale, "weatherFeelsLike")} ${Math.round(raw.apparentTemperatureC)}°`,
    );
  }
  if (raw?.humidity !== undefined) {
    details.push(`${t(locale, "weatherHumidity")} ${Math.round(raw.humidity * 100)}%`);
  }
  if (raw?.windSpeedKmh !== undefined) {
    details.push(`${t(locale, "weatherWind")} ${Math.round(raw.windSpeedKmh)} km/h`);
  }

  return (
    <div className="grid grid-cols-2 gap-x-6">
      <div className="flex min-w-0 flex-col justify-between">
        <div className="font-serif text-5xl leading-none text-foreground tracking-tight tabular-nums">
          {Math.round(weather.temperatureC)}°
        </div>
        <div className="mt-2 min-w-0">
          <div className={TYPE.label}>
            {getWeatherConditionLabel(weather.condition, locale)}
          </div>
          {details.length > 0 && (
            <div className={cn("mt-1 truncate", TYPE.meta)}>
              {details.join(" · ")}
            </div>
          )}
        </div>
      </div>
      <SunArc sunriseMs={weather.sunriseMs} sunsetMs={weather.sunsetMs} />
    </div>
  );
}

/** The day as an arc: sunrise at the left foot, sunset at the right, the sun where it is now. */
function SunArc({ sunriseMs, sunsetMs }: { sunriseMs?: number; sunsetMs?: number }) {
  const { locale } = useLocale();
  // Minute-resolution clock, started on mount so the server never draws a sun.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const hasDay = !!sunriseMs && !!sunsetMs && sunsetMs > sunriseMs;
  const progress =
    hasDay && now !== null ? (now - sunriseMs) / (sunsetMs - sunriseMs) : null;
  const isUp = progress !== null && progress >= 0 && progress <= 1;
  // Half circle, radius 44 about (50, 48); 0 = sunrise (left), 1 = sunset (right).
  const angle = isUp ? Math.PI * (1 - progress) : 0;
  const sunX = 50 + 44 * Math.cos(angle);
  const sunY = 48 - 44 * Math.sin(angle);

  return (
    <div className="flex min-w-0 flex-col justify-end">
      <svg
        viewBox="0 0 100 52"
        className="w-full"
        aria-hidden
        fill="none"
        strokeLinecap="round"
      >
        <path
          d="M 6 48 A 44 44 0 0 1 94 48"
          className="stroke-foreground/15"
          strokeWidth="1.5"
          strokeDasharray="2 3"
        />
        <line x1="2" y1="48" x2="98" y2="48" className="stroke-foreground/10" strokeWidth="1" />
        {isUp && (
          <>
            <path
              d={`M 6 48 A 44 44 0 0 1 ${sunX.toFixed(2)} ${sunY.toFixed(2)}`}
              className="stroke-foreground/45"
              strokeWidth="1.5"
            />
            <circle cx={sunX} cy={sunY} r="3.5" className="fill-foreground" />
          </>
        )}
      </svg>
      {hasDay && (
        <div className={cn("mt-1 flex items-center justify-between", TYPE.meta)}>
          <span className="flex items-center gap-1">
            <Sunrise className="h-3 w-3" />
            {formatClockTime(sunriseMs, locale)}
          </span>
          <span className="flex items-center gap-1">
            {formatClockTime(sunsetMs, locale)}
            <Sunset className="h-3 w-3" />
          </span>
        </div>
      )}
    </div>
  );
}

