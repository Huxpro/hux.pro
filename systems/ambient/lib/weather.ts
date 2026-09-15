import type { Locale } from "@/services/locale";
import { clamp01 } from "./solar";

// =============================================================================
// Weather model
//
// Open-Meteo's `current` block gives us far more than a WMO code: cloud
// cover, precipitation rate, snowfall, wind. The wallpaper uses all of it so a
// "cloudy" day with 40% cover and a brooding 95% overcast read differently,
// drizzle is not a downpour, and wind actually leans the rain.
// =============================================================================

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "thunder";

export type WeatherIconKey =
  | "Sun"
  | "Cloud"
  | "CloudFog"
  | "CloudRain"
  | "CloudSnow"
  | "CloudLightning";

export type WeatherConditionInfo = {
  label: string;
  labelZh: string;
  icon: WeatherIconKey;
};

export const WEATHER_CONDITIONS: Record<WeatherCondition, WeatherConditionInfo> = {
  clear: { label: "Clear", labelZh: "晴朗", icon: "Sun" },
  cloudy: { label: "Cloudy", labelZh: "多云", icon: "Cloud" },
  fog: { label: "Fog", labelZh: "大雾", icon: "CloudFog" },
  rain: { label: "Rain", labelZh: "下雨", icon: "CloudRain" },
  snow: { label: "Snow", labelZh: "下雪", icon: "CloudSnow" },
  thunder: { label: "Thunder", labelZh: "雷暴", icon: "CloudLightning" },
};

export const WEATHER_CONDITION_LIST = Object.keys(
  WEATHER_CONDITIONS
) as WeatherCondition[];

export type PrecipitationType = "none" | "rain" | "snow";

export type NormalizedWeather = {
  temperatureC: number;
  apparentTemperatureC?: number;
  weatherCode: number;
  condition: WeatherCondition;
  isDay?: boolean;
  /** 0..1 fraction of sky covered by cloud. */
  cloudCover?: number;
  /** Precipitation rate, mm/h (rain + showers + melted snow). */
  precipitationMmH?: number;
  /** Snowfall rate, cm/h. */
  snowfallCmH?: number;
  precipitationType?: PrecipitationType;
  /** 0..1 normalised precipitation strength (derived; see derivePrecipIntensity). */
  precipitationIntensity?: number;
  /** Wind speed at 10m, km/h. */
  windSpeedKmh?: number;
  /** Wind gusts at 10m, km/h. */
  windGustsKmh?: number;
  /** Direction the wind blows *from*, degrees clockwise from north. */
  windDirectionDeg?: number;
  /** 0..1 relative humidity. */
  humidity?: number;
  sunriseMs?: number;
  sunsetMs?: number;
  updatedAt: number;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    is_day?: number;
    weather_code?: number;
    cloud_cover?: number;
    precipitation?: number;
    rain?: number;
    showers?: number;
    snowfall?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    wind_gusts_10m?: number;
  };
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
};

// The six conditions are deliberately coarse (they name the *mood*); the
// finer WMO distinctions — mainly clear vs overcast, drizzle vs downpour —
// survive as cloud cover and precipitation intensity, which is what the
// wallpaper actually renders.
export function normalizeWeatherCode(code: number): WeatherCondition {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  return "cloudy";
}

/** Precipitation strength hinted by the WMO code alone (light/moderate/heavy). */
export function precipIntensityFromCode(code: number): number {
  switch (code) {
    case 51:
    case 56:
    case 61:
    case 66:
    case 71:
    case 80:
    case 85:
      return 0.35;
    case 53:
    case 63:
    case 73:
    case 77:
    case 81:
      return 0.6;
    case 55:
    case 57:
    case 65:
    case 67:
    case 75:
    case 82:
    case 86:
      return 1;
    case 95:
      return 0.7;
    case 96:
    case 99:
      return 1;
    default:
      return 0;
  }
}

export function precipitationTypeForCondition(
  condition: WeatherCondition
): PrecipitationType {
  switch (condition) {
    case "rain":
    case "thunder":
      return "rain";
    case "snow":
      return "snow";
    default:
      return "none";
  }
}

