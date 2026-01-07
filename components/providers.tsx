"use client";

import {
  type Locale,
  defaultLocale,
  getStoredLocale,
  setStoredLocale,
} from "@/lib/i18n";
import type { LocationMode, ResolvedLocation } from "@/lib/ambient/location";
import { fetchIpLocation, requestAccurateLocation } from "@/lib/ambient/location";
import type { NormalizedWeather } from "@/lib/ambient/weather";
import { fetchCurrentWeather } from "@/lib/ambient/weather";
import { getStoredWithExpiry, setStoredWithExpiry } from "@/lib/ambient/storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// Theme context
interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within Providers");
  return context;
}

// Locale context
interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within Providers");
  return context;
}

// Command palette context
interface CommandPaletteContextType {
  isOpen: boolean;
  isActionMode: boolean;
  open: (actionMode?: boolean) => void;
  close: () => void;
  toggle: () => void;
  setActionMode: (mode: boolean) => void;
}

const CommandPaletteContext = createContext<
  CommandPaletteContextType | undefined
>(undefined);

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context)
    throw new Error("useCommandPalette must be used within Providers");
  return context;
}

// Ambient context (location + weather)
export type AmbientSettings = {
  locationMode: LocationMode;
  weatherEnabled: boolean;
  weatherGradientEnabled: boolean;
  debugFabEnabled: boolean;
};

export type AmbientState = {
  settings: AmbientSettings;
  location: ResolvedLocation | null;
  weather: NormalizedWeather | null;
  debugWeatherOverride: Pick<NormalizedWeather, "condition" | "isDay"> | null;
  debugWeatherOverrideEnabled: boolean;
  debugPanelOpen: boolean;
  hasAttemptedLocation: boolean;
  hasAttemptedWeather: boolean;
  isResolvingLocation: boolean;
  isFetchingWeather: boolean;
  error: string | null;
};

export type AmbientActions = {
  setLocationMode: (mode: LocationMode) => void;
  setWeatherGradientEnabled: (enabled: boolean) => void;
  setDebugFabEnabled: (enabled: boolean) => void;
  setDebugPanelOpen: (open: boolean) => void;
  setDebugWeatherOverride: (
    override: Pick<NormalizedWeather, "condition" | "isDay"> | null
  ) => void;
  setDebugWeatherOverrideEnabled: (enabled: boolean) => void;
  refresh: () => void;
  requestAccurateLocation: () => Promise<boolean>;
};

type AmbientContextType = AmbientState & AmbientActions;

const AmbientContext = createContext<AmbientContextType | undefined>(undefined);

export function useAmbient() {
  const context = useContext(AmbientContext);
  if (!context) throw new Error("useAmbient must be used within Providers");
  return context;
}

// Visitor context for tracking visits and last read content
export interface LastVisitedItem {
  slug: string;
  title: string;
  type: "blog" | "talk";
}

interface VisitorContextType {
  lastVisited: LastVisitedItem | null;
  lastVisitTime: number | null;
  isReturningVisitor: boolean;
  daysSinceLastVisit: number | null;
  recordVisit: (item: LastVisitedItem) => void;
  recordPageView: () => void;
}

const VisitorContext = createContext<VisitorContextType | undefined>(undefined);

export function useVisitor() {
  const context = useContext(VisitorContext);
  if (!context) throw new Error("useVisitor must be used within Providers");
  return context;
}

const VISITOR_STORAGE_KEY = "hux_visitor";
const AMBIENT_SETTINGS_KEY = "hux_ambient_settings";
const AMBIENT_IP_LOCATION_CACHE_KEY = "hux_ambient_ip_location_cache";
const AMBIENT_WEATHER_CACHE_KEY = "hux_ambient_weather_cache";

const IP_LOCATION_TTL_MS = 24 * 60 * 60 * 1000;
const WEATHER_TTL_MS = 45 * 60 * 1000;

function getWeatherCacheKey(lat: number, lon: number): string {
  // Round to ~1km resolution to avoid cache fragmentation while still being “correct enough”.
  return `${AMBIENT_WEATHER_CACHE_KEY}:${lat.toFixed(2)},${lon.toFixed(2)}`;
}

interface VisitorStorage {
  lastVisited: LastVisitedItem | null;
  lastVisitTime: number;
}

