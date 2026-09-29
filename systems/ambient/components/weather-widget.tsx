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
import { LoadingIndicator } from "@/systems/os/android/components/loading-indicator";
import { Themed } from "@/systems/os/components/themed";
import { useEffect, useState } from "react";
import {
  formatClockTime,
  formatLocationLabel,
  getWeatherConditionLabel,
} from "../lib";
import { useLocation, useWeather } from "../provider";
import { WeatherIcon } from "./weather-icon";
import { useDisplayWeather, WeatherNow, type DisplayWeather } from "./weather-now";
import { ExpressiveShape, type ShapeName } from "@/systems/os";
import type { WeatherCondition } from "../lib";

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
    location,
    isLoading: locationLoading,
    isFetching: locationFetching,
    openLocationPrimer,
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
  // A city from the network is a guess, and the header says so: an `ip` tag
  // beside it, where the arrow sits for a GPS fix. Tag and city together are
  // the way to the location primer — the one place a visitor who sees the
  // wrong city goes looking. When the guess also disagrees with this device's
  // clock it is probably wrong, and it reads "Dallas?".
  const guessed = mounted && location?.source === "ip";
  const doubtful = guessed && location.timezoneMismatch === true;

  const isReloading = locationLoading || locationFetching;

  return (
    <WidgetShell onOpen={refresh}>
      {/* Header: City + location indicator left, weather icon right */}
      <WidgetHeader>
        <div className="flex items-center gap-1.5 min-w-0">
          {guessed ? (
            <button
              type="button"
              onClick={openLocationPrimer}
              aria-label={t(locale, doubtful ? "locationDoubtful" : "locationGuessed")}
              title={t(locale, doubtful ? "locationDoubtful" : "locationGuessed")}
              // `pressable` + `active:` — the city and its tag wash together on
              // touch-down, as one control, and ease back on release; the
              // negative margin keeps the text where the plain title sits.
              className={cn(
                "pressable group/ip -mx-1.5 -my-0.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left outline-none",
                "transition-colors duration-150",
                "hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.08] active:bg-foreground/[0.10]"
              )}
            >
              <WidgetTitle className="truncate transition-colors duration-150 group-hover/ip:text-foreground group-active/ip:text-foreground">
                {/* One child: the title is a flex row with a gap. */}
                <span className="truncate">
                  {displayCity}
                  {doubtful && <span className="text-muted-foreground">?</span>}
                </span>
              </WidgetTitle>
              {isReloading ? (
                <Themed
                  hux={<Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
                  android={<LoadingIndicator size={18} />}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="shrink-0 rounded-[4px] bg-muted px-1 font-mono text-[10px] leading-[14px] text-tertiary-foreground transition-colors duration-150 group-hover/ip:text-foreground group-active/ip:text-foreground m3:rounded-full m3:bg-(--md-surface-container-highest) m3:px-1.5 m3:text-[11px] m3:font-medium m3:leading-4 m3:text-(--md-on-surface-variant)"
                >
                  ip
                </span>
              )}
            </button>
          ) : (
            <>
              <WidgetTitle className="truncate">{displayCity}</WidgetTitle>
              {isReloading ? (
                <Themed
                  hux={<Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />}
                  android={<LoadingIndicator size={18} />}
                />
              ) : mounted && location?.source === "geolocation" ? (
                <Navigation
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                  aria-label={t(locale, "locationAccurate")}
                />
              ) : null}
            </>
          )}
        </div>
        {displayWeather && (
          <WeatherIcon
            condition={displayWeather.condition}
            isDay={displayWeather.isDay !== false}
            // In the Android theme the glyph is the body's hero, on its
            // shape; a second one in the header would say it twice.
            className="h-4 w-4 shrink-0 text-foreground/80 m3:hidden"
          />
        )}
      </WidgetHeader>

      <WidgetBody>
        {w >= 2 && displayWeather ? (
          <WeatherDay weather={displayWeather} />
        ) : displayWeather ? (
          <>
            {/* Both readouts are in the tree and the stylesheet picks one
                (`m3:`), so a returning visitor in either theme gets the
                right one on the first frame, with no second render. */}
            <div className="m3:hidden">
              <WeatherNow />
            </div>
            <MaterialWeatherNow weather={displayWeather} />
          </>
        ) : (
          <WeatherNow />
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

// ---------------------------------------------------------------------------
// The Material readout — Android's weather widget, in this site's data.
//
// Android's own guidance for a widget that shows one thing (the weather, the
// current song): "try out making your whole widget an expressive shape", or
// use one for visual hierarchy. So the condition sits on a Material 3
// Expressive shape in `primary-container`, and the shape is the weather's —
// a sun is `Sunny`'s points, rain a nine-sided cookie, snow a flower,
// thunder a burst — while the temperature is the one big number, Display
// Medium in Google Sans Flex with its roundness axis all the way up.
// ---------------------------------------------------------------------------

const CONDITION_SHAPE: Record<WeatherCondition, ShapeName> = {
  clear: "sunny",
  cloudy: "cookie12",
  fog: "cookie7",
  rain: "cookie9",
  snow: "flower",
  thunder: "softBurst",
};

function MaterialWeatherNow({ weather }: { weather: DisplayWeather }) {
  const { locale } = useLocale();
  const isDay = weather.isDay !== false;
  // A clear night is not a sun: the moon sits on a soft cookie instead.
  const shape = weather.condition === "clear" && !isDay ? "cookie12" : CONDITION_SHAPE[weather.condition];
  return (
    <div className="hidden items-center justify-between gap-4 m3:flex">
      <div className="min-w-0">
        <div className="text-[45px] font-normal leading-[52px] tracking-normal text-foreground [font-variation-settings:'ROND'_100]">
          {Math.round(weather.temperatureC)}°
        </div>
        <div className="mt-0.5 truncate text-sm leading-5 text-muted-foreground">
          {getWeatherConditionLabel(weather.condition, locale)}
          {weather.sunriseMs && weather.sunsetMs ? (
            <span className="text-tertiary-foreground">
              {" · "}
              {formatClockTime(isDay ? weather.sunsetMs : weather.sunriseMs, locale)}
              {isDay ? " ↓" : " ↑"}
            </span>
          ) : null}
        </div>
      </div>
      <ExpressiveShape
        shape={shape}
        className="size-[76px] shrink-0 text-(--md-on-primary-container)"
      >
        <WeatherIcon
          condition={weather.condition}
          isDay={isDay}
          className="size-9"
        />
      </ExpressiveShape>
    </div>
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
        <div className="font-serif text-5xl leading-none text-foreground tracking-tight tabular-nums m3:font-sans m3:text-[45px] m3:leading-[52px] m3:[font-variant-numeric:normal] m3:[font-variation-settings:'ROND'_100]">
          {Math.round(weather.temperatureC)}°
        </div>
        <div className="mt-2 min-w-0">
          <div className={TYPE.label}>
            {getWeatherConditionLabel(weather.condition, locale)}
          </div>
          {details.length > 0 && (
            <div className={cn("mt-1 truncate m3:first-letter:uppercase", TYPE.meta)}>
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
    <div className="flex min-w-0 flex-col items-center justify-end">
      {/* Height-bound, not width-bound: a one-row cell has ~100px of body,
          and an arc sized by a 300px column would be half again that. */}
      <svg
        viewBox="0 0 100 52"
        className="h-[58px] w-auto max-w-full"
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
              className="stroke-foreground/45 m3:stroke-(--md-primary)"
              strokeWidth="1.5"
            />
            <circle cx={sunX} cy={sunY} r="3.5" className="fill-foreground m3:fill-(--md-primary)" />
          </>
        )}
      </svg>
      {hasDay && (
        <div className={cn("mt-1 flex w-full max-w-[112px] items-center justify-between", TYPE.meta)}>
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

