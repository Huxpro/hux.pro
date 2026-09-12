/**
 * Standalone checks for WMO weather mapping (kept free of TS path imports
 * so it can run with `node --experimental-strip-types`).
 */
type WeatherCondition =
  | "clear"
  | "partlyCloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunder";
type WeatherIntensity = "light" | "moderate" | "heavy";

function interpretWeatherCode(code: number): {
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
      code === 51 || code === 56 ? "light" : code === 53 ? "moderate" : "heavy";
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
    return { condition: "thunder", intensity: code >= 96 ? "heavy" : "moderate" };
  }
  return { condition: "cloudy", intensity: "moderate" };
}

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const cases: Array<[number, WeatherCondition, WeatherIntensity]> = [
  [0, "clear", "light"],
  [1, "clear", "light"],
  [2, "partlyCloudy", "moderate"],
  [3, "cloudy", "moderate"],
  [45, "fog", "moderate"],
  [51, "drizzle", "light"],
  [55, "drizzle", "heavy"],
  [61, "rain", "light"],
  [65, "rain", "heavy"],
  [71, "snow", "light"],
  [75, "snow", "heavy"],
  [85, "snow", "light"],
  [86, "snow", "heavy"],
  [95, "thunder", "moderate"],
  [99, "thunder", "heavy"],
];

for (const [code, condition, intensity] of cases) {
  const parsed = interpretWeatherCode(code);
  assert(
    parsed.condition === condition && parsed.intensity === intensity,
    `code ${code}: expected ${condition}/${intensity}, got ${parsed.condition}/${parsed.intensity}`
  );
}

console.log(`ambient weather mapping: ${cases.length} codes passed`);
