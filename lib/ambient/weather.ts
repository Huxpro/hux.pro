export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "thunder";

export type WeatherConditionInfo = {
  label: string;
  labelZh: string;
  /**
   * Icon key used by UI components (see `components/ambient/weather-icon.tsx`).
   * Keep this as data so UIs can map over conditions without hardcoding switches everywhere.
   */
  icon:
    | "Sun"
    | "Cloud"
    | "CloudFog"
    | "CloudRain"
    | "CloudSnow"
    | "CloudLightning";
};

/**
 * Canonical condition metadata (6 only).
 * - Used by: Weather widget + Debug panel + any future ambient modules.
 * - Note: We intentionally keep labels here (instead of i18n keys) so the debug UI can
 *   render condition lists without expanding translation dictionaries.
 */
export const WEATHER_CONDITIONS: Record<WeatherCondition, WeatherConditionInfo> = {
  clear: { label: "Clear", labelZh: "晴朗", icon: "Sun" },
  cloudy: { label: "Cloudy", labelZh: "多云", icon: "Cloud" },
  fog: { label: "Fog", labelZh: "大雾", icon: "CloudFog" },
  rain: { label: "Rain", labelZh: "下雨", icon: "CloudRain" },
  snow: { label: "Snow", labelZh: "下雪", icon: "CloudSnow" },
  thunder: { label: "Thunder", labelZh: "雷暴", icon: "CloudLightning" },
};

export type NormalizedWeather = {
  temperatureC: number;
  weatherCode: number;
  condition: WeatherCondition;
  isDay?: boolean;
  /**
   * Sunrise/sunset timestamps (epoch ms) for the user's local day.
   * Sourced from Open-Meteo daily forecast with `timezone=auto`.
   */
  sunriseMs?: number;
  sunsetMs?: number;
  updatedAt: number; // epoch ms
};

type OpenMeteoResponse = {
  current_weather?: {
    temperature?: number;
    weathercode?: number;
    is_day?: number; // 1/0
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
};

export function normalizeWeatherCode(code: number): WeatherCondition {
  // WMO weather interpretation codes (subset, grouped)
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  // Fallback: treat unknown as cloudy (neutral mood)
  return "cloudy";
}

export function getWeatherConditionLabel(
  condition: WeatherCondition,
  locale: "en" | "zh"
): string {
  return locale === "zh"
    ? WEATHER_CONDITIONS[condition].labelZh
    : WEATHER_CONDITIONS[condition].label;
}

export async function fetchCurrentWeather(
  lat: number,
  lon: number,
  options?: { timeoutMs?: number }
): Promise<NormalizedWeather> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lon));
    url.searchParams.set("current_weather", "true");
    // Sunrise/sunset: used by ambient greeting + special gradients.
    url.searchParams.set("daily", "sunrise,sunset");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`open-meteo: HTTP ${res.status}`);
    const data = (await res.json()) as OpenMeteoResponse;
    const cw = data.current_weather;
    const temperatureC = cw?.temperature;
    const weatherCode = cw?.weathercode;
    if (typeof temperatureC !== "number" || typeof weatherCode !== "number") {
      throw new Error("open-meteo: missing current weather");
    }

    const isDay =
      typeof cw?.is_day === "number" ? cw.is_day === 1 : undefined;

    const sunriseRaw = data.daily?.sunrise?.[0];
    const sunsetRaw = data.daily?.sunset?.[0];
    const sunriseMs =
      typeof sunriseRaw === "string" ? new Date(sunriseRaw).getTime() : undefined;
    const sunsetMs =
      typeof sunsetRaw === "string" ? new Date(sunsetRaw).getTime() : undefined;

    return {
      temperatureC,
      weatherCode,
      condition: normalizeWeatherCode(weatherCode),
      isDay,
      sunriseMs: Number.isFinite(sunriseMs) ? sunriseMs : undefined,
      sunsetMs: Number.isFinite(sunsetMs) ? sunsetMs : undefined,
      updatedAt: Date.now(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
