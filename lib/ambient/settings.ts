import type { LocationMode } from "./location";

// =============================================================================
// Ambient Settings
// =============================================================================
// User preferences for the ambient system. These are stored separately from
// React Query's cache because:
//
// 1. They're USER PREFERENCES, not server data
// 2. They affect query behavior (locationMode determines which API to call)
// 3. They need to be available synchronously on mount
// =============================================================================

export interface AmbientSettings {
  /** Location resolution mode: "ip" (default, no permission) or "accurate" (GPS) */
  locationMode: LocationMode;
  /** Whether to show weather-based gradient backgrounds */
  weatherGradientEnabled: boolean;
  /** Whether to show the debug FAB (auto-enabled in development) */
  debugFabEnabled: boolean;
}

const SETTINGS_KEY = "hux_ambient_settings";

/**
 * Get default settings based on environment
 */
function getDefaultSettings(): AmbientSettings {
  const isDev = process.env.NODE_ENV === "development";
  return {
    locationMode: "ip",
    weatherGradientEnabled: true,
    debugFabEnabled: isDev,
  };
}

/**
 * Read ambient settings from localStorage
 * Returns defaults if not found or on SSR
 */
export function getAmbientSettings(): AmbientSettings {
  if (typeof window === "undefined") {
    return getDefaultSettings();
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return getDefaultSettings();
    }

    const parsed = JSON.parse(stored) as Partial<AmbientSettings> & {
      // Backwards compat for old key names
      weatherDebugEnabled?: boolean;
      debugPanelEnabled?: boolean;
    };

    const defaults = getDefaultSettings();

    return {
      locationMode:
        parsed.locationMode === "accurate" ? "accurate" : defaults.locationMode,
      weatherGradientEnabled:
        parsed.weatherGradientEnabled ?? defaults.weatherGradientEnabled,
      debugFabEnabled:
        parsed.debugFabEnabled ??
        parsed.debugPanelEnabled ??
        parsed.weatherDebugEnabled ??
        defaults.debugFabEnabled,
    };
  } catch {
    return getDefaultSettings();
  }
}

/**
 * Persist ambient settings to localStorage
 */
export function setAmbientSettings(settings: AmbientSettings): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors (quota exceeded, etc.)
  }
}

/**
 * Update a single setting while preserving others
 */
export function updateAmbientSetting<K extends keyof AmbientSettings>(
  key: K,
  value: AmbientSettings[K]
): AmbientSettings {
  const current = getAmbientSettings();
  const updated = { ...current, [key]: value };
  setAmbientSettings(updated);
  return updated;
}
