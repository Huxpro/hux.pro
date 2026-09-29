"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import type { WidgetSize } from "@/components/ui/widget-size";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Loader2, Navigation, Sunrise, Sunset } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formatClockTime,
  formatLocationLabel,
  getWeatherConditionLabel,
  type WeatherCondition,
} from "../lib";
import { useLocation } from "../provider";
import { WeatherIcon } from "./weather-icon";
import { useDisplayWeather, WeatherNow } from "./weather-now";

// ---------------------------------------------------------------------------
// Weather Widget — homepage grid card, in two sizes.
//
//   small   the glance: city, then the temperature and the condition pinned
//           to the bottom of the square — iOS's own small weather widget.
//           The temperature is the whole story here, so nothing else gets
//           to share the box with it.
//   medium  the readout: the same temperature, with the condition and the
//           day's light (sunrise / sunset) laid out beside it — the shared
//           <WeatherNow /> body the dock's phase panel also renders.
//
// The header (city + location indicator, condition icon) is the widget's
// own; the medium body is shared so the homepage and the dock never drift.
// ---------------------------------------------------------------------------

export const WEATHER_WIDGET_SIZES: readonly WidgetSize[] = ["small", "medium"];

// ---------------------------------------------------------------------------
// Apple skin — the sky
//
// Apple's Weather widget is the one widget on the Home Screen that is not a
// white or dark tile: it is the sky, and its text is white. Same here: a
// gradient per condition and day / night, top darker than bottom as the
// real sky is, muted enough that 13px white stays readable (the lightest
// stop, snow by day, still clears 3:1 for the large type and is paired with
// the heaviest weights). Classic and Glass: Clear draw no sky — see
// `.widget-backdrop` in globals.css.
// ---------------------------------------------------------------------------

const SKY: Record<WeatherCondition, { day: [string, string]; night: [string, string] }> = {
  clear: { day: ["#2c7fd6", "#5ea6e8"], night: ["#0d1936", "#26355a"] },
  cloudy: { day: ["#51708f", "#8199b1"], night: ["#1e2632", "#384354"] },
  fog: { day: ["#66788a", "#95a3b1"], night: ["#252b33", "#434b55"] },
  rain: { day: ["#3a4d66", "#657a92"], night: ["#151d29", "#2c384a"] },
  snow: { day: ["#6f8aa8", "#9fb3c8"], night: ["#252e3d", "#465266"] },
  thunder: { day: ["#373c59", "#5f6381"], night: ["#161929", "#323657"] },
};

function skyGradient(condition: WeatherCondition | undefined, isDay: boolean) {
  const [top, bottom] = condition
    ? SKY[condition][isDay ? "day" : "night"]
    : ["#46658a", "#7893b0"];
  return `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)`;
}

/** The sun event still ahead today: sunrise before it, sunset after it. */
function nextSunEvent(
  sunriseMs: number | undefined,
  sunsetMs: number | undefined,
  now: number,
): { kind: "sunrise" | "sunset"; ms: number } | null {
  if (sunriseMs && now < sunriseMs) return { kind: "sunrise", ms: sunriseMs };
  if (sunsetMs && now < sunsetMs) return { kind: "sunset", ms: sunsetMs };
  if (sunriseMs) return { kind: "sunrise", ms: sunriseMs };
  return null;
}

