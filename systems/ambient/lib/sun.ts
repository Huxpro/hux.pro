export type SunEvent = "sunrise" | "sunset";

export const DEFAULT_SUN_EVENT_WINDOW_MINUTES = 45;

function clampWindowMs(windowMinutes: number) {
  const m = Number.isFinite(windowMinutes) ? windowMinutes : DEFAULT_SUN_EVENT_WINDOW_MINUTES;
  return Math.max(5, Math.min(180, m)) * 60 * 1000;
}

export function getSunEventInVisibleWindow(params: {
  nowMs: number;
  sunriseMs?: number;
  sunsetMs?: number;
  windowMinutes?: number;
}): SunEvent | null {
  const { nowMs, sunriseMs, sunsetMs } = params;
  if (!Number.isFinite(nowMs)) return null;
  if (!Number.isFinite(sunriseMs) || !Number.isFinite(sunsetMs)) return null;

  const windowMs = clampWindowMs(params.windowMinutes ?? DEFAULT_SUN_EVENT_WINDOW_MINUTES);
  const sunriseStart = (sunriseMs as number) - windowMs;
  const sunriseEnd = (sunriseMs as number) + windowMs;
  const sunsetStart = (sunsetMs as number) - windowMs;
  const sunsetEnd = (sunsetMs as number) + windowMs;

  const inSunrise = nowMs >= sunriseStart && nowMs <= sunriseEnd;
  const inSunset = nowMs >= sunsetStart && nowMs <= sunsetEnd;

  if (inSunrise && !inSunset) return "sunrise";
  if (inSunset && !inSunrise) return "sunset";
  if (!inSunrise && !inSunset) return null;

  // Rare overlap (extreme latitudes / weird data): pick the closer event.
  const dSunrise = Math.abs(nowMs - (sunriseMs as number));
  const dSunset = Math.abs(nowMs - (sunsetMs as number));
  return dSunrise <= dSunset ? "sunrise" : "sunset";
}
