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
import { Loader2, Navigation } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLocationLabel, getWeatherConditionLabel } from "../lib";
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

export function WeatherWidget({ size = "medium" }: { size?: WidgetSize }) {
  const { locale } = useLocale();
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
  const small = size === "small";

  return (
    <WidgetShell onOpen={refresh}>
      {/* Header: City + location indicator left, weather icon right. The
          small square keeps the icon for the bottom line, next to the
          condition it names. */}
      <WidgetHeader className={cn(small && "pb-0")}>
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
        {!small && displayWeather && (
          <WeatherIcon
            condition={displayWeather.condition}
            isDay={displayWeather.isDay !== false}
            className="h-4 w-4 shrink-0 text-foreground/80"
          />
        )}
      </WidgetHeader>

      {small ? (
        <WidgetBody fill className="justify-end">
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
        <WidgetBody fill className="justify-end">
          <WeatherNow />
        </WidgetBody>
      )}
    </WidgetShell>
  );
}
