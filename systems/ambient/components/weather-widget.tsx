"use client";

import {
  WidgetBody,
  WidgetHeader,
  WidgetShell,
  WidgetTitle,
} from "@/components/ui/widget";
import { cn } from "@/lib/utils";
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
