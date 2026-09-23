"use client";

import { t, useLocale } from "@/services";
import { LiveActivity } from "@/systems/dock";
import { Sunrise, Sunset } from "lucide-react";
import { formatClockTime } from "../lib";
import { getUpcomingSunEvent } from "../lib/notification";
import { useAmbientTime } from "../provider";
import { WeatherNow } from "./weather-now";

// ---------------------------------------------------------------------------
// Ambient Phase Activity — sun-event notification.
//
// A heads-up that the ambient phase is about to change to sunrise/sunset. It
// plugs into the shared Dock exactly like the music player: a collapsed pill
// (sun icon + exact time) that unfolds into the weather widget body.
//
// Visibility (see lib/notification.ts): the lead-up to the event through the
// end of its ±window. Devtool time travel moves the clock (and the sun times)
// so the sunrise/sunset states are demoable at any hour.
// ---------------------------------------------------------------------------

export function AmbientPhaseActivity() {
  const { locale } = useLocale();
  // Sun times come from the time context so devtool time travel (including a
  // shifted day) moves the notification along with the clock.
  const { nowMs, sunriseMs, sunsetMs } = useAmbientTime();

  // Inside the notification window of an upcoming sun event.
  const upcoming = getUpcomingSunEvent({ nowMs, sunriseMs, sunsetMs });

  const event = upcoming?.event;
  if (!event) return null;

  const eventMs = event === "sunrise" ? sunriseMs : sunsetMs;
  const Icon = event === "sunrise" ? Sunrise : Sunset;
  const eventLabel = t(locale, event === "sunrise" ? "phaseSunrise" : "phaseSunset");
  const timeLabel = formatClockTime(eventMs, locale, "");

  return (
    <LiveActivity
      id="ambient-phase"
      openLabel={t(locale, "phaseOpenDetails")}
      collapseLabel={t(locale, "dockCollapse")}
      pill={
        <>
          <span className="h-6 w-6 rounded-full bg-muted/60 flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-foreground/80" />
          </span>
          {timeLabel && (
            <span className="text-xs font-mono tabular-nums text-foreground/80">
              {timeLabel}
            </span>
          )}
        </>
      }
      title={
        <span className="flex items-center gap-2 text-xs font-mono text-muted-foreground min-w-0">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{eventLabel}</span>
          {timeLabel && (
            <span className="tabular-nums normal-case shrink-0">· {timeLabel}</span>
          )}
        </span>
      }
    >
      <div className="px-5 pb-3">
        <WeatherNow />
      </div>
    </LiveActivity>
  );
}
