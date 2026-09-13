"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { t, useLocale } from "@/services";
import { Loader2, Navigation } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLocationLabel } from "../lib";
import { useLocation } from "../provider";
import { WeatherIcon } from "./weather-icon";
import { useDisplayWeather, WeatherNow } from "./weather-now";

// ---------------------------------------------------------------------------
// Weather Widget — homepage grid card.
//
// Header (city + location indicator + condition icon) is widget-specific; the
// body is the shared <WeatherNow /> so the homepage and the dock phase panel
// render an identical readout.
// ---------------------------------------------------------------------------

export function WeatherWidget() {
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
        <WeatherNow />
      </WidgetBody>
    </WidgetShell>
  );
}
