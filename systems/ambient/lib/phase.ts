import type { Locale } from "@/services/locale";
import { getTimeOfDay, type TimeOfDay } from "./greeting";
import {
  DEFAULT_SUN_EVENT_WINDOW_MINUTES,
  getSunEventInVisibleWindow,
} from "./sun";

export type AmbientPhase =
  | "sunrise"
  | "morning"
  | "afternoon"
  | "evening"
  | "sunset"
  | "night";

/** The six phases, in both languages — the site's own names for them. */
const AMBIENT_PHASE_LABEL: Record<Locale, Record<AmbientPhase, string>> = {
  en: {
    sunrise: "Sunrise",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    sunset: "Sunset",
    night: "Night",
  },
  zh: {
    sunrise: "日出",
    morning: "早晨",
    afternoon: "下午",
    evening: "傍晚",
    sunset: "日落",
    night: "夜晚",
  },
};

export function getAmbientPhaseLabel(phase: AmbientPhase, locale: Locale): string {
  return AMBIENT_PHASE_LABEL[locale][phase];
}

/**
 * Computes the time of day based on actual sunrise/sunset times.
 *
 * Boundaries:
 * - Night: Before sunrise window starts
 * - Morning: After sunrise window ends until noon (12:00)
 * - Afternoon: From noon until sunset window starts
 * - Evening: After sunset window ends until 3 hours post-sunset
 * - Night: After evening ends
 *
 * Falls back to fixed time estimates when sun data is unavailable.
 */
function getTimeOfDayFromSunData(params: {
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
  windowMinutes?: number;
}): TimeOfDay {
  const { nowMs, sunriseMs, sunsetMs } = params;

  // Fallback to fixed time when sun data is unavailable
  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) {
    return getTimeOfDay(nowMs);
  }

  const windowMs =
    (params.windowMinutes ?? DEFAULT_SUN_EVENT_WINDOW_MINUTES) * 60 * 1000;

  const sunriseEnd = (sunriseMs as number) + windowMs;
  const sunsetStart = (sunsetMs as number) - windowMs;
  const sunsetEnd = (sunsetMs as number) + windowMs;

  // Evening lasts for 3 hours after sunset ends
  const eveningDurationMs = 3 * 60 * 60 * 1000;
  const eveningEnd = sunsetEnd + eveningDurationMs;

  // Get noon time for today
  const date = new Date(nowMs);
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  const noonMs = noon.getTime();

  // Determine phase based on sun-aware boundaries
  if (nowMs >= sunriseEnd && nowMs < noonMs) {
    return "morning";
  }
  if (nowMs >= noonMs && nowMs < sunsetStart) {
    return "afternoon";
  }
  if (nowMs >= sunsetEnd && nowMs < eveningEnd) {
    return "evening";
  }
  // Night: before sunrise window or after evening ends
  return "night";
}

export function deriveAmbientPhase(params: {
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
}): AmbientPhase {
  const sunEvent = getSunEventInVisibleWindow({
    nowMs: params.nowMs,
    sunriseMs: params.sunriseMs,
    sunsetMs: params.sunsetMs,
  });
  if (sunEvent === "sunrise") return "sunrise";
  if (sunEvent === "sunset") return "sunset";

  return getTimeOfDayFromSunData({
    nowMs: params.nowMs,
    sunriseMs: params.sunriseMs,
    sunsetMs: params.sunsetMs,
  });
}