export function WeatherWidget({ size = "medium" }: { size?: WidgetSize }) {
  const { locale } = useLocale();
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

  // The clock the Apple bodies read (the next sun event, the day line):
  // after mount only — the server has no "now" worth rendering — and once
  // a minute after that, which is as often as either can change.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: the clock is browser-only
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
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
  const small = size === "small";
  const isDay = displayWeather?.isDay !== false;
  const condition = displayWeather
    ? getWeatherConditionLabel(displayWeather.condition, locale)
    : null;
  const sun =
    now !== null && displayWeather
      ? nextSunEvent(displayWeather.sunriseMs, displayWeather.sunsetMs, now)
      : null;
  const SunGlyph = sun?.kind === "sunset" ? Sunset : Sunrise;

  return (
    <WidgetShell onOpen={refresh} ink="light">
      <div
        aria-hidden
        className="widget-backdrop pointer-events-none absolute inset-0 -z-10"
        style={{ backgroundImage: skyGradient(displayWeather?.condition, isDay) }}
      />
      {/* Header: City + location indicator left, weather icon right. The
          small square keeps the icon for the bottom line, next to the
          condition it names. */}
      <WidgetHeader className={cn(small && "pb-0")}>
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
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <span
                  aria-hidden="true"
                  className="shrink-0 rounded-[4px] bg-muted px-1 font-mono text-[10px] leading-[14px] text-tertiary-foreground transition-colors duration-150 group-hover/ip:text-foreground group-active/ip:text-foreground"
                >
                  ip
                </span>
              )}
            </button>
          ) : (
            <>
              <WidgetTitle className="truncate">{displayCity}</WidgetTitle>
              {isReloading ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
              ) : mounted && location?.source === "geolocation" ? (
                <Navigation
                  className="h-3 w-3 shrink-0 text-muted-foreground"
                  aria-label={t(locale, "locationAccurate")}
                />
              ) : null}
            </>
          )}
        </div>
        {!small && displayWeather && (
          <WeatherIcon
            condition={displayWeather.condition}
            isDay={displayWeather.isDay !== false}
            className="h-4 w-4 shrink-0 text-foreground/80 skin-apple:hidden"
          />
        )}
      </WidgetHeader>

      {small ? (
        <WidgetBody fill className="justify-end skin-apple:hidden">
          {displayWeather ? (
            <>
              <div className="font-serif text-4xl @min-[176px]:text-5xl leading-none text-foreground tracking-tight tabular-nums">
                {Math.round(displayWeather.temperatureC)}°
              </div>
              <div className="mt-2 flex items-center gap-1.5 min-w-0">
                <WeatherIcon
                  condition={displayWeather.condition}
                  isDay={displayWeather.isDay !== false}
                  className="h-3.5 w-3.5 shrink-0 text-foreground/80"
                />
                <span className={cn("truncate", TYPE.label)}>
                  {getWeatherConditionLabel(displayWeather.condition, locale)}
                </span>
              </div>
            </>
          ) : (
            <div className={cn("line-clamp-2", TYPE.body)}>
              {t(locale, "weatherUnavailable")}
            </div>
          )}
        </WidgetBody>
      ) : (
        <WidgetBody fill className="justify-end skin-apple:hidden">
          <WeatherNow />
        </WidgetBody>
      )}

      {/* Apple skin. Small: Apple's own small Weather widget — the
          temperature right under the place, the condition and what the sun
          does next at the foot. Medium: the temperature beside the
          condition, and under them the day as a line from sunrise to
          sunset with a dot at now — a graphic where Apple's widget has its
          hourly strip. System font throughout; the temperature in its light
          weight, as Apple sets it. */}
      <WidgetBody fill className="hidden justify-between skin-apple:flex">
        {displayWeather ? (
          small ? (
            <>
              <div className="text-[44px] font-light leading-none tracking-tight tabular-nums text-foreground">
                {Math.round(displayWeather.temperatureC)}°
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1 text-[13px] font-semibold leading-4 text-foreground">
                  <WeatherIcon
                    condition={displayWeather.condition}
                    isDay={isDay}
                    className="h-3.5 w-3.5 shrink-0"
                  />
                  <span className="truncate">{condition}</span>
                </div>
                {sun && (
                  <div className="mt-0.5 flex items-center gap-1 text-[13px] font-medium leading-4 tabular-nums text-muted-foreground">
                    <SunGlyph className="h-3 w-3 shrink-0" aria-hidden />
                    {formatClockTime(sun.ms, locale)}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="text-[48px] font-light leading-none tracking-tight tabular-nums text-foreground">
                  {Math.round(displayWeather.temperatureC)}°
                </div>
                <div className="min-w-0 pt-1 text-right">
                  <WeatherIcon
                    condition={displayWeather.condition}
                    isDay={isDay}
                    className="mb-1 ml-auto h-5 w-5 text-foreground"
                  />
                  <div className="truncate text-[13px] font-semibold leading-4 text-foreground">
                    {condition}
                  </div>
                </div>
              </div>
              <DayLine
                sunriseMs={displayWeather.sunriseMs}
                sunsetMs={displayWeather.sunsetMs}
                now={now}
                locale={locale}
              />
            </>
          )
        ) : (
          <div className="mt-auto line-clamp-2 text-[13px] font-medium leading-4 text-muted-foreground">
            {t(locale, "weatherUnavailable")}
          </div>
        )}
      </WidgetBody>
    </WidgetShell>
  );
}

/**
 * The day as a line: sunrise at one end, sunset at the other, a dot where
 * now is (pinned to the nearer end at night). The medium Weather widget's
 * foot, where Apple's has its hourly forecast.
 */
function DayLine({
  sunriseMs,
  sunsetMs,
  now,
  locale,
}: {
  sunriseMs?: number;
  sunsetMs?: number;
  now: number | null;
  locale: Parameters<typeof formatClockTime>[1];
}) {
  if (!sunriseMs || !sunsetMs || sunsetMs <= sunriseMs) return null;
  const at =
    now === null
      ? null
      : Math.min(1, Math.max(0, (now - sunriseMs) / (sunsetMs - sunriseMs)));
  return (
    <div className="flex items-center gap-2 text-[12px] font-medium leading-4 tabular-nums text-muted-foreground">
      <Sunrise className="h-3 w-3 shrink-0" aria-hidden />
      <span>{formatClockTime(sunriseMs, locale)}</span>
      <div className="relative h-1 flex-1 rounded-full bg-foreground/25">
        {at !== null && (
          <>
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground/70"
              style={{ width: `${at * 100}%` }}
            />
            <div
              className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground shadow-[0_0_0_2px_rgb(0_0_0/0.15)]"
              style={{ left: `${at * 100}%` }}
            />
          </>
        )}
      </div>
      <span>{formatClockTime(sunsetMs, locale)}</span>
      <Sunset className="h-3 w-3 shrink-0" aria-hidden />
    </div>
  );
}
