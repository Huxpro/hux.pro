"use client";

import { t, useLocale } from "@/services";
import { LiveActivity } from "@/systems/dock";
import { Sunrise, Sunset } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { getUpcomingSunEvent } from "../lib/notification";
import { useAmbientTime, useWeather } from "../provider";
import { WeatherNow } from "./weather-now";

// ---------------------------------------------------------------------------
// Ambient Phase Activity — sun-event notification.
//
// A heads-up that the ambient phase is about to change to sunrise/sunset. It
// plugs into the shared Dock exactly like the music player: a collapsed pill
// (sun icon + exact time) that unfolds into the weather widget body.
//
// Visibility (see lib/notification.ts): the lead-up to the event through the
// end of its ±window. The devtool time override also surfaces it so the
// sunrise/sunset states are demoable at any hour.
// ---------------------------------------------------------------------------

function formatTime(ms: number, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
}

export function AmbientPhaseActivity() {
  const { locale } = useLocale();
  const { weather } = useWeather();
  const { nowMs, phase } = useAmbientTime();

  const sunriseMs = weather?.sunriseMs;
  const sunsetMs = weather?.sunsetMs;

  // Natural trigger: inside the notification window of an upcoming sun event.
  const upcoming = getUpcomingSunEvent({ nowMs, sunriseMs, sunsetMs });
  // Devtool hook: a forced sunrise/sunset phase also surfaces the notification.
  const overridden = phase === "sunrise" || phase === "sunset" ? phase : null;

  const event = upcoming?.event ?? overridden;
  if (!event) return null;

  const eventMs = event === "sunrise" ? sunriseMs : sunsetMs;
  const Icon = event === "sunrise" ? Sunrise : Sunset;
  const eventLabel = t(locale, event === "sunrise" ? "phaseSunrise" : "phaseSunset");
  const timeLabel = typeof eventMs === "number" ? formatTime(eventMs, locale) : null;

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
        <span className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground min-w-0">
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
