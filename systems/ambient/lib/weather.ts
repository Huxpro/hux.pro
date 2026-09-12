import type { Locale } from "@/services/locale";

export type WeatherCondition =
  | "clear"
  | "partlyCloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";

export type WeatherIntensity = "light" | "moderate" | "heavy";

export type WeatherConditionInfo = {
  label: string;
  labelZh: string;
  icon:
    | "Sun"
    | "CloudSun"
    | "Cloud"
    | "CloudFog"
    | "CloudDrizzle"
    | "CloudRain"
    | "CloudSnow"
    | "CloudLightning";
};

export const WEATHER_CONDITIONS: Record<WeatherCondition, WeatherConditionInfo> =
  {
    clear: { label: "Clear", labelZh: "晴朗", icon: "Sun" },
    partlyCloudy: { label: "Partly Cloudy", labelZh: "少云", icon: "CloudSun" },
    cloudy: { label: "Cloudy", labelZh: "多云", icon: "Cloud" },
    fog: { label: "Fog", labelZh: "大雾", icon: "CloudFog" },
    drizzle: { label: "Drizzle", labelZh: "毛毛雨", icon: "CloudDrizzle" },
    rain: { label: "Rain", labelZh: "下雨", icon: "CloudRain" },
    snow: { label: "Snow", labelZh: "下雪", icon: "CloudSnow" },
    thunder: { label: "Thunder", labelZh: "雷暴", icon: "CloudLightning" },
  };

export const WEATHER_CONDITION_ORDER: WeatherCondition[] = [
  "clear",
  "partlyCloudy",
  "cloudy",
  "fog",
  "drizzle",
  "rain",
  "snow",
  "thunder",
];

export type NormalizedWeather = {
  temperatureC: number;
  weatherCode: number;
  condition: WeatherCondition;
  intensity: WeatherIntensity;
  /** 0–100, estimated from the condition when the API omits it. */
  cloudCover: number;
  /** Millimetres in the current observation window. */
  precipitationMm: number;
  windSpeedKmh: number;
  isDay?: boolean;
  sunriseMs?: number;
  sunsetMs?: number;
  updatedAt: number;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    weather_code?: number;
    is_day?: number;
    cloud_cover?: number;
    precipitation?: number;
    wind_speed_10m?: number;
  };
  current_weather?: {
    temperature?: number;
    weathercode?: number;
    is_day?: number;
    windspeed?: number;
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
};

const CONDITION_CLOUD_COVER: Record<WeatherCondition, number> = {
  clear: 8,
  partlyCloudy: 42,
  cloudy: 88,
  fog: 70,
  drizzle: 78,
  rain: 92,
  snow: 84,
  thunder: 96,
};

export function interpretWeatherCode(code: number): {
  condition: WeatherCondition;
  intensity: WeatherIntensity;
} {
  if (code === 0 || code === 1) return { condition: "clear", intensity: "light" };
  if (code === 2) return { condition: "partlyCloudy", intensity: "moderate" };
  if (code === 3) return { condition: "cloudy", intensity: "moderate" };
  if (code === 45 || code === 48) {
    return { condition: "fog", intensity: code === 48 ? "heavy" : "moderate" };
  }
  if (code >= 51 && code <= 57) {
    const intensity: WeatherIntensity =
      code === 51 || code === 56
        ? "light"
        : code === 53
          ? "moderate"
          : "heavy";
    return { condition: "drizzle", intensity };
  }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const intensity: WeatherIntensity =
      code === 61 || code === 66 || code === 80
        ? "light"
        : code === 63 || code === 81
          ? "moderate"
          : "heavy";
    return { condition: "rain", intensity };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    const intensity: WeatherIntensity =
      code === 71 || code === 77 || code === 85
        ? "light"
        : code === 73
          ? "moderate"
          : "heavy";
    return { condition: "snow", intensity };
  }
  if (code >= 95 && code <= 99) {
    return {
      condition: "thunder",
      intensity: code >= 96 ? "heavy" : "moderate",
    };
  }
  return { condition: "cloudy", intensity: "moderate" };
}

export function normalizeWeatherCode(code: number): WeatherCondition {
  return interpretWeatherCode(code).condition;
}

export function defaultCloudCover(condition: WeatherCondition): number {
  return CONDITION_CLOUD_COVER[condition];
}

export function intensityWeight(intensity: WeatherIntensity): number {
  if (intensity === "light") return 0.45;
  if (intensity === "heavy") return 1;
  return 0.72;
}

export function getWeatherConditionLabel(
  condition: WeatherCondition,
  locale: Locale
): string {
  return locale === "zh"
    ? WEATHER_CONDITIONS[condition].labelZh
    : WEATHER_CONDITIONS[condition].label;
}

function parseIsoMs(value: string | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
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
    url.searchParams.set(
      "current",
      "temperature_2m,weather_code,is_day,cloud_cover,precipitation,wind_speed_10m"
    );
    url.searchParams.set("current_weather", "true");
    url.searchParams.set("daily", "sunrise,sunset");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`open-meteo: HTTP ${res.status}`);
    const data = (await res.json()) as OpenMeteoResponse;
    const current = data.current;
    const legacy = data.current_weather;

    const temperatureC =
      typeof current?.temperature_2m === "number"
        ? current.temperature_2m
        : legacy?.temperature;
    const weatherCode =
      typeof current?.weather_code === "number"
        ? current.weather_code
        : legacy?.weathercode;

    if (typeof temperatureC !== "number" || typeof weatherCode !== "number") {
      throw new Error("open-meteo: missing current weather");
    }

    const { condition, intensity } = interpretWeatherCode(weatherCode);
    const isDayRaw = current?.is_day ?? legacy?.is_day;
    const isDay = typeof isDayRaw === "number" ? isDayRaw === 1 : undefined;

    const cloudCover =
      typeof current?.cloud_cover === "number"
        ? Math.min(100, Math.max(0, current.cloud_cover))
        : defaultCloudCover(condition);

    const precipitationMm =
      typeof current?.precipitation === "number"
        ? Math.max(0, current.precipitation)
        : 0;

    const windSpeedKmh =
      typeof current?.wind_speed_10m === "number"
        ? Math.max(0, current.wind_speed_10m)
        : typeof legacy?.windspeed === "number"
          ? Math.max(0, legacy.windspeed)
          : 8;

    return {
      temperatureC,
      weatherCode,
      condition,
      intensity,
      cloudCover,
      precipitationMm,
      windSpeedKmh,
      isDay,
      sunriseMs: parseIsoMs(data.daily?.sunrise?.[0]),
      sunsetMs: parseIsoMs(data.daily?.sunset?.[0]),
      updatedAt: Date.now(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