function getVisitorStorage(): VisitorStorage | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(VISITOR_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setVisitorStorage(data: VisitorStorage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(VISITOR_STORAGE_KEY, JSON.stringify(data));
}

function getAmbientSettings(): AmbientSettings {
  const devDefault = process.env.NODE_ENV === "development";
  if (typeof window === "undefined") {
    return {
      locationMode: "ip",
      weatherEnabled: true,
      weatherGradientEnabled: true,
      debugFabEnabled: devDefault,
    };
  }
  try {
    const stored = localStorage.getItem(AMBIENT_SETTINGS_KEY);
    if (!stored) {
      return {
        locationMode: "ip",
        weatherEnabled: true,
        weatherGradientEnabled: true,
        debugFabEnabled: devDefault,
      };
    }
    const parsed = JSON.parse(stored) as Partial<AmbientSettings> & {
      // Backwards compat (previous key)
      weatherDebugEnabled?: boolean;
      debugPanelEnabled?: boolean;
    };
    const locationMode: LocationMode =
      parsed.locationMode === "accurate" ? "accurate" : "ip";
    const weatherEnabled = parsed.weatherEnabled !== false;
    const weatherGradientEnabled = parsed.weatherGradientEnabled !== false;
    const debugFabEnabled =
      parsed.debugFabEnabled === true ||
      parsed.debugPanelEnabled === true ||
      parsed.weatherDebugEnabled === true;
    return { locationMode, weatherEnabled, weatherGradientEnabled, debugFabEnabled };
  } catch {
    return {
      locationMode: "ip",
      weatherEnabled: true,
      weatherGradientEnabled: true,
      debugFabEnabled: devDefault,
    };
  }
}

function setAmbientSettings(settings: AmbientSettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AMBIENT_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isActionMode, setIsActionMode] = useState(false);
  const [lastVisited, setLastVisited] = useState<LastVisitedItem | null>(null);
  const [lastVisitTime, setLastVisitTime] = useState<number | null>(null);
  const [isReturningVisitor, setIsReturningVisitor] = useState(false);
  const [ambientSettings, setAmbientSettingsState] = useState<AmbientSettings>({
    locationMode: "ip",
    weatherEnabled: true,
    weatherGradientEnabled: true,
    debugFabEnabled: false,
  });
  const [ambientLocation, setAmbientLocation] = useState<ResolvedLocation | null>(
    null
  );
  const [ambientWeather, setAmbientWeather] = useState<NormalizedWeather | null>(
    null
  );
  const [debugWeatherOverride, setDebugWeatherOverride] = useState<
    Pick<NormalizedWeather, "condition" | "isDay"> | null
  >(null);
  const [debugWeatherOverrideEnabled, setDebugWeatherOverrideEnabled] =
    useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [hasAttemptedLocation, setHasAttemptedLocation] = useState(false);
  const [hasAttemptedWeather, setHasAttemptedWeather] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState(false);
  const [ambientError, setAmbientError] = useState<string | null>(null);

  // Initialize theme from system preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      setTheme(mediaQuery.matches ? "dark" : "light");
    };
    // Set initial theme
    updateTheme();
    // Listen for system theme changes
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, []);

  // Apply theme class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Initialize locale
  useEffect(() => {
    setTimeout(() => setLocaleState(getStoredLocale()), 0);
  }, []);

  // Initialize ambient settings and cache
  useEffect(() => {
    const settings = getAmbientSettings();
    setAmbientSettingsState(settings);
    const cachedIp = getStoredWithExpiry<ResolvedLocation>(AMBIENT_IP_LOCATION_CACHE_KEY);
    if (cachedIp) setAmbientLocation(cachedIp);
    if (cachedIp) {
      const cachedWeather = getStoredWithExpiry<NormalizedWeather>(
        getWeatherCacheKey(cachedIp.lat, cachedIp.lon)
      );
      if (cachedWeather) setAmbientWeather(cachedWeather);
    }
  }, []);

  // Initialize visitor context from localStorage
  useEffect(() => {
    const stored = getVisitorStorage();
    if (stored) {
      setLastVisited(stored.lastVisited);
      setLastVisitTime(stored.lastVisitTime);
      setIsReturningVisitor(true);
    }
  }, []);

  // Calculate days since last visit
  const daysSinceLastVisit = lastVisitTime
    ? Math.floor((Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24))
    : null;

  // Record a content visit (blog post or talk)
  const recordVisit = useCallback((item: LastVisitedItem) => {
    setLastVisited(item);
    const now = Date.now();
    setLastVisitTime(now);
    setVisitorStorage({ lastVisited: item, lastVisitTime: now });
  }, []);

  // Record a page view (updates last visit time)
  const recordPageView = useCallback(() => {
    const now = Date.now();
    const stored = getVisitorStorage();
    setVisitorStorage({
      lastVisited: stored?.lastVisited || null,
      lastVisitTime: now,
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
  }, []);

  const persistAmbientSettings = useCallback((next: AmbientSettings) => {
    setAmbientSettingsState(next);
    setAmbientSettings(next);
  }, []);

  // Clear in-memory data so dependent UI (e.g. WeatherWidget) can show a spinner
  // and refetch. LocalStorage TTL caches remain intact.
  const resetWeatherDataForReload = useCallback(() => {
    setAmbientError(null);
    setAmbientWeather(null);
    setHasAttemptedWeather(false);
  }, []);

  const setLocationMode = useCallback(
    (mode: LocationMode) => {
      if (mode === ambientSettings.locationMode) return;
      // Show “reload” affordance when switching location source (IP ↔ Accurate)
      resetWeatherDataForReload();
      // Location will be re-resolved by the ambient effect
      setAmbientLocation(null);
      persistAmbientSettings({ ...ambientSettings, locationMode: mode });
    },
    [ambientSettings, persistAmbientSettings, resetWeatherDataForReload]
  );

  const setWeatherGradientEnabled = useCallback(
    (enabled: boolean) => {
      persistAmbientSettings({ ...ambientSettings, weatherGradientEnabled: enabled });
    },
    [ambientSettings, persistAmbientSettings]
  );

  const setDebugFabEnabled = useCallback(
    (enabled: boolean) => {
      persistAmbientSettings({ ...ambientSettings, debugFabEnabled: enabled });
      if (!enabled) setDebugPanelOpen(false);
    },
    [ambientSettings, persistAmbientSettings]
  );

  const refresh = useCallback(() => {
    // force re-fetch by clearing in-memory state; TTL caches will be overwritten
    setAmbientLocation(null);
    setAmbientWeather(null);
  }, []);

  const resolveLocation = useCallback(
    async (mode: LocationMode): Promise<ResolvedLocation | null> => {
      setHasAttemptedLocation(true);
      setAmbientError(null);
      setIsResolvingLocation(true);
      try {
        if (mode === "accurate") {
          try {
            const loc = await requestAccurateLocation();
            setAmbientLocation(loc);
            return loc;
          } catch {
            // Permission denied / unavailable → fallback to IP
            // Keep settings honest: if accurate fails, switch back to IP.
            persistAmbientSettings({ ...ambientSettings, locationMode: "ip" });
            const ipLoc =
              getStoredWithExpiry<ResolvedLocation>(AMBIENT_IP_LOCATION_CACHE_KEY) ??
              (await fetchIpLocation());
            setAmbientLocation(ipLoc);
            setStoredWithExpiry(AMBIENT_IP_LOCATION_CACHE_KEY, ipLoc, IP_LOCATION_TTL_MS);
            return ipLoc;
          }
        }

        const cached =
          getStoredWithExpiry<ResolvedLocation>(AMBIENT_IP_LOCATION_CACHE_KEY) ??
          null;
        if (cached) {
          setAmbientLocation(cached);
          return cached;
        }
        const ipLoc = await fetchIpLocation();
        setAmbientLocation(ipLoc);
        setStoredWithExpiry(AMBIENT_IP_LOCATION_CACHE_KEY, ipLoc, IP_LOCATION_TTL_MS);
        return ipLoc;
      } catch (e) {
        setAmbientError(e instanceof Error ? e.message : "Failed to resolve location");
        return null;
      } finally {
        setIsResolvingLocation(false);
      }
    },
    [ambientSettings, persistAmbientSettings]
  );

  const fetchWeatherFor = useCallback(async (loc: ResolvedLocation) => {
    setHasAttemptedWeather(true);
    setAmbientError(null);
    setIsFetchingWeather(true);
    try {
      const cacheKey = getWeatherCacheKey(loc.lat, loc.lon);
      const cached = getStoredWithExpiry<NormalizedWeather>(cacheKey);
      if (cached) {
        setAmbientWeather(cached);
        return cached;
      }
      const w = await fetchCurrentWeather(loc.lat, loc.lon);
      setAmbientWeather(w);
      setStoredWithExpiry(cacheKey, w, WEATHER_TTL_MS);
      return w;
    } catch (e) {
      setAmbientError(e instanceof Error ? e.message : "Failed to fetch weather");
      return null;
    } finally {
      setIsFetchingWeather(false);
    }
  }, []);

  // Keep ambient data up-to-date
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!ambientSettings.weatherEnabled) return;
      const loc = ambientLocation ?? (await resolveLocation(ambientSettings.locationMode));
      if (cancelled || !loc) return;
      await fetchWeatherFor(loc);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    ambientSettings.locationMode,
    ambientSettings.weatherEnabled,
    ambientLocation,
    resolveLocation,
    fetchWeatherFor,
  ]);

  const requestAccurateLocationAction = useCallback(async (): Promise<boolean> => {
    setAmbientError(null);
    try {
      resetWeatherDataForReload();
      const loc = await requestAccurateLocation();
      setAmbientLocation(loc);
      // Enable accurate mode once permission succeeds
      persistAmbientSettings({ ...ambientSettings, locationMode: "accurate" });
      await fetchWeatherFor(loc);
      return true;
    } catch (e) {
      setAmbientError(e instanceof Error ? e.message : "Geolocation permission denied");
      // Fall back to IP mode
      persistAmbientSettings({ ...ambientSettings, locationMode: "ip" });
      return false;
    }
  }, [ambientSettings, persistAmbientSettings, fetchWeatherFor, resetWeatherDataForReload]);

  const openCommand = useCallback((actionMode = false) => {
    setIsCommandOpen(true);
    setIsActionMode(actionMode);
  }, []);
  const closeCommand = useCallback(() => {
    setIsCommandOpen(false);
    setIsActionMode(false);
  }, []);
  const toggleCommand = useCallback(() => {
    setIsCommandOpen((prev) => {
      if (prev) setIsActionMode(false);
      return !prev;
    });
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields (except for command palette)
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // ⌘K to toggle command palette (search mode)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommand();
        return;
      }

      // "/" to open command palette in action mode (when not in input field)
      if (e.key === "/" && !isInputField && !isCommandOpen) {
        e.preventDefault();
        openCommand(true);
        return;
      }

      // "D" to toggle debug panel (when not in input field and command palette is closed)
      if (
        (e.key === "d" || e.key === "D") &&
        !isInputField &&
        !isCommandOpen &&
        !(e.metaKey || e.ctrlKey || e.altKey)
      ) {
        e.preventDefault();
        if (ambientSettings.debugFabEnabled) {
          setDebugPanelOpen((v) => !v);
        }
        return;
      }

      // Escape to close command palette
      if (e.key === "Escape" && isCommandOpen) {
        closeCommand();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    isCommandOpen,
    toggleCommand,
    closeCommand,
    openCommand,
    ambientSettings,
    persistAmbientSettings,
  ]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <LocaleContext.Provider value={{ locale, setLocale }}>
        <VisitorContext.Provider
          value={{
            lastVisited,
            lastVisitTime,
            isReturningVisitor,
            daysSinceLastVisit,
            recordVisit,
            recordPageView,
          }}
        >
          <AmbientContext.Provider
            value={{
              settings: ambientSettings,
              location: ambientLocation,
              weather: ambientWeather,
              debugWeatherOverride,
              debugWeatherOverrideEnabled,
              debugPanelOpen,
              hasAttemptedLocation,
              hasAttemptedWeather,
              isResolvingLocation,
              isFetchingWeather,
              error: ambientError,
              setLocationMode,
              setWeatherGradientEnabled,
              setDebugFabEnabled,
              setDebugPanelOpen,
              setDebugWeatherOverride,
              setDebugWeatherOverrideEnabled,
              refresh,
              requestAccurateLocation: requestAccurateLocationAction,
            }}
          >
          <CommandPaletteContext.Provider
            value={{
              isOpen: isCommandOpen,
              isActionMode,
              open: openCommand,
              close: closeCommand,
              toggle: toggleCommand,
              setActionMode: setIsActionMode,
            }}
          >
            {children}
          </CommandPaletteContext.Provider>
          </AmbientContext.Provider>
        </VisitorContext.Provider>
      </LocaleContext.Provider>
    </ThemeContext.Provider>
  );
}
