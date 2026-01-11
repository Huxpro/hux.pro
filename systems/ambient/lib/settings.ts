import type { LocationMode } from "./location";
import {
  type FormFactor,
  getRouteGradientDefault,
  matchRoutePattern,
} from "./route-config";

// =============================================================================
// Ambient Settings
// =============================================================================

export type RouteGradientPreferences = Record<string, boolean>;

export interface AmbientSettings {
  locationMode: LocationMode;
  routeGradientPreferences: RouteGradientPreferences;
}

const SETTINGS_KEY = "hux_ambient_settings";

function getDefaultSettings(): AmbientSettings {
  return {
    locationMode: "ip",
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

export function isGradientEnabledForPath(
  pathname: string,
  settings: AmbientSettings,
  formFactor: FormFactor = "desktop"
): boolean {
  const pattern = matchRoutePattern(pathname);
  const userPref = settings.routeGradientPreferences[pattern];
  if (userPref !== undefined) return userPref;
  return getRouteGradientDefault(pattern, formFactor);
}
