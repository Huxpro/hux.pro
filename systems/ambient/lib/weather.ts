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
  /** 0..1 cover by layer: low (fog–2 km), mid (2–6 km), high (above 6 km). */
  cloudCoverLow?: number;
  cloudCoverMid?: number;
  cloudCoverHigh?: number;
  /** Horizontal visibility, metres. */
  visibilityM?: number;
  /** Dew point at 2 m, °C. With the temperature, how close the air is to haze. */
  dewPointC?: number;
  /** Convective available potential energy, J/kg — how violently air can rise. */
  capeJkg?: number;
  /** Liquid precipitation rate, mm/h (rain + showers). */
  rainMmH?: number;
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
  /** Start of the model interval the `current` block describes (epoch ms). */
  observedAtMs?: number;
  /** Length of that interval, seconds — 900 where Open-Meteo has 15-minutely data. */
  intervalS?: number;
  updatedAt: number;
};

// Requested with `timeformat=unixtime`: every time is epoch seconds. The ISO
// default is the *location's* wall clock with no offset, which `new Date()`
// reads in the *browser's* zone — so a visitor whose IP lands a timezone away
// got a sunrise hours off, and a sky, phase and greeting to match.
type OpenMeteoResponse = {
  current?: {
    time?: number;
    interval?: number;
    temperature_2m?: number;
    dew_point_2m?: number;
    cloud_cover_low?: number;
    cloud_cover_mid?: number;
    cloud_cover_high?: number;
    visibility?: number;
    cape?: number;
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
    sunrise?: number[];
    sunset?: number[];
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

/** Below this, a measured rate is model noise rather than something falling. */
const MEASURED_PRECIP_MIN_MMH = 0.1;

/**
 * What is actually falling. The WMO code names the mood, but the measurements
 * say what reaches the ground: an "overcast" hour with 0.4 mm/h of rain in it
 * is raining, and a sleety mix is drawn as whichever phase carries more water.
 *
 * The code keeps the last word in two places. A code that *says* rain or snow
 * is believed even when the last 15-minute bucket read zero (showers are
 * patchy). And only a "cloudy" code is upgraded by a measurement — not
 * "clear", where it would be a model disagreeing with itself, and not "fog",
 * whose drizzle is the fog itself (and a fog scene carrying precipitation would
 * arm the rain's gust egg alongside the fog's wipe; see lib/wipe.ts).
 */
export function derivePrecipitationType(params: {
  condition: WeatherCondition;
  rainMmH?: number;
  snowfallCmH?: number;
  temperatureC?: number;
}): PrecipitationType {
  const { condition, rainMmH, snowfallCmH, temperatureC } = params;
  const byCode = precipitationTypeForCondition(condition);
  if (condition === "thunder") return "rain";
  if (condition !== "cloudy" && byCode === "none") return "none";

  // Open-Meteo: 7 cm of snow ≈ 10 mm of water.
  const snowWater = Math.max(0, snowfallCmH ?? 0) * (10 / 7);
  const rain = Math.max(0, rainMmH ?? 0);
  if (rain + snowWater >= MEASURED_PRECIP_MIN_MMH) {
    if (snowWater === rain) {
      return typeof temperatureC === "number" && temperatureC <= 0.5 ? "snow" : "rain";
    }
    return snowWater > rain ? "snow" : "rain";
  }
  return byCode;
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
  /** What is falling, when already derived from the measurements. */
  type?: PrecipitationType;
}): number {
  const { condition, weatherCode, precipitationMmH, snowfallCmH } = params;
  const byCode = precipitationTypeForCondition(condition);
  const type = params.type ?? byCode;
  if (type === "none") return 0;

  const hint = precipIntensityFromCode(weatherCode);

  let measured: number | undefined;
  if (type === "snow" && typeof snowfallCmH === "number") {
    measured = Math.min(1, Math.sqrt(Math.max(0, snowfallCmH) / 2));
  } else if (typeof precipitationMmH === "number") {
    measured = Math.min(1, Math.sqrt(Math.max(0, precipitationMmH) / 8));
  }

  if (measured === undefined) return hint;
  // Falling although the code did not say so (see derivePrecipitationType):
  // the measurement is all there is to go on.
  if (byCode === "none") return measured;
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
  "dew_point_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "is_day",
  "weather_code",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",
  "cape",
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
    url.searchParams.set("timeformat", "unixtime");

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

    const sunriseS = num(data.daily?.sunrise?.[0]);
    const sunsetS = num(data.daily?.sunset?.[0]);
    const observedS = num(cw?.time);

    const cloudCoverPct = num(cw?.cloud_cover);
    const precipitationMmH = num(cw?.precipitation);
    const snowfallCmH = num(cw?.snowfall);
    const humidityPct = num(cw?.relative_humidity_2m);
    const rainPart = num(cw?.rain);
    const showersPart = num(cw?.showers);
    const rainMmH =
      rainPart === undefined && showersPart === undefined
        ? undefined
        : (rainPart ?? 0) + (showersPart ?? 0);
    const fraction = (pct: number | undefined) =>
      pct === undefined ? undefined : clamp01(pct / 100);
    const precipitationType = derivePrecipitationType({
      condition,
      rainMmH,
      snowfallCmH,
      temperatureC,
    });

    return {
      temperatureC,
      apparentTemperatureC: num(cw?.apparent_temperature),
      weatherCode,
      condition,
      isDay,
      cloudCover: fraction(cloudCoverPct),
      cloudCoverLow: fraction(num(cw?.cloud_cover_low)),
      cloudCoverMid: fraction(num(cw?.cloud_cover_mid)),
      cloudCoverHigh: fraction(num(cw?.cloud_cover_high)),
      visibilityM: num(cw?.visibility),
      dewPointC: num(cw?.dew_point_2m),
      capeJkg: num(cw?.cape),
      precipitationMmH,
      rainMmH,
      snowfallCmH,
      precipitationType,
      precipitationIntensity: derivePrecipIntensity({
        condition,
        weatherCode,
        precipitationMmH,
        snowfallCmH,
        type: precipitationType,
      }),
      windSpeedKmh: num(cw?.wind_speed_10m),
      windGustsKmh: num(cw?.wind_gusts_10m),
      windDirectionDeg: num(cw?.wind_direction_10m),
      humidity:
        humidityPct === undefined
          ? undefined
          : clamp01(humidityPct / 100),
      sunriseMs: sunriseS === undefined ? undefined : sunriseS * 1000,
      sunsetMs: sunsetS === undefined ? undefined : sunsetS * 1000,
      observedAtMs: observedS === undefined ? undefined : observedS * 1000,
      intervalS: num(cw?.interval),
      updatedAt: Date.now(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
