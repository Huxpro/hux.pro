import type { LocationMode } from "./location";
import { type FormFactor, matchRoutePattern } from "./route-config";

// =============================================================================
// Ambient Settings
// =============================================================================

export type RouteGradientPreferences = Record<string, boolean>;
export type WeatherGradientMode = "adaptive" | "off" | "widget";

export interface AmbientSettings {
  locationMode: LocationMode;
  weatherGradientMode: WeatherGradientMode;
  routeGradientPreferences: RouteGradientPreferences;
}

const SETTINGS_KEY = "hux_ambient_settings";

function getDefaultSettings(): AmbientSettings {
  return {
    locationMode: "ip",
    weatherGradientMode: "adaptive",
    routeGradientPreferences: {},
  };
}

export function getAmbientSettings(): AmbientSettings {
  if (typeof window === "undefined") {
    return getDefaultSettings();
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return getDefaultSettings();
    }

    const parsed = JSON.parse(stored) as Partial<AmbientSettings>;
    const defaults = getDefaultSettings();

    return {
      locationMode:
        parsed.locationMode === "accurate" ? "accurate" : defaults.locationMode,
      weatherGradientMode:
        parsed.weatherGradientMode === "off" ||
        parsed.weatherGradientMode === "widget" ||
        parsed.weatherGradientMode === "adaptive"
          ? parsed.weatherGradientMode
          : defaults.weatherGradientMode,
      routeGradientPreferences:
        parsed.routeGradientPreferences ?? defaults.routeGradientPreferences,
    };
  } catch {
    return getDefaultSettings();
  }
}

export function setAmbientSettings(settings: AmbientSettings): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function resolveGlobalSurfaceGradientEnabled(
  mode: WeatherGradientMode,
  formFactor: FormFactor = "desktop"
): boolean {
  if (mode !== "adaptive") return false;
  return formFactor === "desktop";
}

export function getRouteGradientOverrideForPath(
  pathname: string,
  settings: AmbientSettings
): boolean | undefined {
  const pattern = matchRoutePattern(pathname);
  return settings.routeGradientPreferences[pattern];
}