/**
 * Normalise a measured precipitation rate to 0..1. Roughly: drizzle ≈ 0.15,
 * 2.5 mm/h (moderate rain) ≈ 0.55, 8 mm/h+ ≈ 1. Snow is measured in cm/h and
 * is visually "heavier" per unit, so it gets its own curve.
 */
export function derivePrecipIntensity(params: {
  condition: WeatherCondition;
  weatherCode: number;
  precipitationMmH?: number;
  snowfallCmH?: number;
}): number {
  const { condition, weatherCode, precipitationMmH, snowfallCmH } = params;
  const type = precipitationTypeForCondition(condition);
  if (type === "none") return 0;

  const hint = precipIntensityFromCode(weatherCode);

  let measured: number | undefined;
  if (type === "snow" && typeof snowfallCmH === "number") {
    measured = Math.min(1, Math.sqrt(Math.max(0, snowfallCmH) / 2));
  } else if (typeof precipitationMmH === "number") {
    measured = Math.min(1, Math.sqrt(Math.max(0, precipitationMmH) / 8));
  }

  if (measured === undefined) return hint;
  // The code says it's raining even if the last 15-minute bucket read 0, so
  // never drop below a gentle floor (lower for drizzle codes); otherwise trust
  // the measurement.
  const floor = weatherCode >= 51 && weatherCode <= 57 ? 0.15 : 0.25;
  return Math.max(floor, Math.max(measured, hint * 0.5));
}

export function getWeatherConditionLabel(
  condition: WeatherCondition,
  locale: Locale
): string {
  return locale === "zh"
    ? WEATHER_CONDITIONS[condition].labelZh
    : WEATHER_CONDITIONS[condition].label;
}

const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "is_day",
  "weather_code",
  "cloud_cover",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
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
    url.searchParams.set("current", CURRENT_FIELDS);
    url.searchParams.set("daily", "sunrise,sunset");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("timezone", "auto");

    const res = await fetch(url.toString(), {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`open-meteo: HTTP ${res.status}`);
    const data = (await res.json()) as OpenMeteoResponse;
    const cw = data.current;
    const temperatureC = num(cw?.temperature_2m);
    const weatherCode = num(cw?.weather_code);
    if (temperatureC === undefined || weatherCode === undefined) {
      throw new Error("open-meteo: missing current weather");
    }

    const condition = normalizeWeatherCode(weatherCode);
    const isDay = typeof cw?.is_day === "number" ? cw.is_day === 1 : undefined;

    const sunriseRaw = data.daily?.sunrise?.[0];
    const sunsetRaw = data.daily?.sunset?.[0];
    const sunriseMs =
      typeof sunriseRaw === "string" ? new Date(sunriseRaw).getTime() : undefined;
    const sunsetMs =
      typeof sunsetRaw === "string" ? new Date(sunsetRaw).getTime() : undefined;

    const cloudCoverPct = num(cw?.cloud_cover);
    const precipitationMmH = num(cw?.precipitation);
    const snowfallCmH = num(cw?.snowfall);
    const humidityPct = num(cw?.relative_humidity_2m);

    return {
      temperatureC,
      apparentTemperatureC: num(cw?.apparent_temperature),
      weatherCode,
      condition,
      isDay,
      cloudCover:
        cloudCoverPct === undefined
          ? undefined
          : clamp01(cloudCoverPct / 100),
      precipitationMmH,
      snowfallCmH,
      precipitationType: precipitationTypeForCondition(condition),
      precipitationIntensity: derivePrecipIntensity({
        condition,
        weatherCode,
        precipitationMmH,
        snowfallCmH,
      }),
      windSpeedKmh: num(cw?.wind_speed_10m),
      windGustsKmh: num(cw?.wind_gusts_10m),
      windDirectionDeg: num(cw?.wind_direction_10m),
      humidity:
        humidityPct === undefined
          ? undefined
          : clamp01(humidityPct / 100),
      sunriseMs: Number.isFinite(sunriseMs) ? sunriseMs : undefined,
      sunsetMs: Number.isFinite(sunsetMs) ? sunsetMs : undefined,
      updatedAt: Date.now(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
