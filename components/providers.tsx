"use client";

import { getWeatherGradient } from "@/lib/ambient/gradient";
import type { LocationMode, ResolvedLocation } from "@/lib/ambient/location";
import { requestAccurateLocation } from "@/lib/ambient/location";
import { useLocationQuery, useWeatherQuery } from "@/lib/ambient/queries";
import {
  type AmbientSettings,
  getAmbientSettings,
  setAmbientSettings,
} from "@/lib/ambient/settings";
import type {
  NormalizedWeather,
  WeatherCondition,
} from "@/lib/ambient/weather";
import {
  type Locale,
  defaultLocale,
  getStoredLocale,
  setStoredLocale,
} from "@/lib/i18n";
import { queryClient, queryPersister } from "@/lib/query";
import { QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// =============================================================================
// Theme Context
// Manages light/dark theme based on system preference
// =============================================================================

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

// =============================================================================
// Locale Context
// Manages i18n locale (en/zh) with localStorage persistence
// =============================================================================

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

// =============================================================================
// Command Palette Context
// Controls the command palette open/close state and mode
// =============================================================================

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

// =============================================================================
// Visitor Context
// Tracks returning visitors and last-read content for personalized greetings
// =============================================================================

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

// =============================================================================
// Location Context
// Exposes location data from React Query with mode switching
// =============================================================================

interface LocationContextType {
  /** Current location mode: "ip" (default) or "accurate" (GPS) */
  locationMode: LocationMode;
  /** Resolved location coordinates and metadata */
  location: ResolvedLocation | null;
  /** True during initial load (no data yet) */
  isLoading: boolean;
  /** True during background refetch (has stale data) */
  isFetching: boolean;
  /** Error message if location resolution failed */
  error: string | null;
  /** Switch location mode (IP ↔ Accurate) */
  setLocationMode: (mode: LocationMode) => void;
  /** Request accurate location with user permission prompt */
  requestAccurateLocation: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) throw new Error("useLocation must be used within Providers");
  return context;
}

// =============================================================================
// Debug Context
// Controls the debug FAB and panel visibility
// =============================================================================

interface DebugContextType {
  /** Whether the debug FAB is visible */
  isFABEnabled: boolean;
  /** Whether the debug panel is currently open */
  isOpen: boolean;
  /** Toggle panel open/close */
  toggle: () => void;
  /** Open the panel */
  open: () => void;
  /** Close the panel */
  close: () => void;
  /** Toggle FAB visibility */
  toggleFAB: () => void;
  /** Set FAB enabled state directly */
  setFABEnabled: (enabled: boolean) => void;
}

const DebugContext = createContext<DebugContextType | undefined>(undefined);

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) throw new Error("useDebug must be used within Providers");
  return context;
}

// =============================================================================
// Weather Context
// Exposes weather data from React Query with gradient computation
// =============================================================================

interface WeatherDebugOverride {
  condition: WeatherCondition;
  isDay: boolean;
}

interface WeatherContextType {
  /** Current weather data (null if not yet fetched or error) */
  weather: NormalizedWeather | null;
  /** Computed gradient CSS based on weather/override and theme */
  gradient: string;
  /** True during initial load */
  isLoading: boolean;
  /** True during background refetch */
  isFetching: boolean;
  /** Error message if weather fetch failed */
  error: string | null;
  /** Whether weather gradient background is enabled */
  isGradientEnabled: boolean;
  /** Toggle weather gradient background */
  setGradientEnabled: (enabled: boolean) => void;
  /** Whether debug override is active */
  isOverrideEnabled: boolean;
  /** Toggle override enabled state */
  setOverrideEnabled: (enabled: boolean) => void;
  /** Current debug override values */
  debugOverride: WeatherDebugOverride | null;
  /** Set debug override values */
  setDebugOverride: (override: WeatherDebugOverride | null) => void;
  /** Force refresh weather data */
  refresh: () => void;
}

const WeatherContext = createContext<WeatherContextType | undefined>(undefined);

export function useWeather() {
  const context = useContext(WeatherContext);
  if (!context) throw new Error("useWeather must be used within Providers");
  return context;
}

// =============================================================================
// Visitor Storage Helpers
// =============================================================================

const VISITOR_STORAGE_KEY = "hux_visitor";

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

// =============================================================================
// AmbientProviders - Inner component that uses React Query
// Must be rendered inside QueryClientProvider
// =============================================================================

function AmbientProviders({
  children,
  settings,
  updateSettings,
  theme,
  isCommandOpen,
}: {
  children: React.ReactNode;
  settings: AmbientSettings;
  updateSettings: (partial: Partial<AmbientSettings>) => void;
  theme: "light" | "dark";
  isCommandOpen: boolean;
}) {
  // ---------------------------------------------------------------------------
  // Debug State (ephemeral)
  // ---------------------------------------------------------------------------
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugOverride, setDebugOverride] =
    useState<WeatherDebugOverride | null>(null);
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(false);

  // ===========================================================================
  // Location (React Query)
  // ===========================================================================

  const locationQuery = useLocationQuery(settings.locationMode);

  const setLocationMode = useCallback(
    (mode: LocationMode) => {
      if (mode === settings.locationMode) return;
      updateSettings({ locationMode: mode });
      // React Query will automatically refetch due to query key change
    },
    [settings.locationMode, updateSettings]
  );

  const requestAccurateLocationAction =
    useCallback(async (): Promise<boolean> => {
      try {
        // Request permission and get location
        await requestAccurateLocation();
        // If successful, switch to accurate mode
        updateSettings({ locationMode: "accurate" });
        return true;
      } catch {
        // Fall back to IP mode
        updateSettings({ locationMode: "ip" });
        return false;
      }
    }, [updateSettings]);

  // ===========================================================================
  // Weather (React Query)
  // ===========================================================================

  const weatherQuery = useWeatherQuery(locationQuery.data);

  const refreshWeather = useCallback(() => {
    // Invalidate both queries to force refetch
    queryClient.invalidateQueries({ queryKey: ["location"] });
    queryClient.invalidateQueries({ queryKey: ["weather"] });
  }, []);

  // Compute gradient based on weather (or debug override) and theme
  const computedGradient = useMemo(() => {
    if (!settings.weatherGradientEnabled) return "";

    // Use debug override if enabled
    if (isOverrideEnabled && debugOverride) {
      return getWeatherGradient({
        condition: debugOverride.condition,
        isDay: debugOverride.isDay,
        theme,
      }).backgroundImage;
    }

    // Use actual weather
    const weather = weatherQuery.data;
    if (weather) {
      return getWeatherGradient({
        condition: weather.condition,
        isDay: weather.isDay,
        theme,
      }).backgroundImage;
    }

    return "";
  }, [
    settings.weatherGradientEnabled,
    isOverrideEnabled,
    debugOverride,
    weatherQuery.data,
    theme,
  ]);

  const setGradientEnabled = useCallback(
    (enabled: boolean) => {
      updateSettings({ weatherGradientEnabled: enabled });
    },
    [updateSettings]
  );

  // ===========================================================================
  // Debug Panel Controls
  // ===========================================================================

  const toggleDebugFAB = useCallback(() => {
    const newEnabled = !settings.debugFabEnabled;
    updateSettings({ debugFabEnabled: newEnabled });
    if (!newEnabled) setIsDebugOpen(false);
  }, [settings.debugFabEnabled, updateSettings]);

  const setDebugFABEnabled = useCallback(
    (enabled: boolean) => {
      updateSettings({ debugFabEnabled: enabled });
      if (!enabled) setIsDebugOpen(false);
    },
    [updateSettings]
  );

  const toggleDebug = useCallback(() => {
    if (settings.debugFabEnabled) {
      setIsDebugOpen((prev) => !prev);
    }
  }, [settings.debugFabEnabled]);

  const openDebug = useCallback(() => {
    if (settings.debugFabEnabled) {
      setIsDebugOpen(true);
    }
  }, [settings.debugFabEnabled]);

  const closeDebug = useCallback(() => {
    setIsDebugOpen(false);
  }, []);

  // ===========================================================================
  // Debug Panel Keyboard Shortcut (D key)
  // ===========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // "D" to toggle debug panel (when not in input field and command palette is closed)
      if (
        (e.key === "d" || e.key === "D") &&
        !isInputField &&
        !isCommandOpen &&
        !(e.metaKey || e.ctrlKey || e.altKey)
      ) {
        e.preventDefault();
        toggleDebug();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCommandOpen, toggleDebug]);

  return (
    <LocationContext.Provider
      value={{
        locationMode: settings.locationMode,
        location: locationQuery.data ?? null,
        isLoading: locationQuery.isLoading,
        isFetching: locationQuery.isFetching,
        error: locationQuery.error?.message ?? null,
        setLocationMode,
        requestAccurateLocation: requestAccurateLocationAction,
      }}
    >
      <WeatherContext.Provider
        value={{
          weather: weatherQuery.data ?? null,
          gradient: computedGradient,
          isLoading: weatherQuery.isLoading,
          isFetching: weatherQuery.isFetching,
          error: weatherQuery.error?.message ?? null,
          isGradientEnabled: settings.weatherGradientEnabled,
          setGradientEnabled,
          isOverrideEnabled,
          setOverrideEnabled: setIsOverrideEnabled,
          debugOverride,
          setDebugOverride,
          refresh: refreshWeather,
        }}
      >
        <DebugContext.Provider
          value={{
            isFABEnabled: settings.debugFabEnabled,
            isOpen: isDebugOpen,
            toggle: toggleDebug,
            open: openDebug,
            close: closeDebug,
            toggleFAB: toggleDebugFAB,
            setFABEnabled: setDebugFABEnabled,
          }}
        >
          {children}
        </DebugContext.Provider>
      </WeatherContext.Provider>
    </LocationContext.Provider>
  );
}

// =============================================================================
// Providers Component
// Composes all context providers with React Query
// =============================================================================

export function Providers({ children }: { children: React.ReactNode }) {
  // ---------------------------------------------------------------------------
  // Theme State
  // ---------------------------------------------------------------------------
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // ---------------------------------------------------------------------------
  // Locale State
  // ---------------------------------------------------------------------------
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  // ---------------------------------------------------------------------------
  // Command Palette State
  // ---------------------------------------------------------------------------
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isActionMode, setIsActionMode] = useState(false);

  // ---------------------------------------------------------------------------
  // Visitor State
  // ---------------------------------------------------------------------------
  const [lastVisited, setLastVisited] = useState<LastVisitedItem | null>(null);
  const [lastVisitTime, setLastVisitTime] = useState<number | null>(null);
  const [isReturningVisitor, setIsReturningVisitor] = useState(false);

  // ---------------------------------------------------------------------------
  // Ambient Settings (user preferences, persisted to localStorage)
  // ---------------------------------------------------------------------------
  const [settings, setSettingsState] =
    useState<AmbientSettings>(getAmbientSettings);

  const updateSettings = useCallback((partial: Partial<AmbientSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...partial };
      setAmbientSettings(next);
      return next;
    });
  }, []);

  // ===========================================================================
  // Theme Initialization
  // ===========================================================================

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      setTheme(mediaQuery.matches ? "dark" : "light");
    };
    updateTheme();
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  // ===========================================================================
  // Locale Initialization
  // ===========================================================================

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: reading browser-only localStorage
    setLocaleState(getStoredLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
  }, []);

  // ===========================================================================
  // Visitor Tracking
  // ===========================================================================

  useEffect(() => {
    const stored = getVisitorStorage();
    if (stored) {
      setLastVisited(stored.lastVisited);
      setLastVisitTime(stored.lastVisitTime);
      setIsReturningVisitor(true);
    }
  }, []);

  const daysSinceLastVisit = lastVisitTime
    ? Math.floor((Date.now() - lastVisitTime) / (1000 * 60 * 60 * 24))
    : null;

  const recordVisit = useCallback((item: LastVisitedItem) => {
    setLastVisited(item);
    const now = Date.now();
    setLastVisitTime(now);
    setVisitorStorage({ lastVisited: item, lastVisitTime: now });
  }, []);

  const recordPageView = useCallback(() => {
    const now = Date.now();
    const stored = getVisitorStorage();
    setVisitorStorage({
      lastVisited: stored?.lastVisited || null,
      lastVisitTime: now,
    });
  }, []);

  // ===========================================================================
  // Command Palette
  // ===========================================================================

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

  // ===========================================================================
  // Global Keyboard Shortcuts
  // ===========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // ⌘K to toggle command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggleCommand();
        return;
      }

      // "/" to open command palette in action mode
      if (e.key === "/" && !isInputField && !isCommandOpen) {
        e.preventDefault();
        openCommand(true);
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
  }, [isCommandOpen, toggleCommand, closeCommand, openCommand]);

  // ===========================================================================
  // Render Provider Tree
  // ===========================================================================

  return (
    <QueryClientProvider client={queryClient}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister }}
      >
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
              <AmbientProviders
                settings={settings}
                updateSettings={updateSettings}
                theme={theme}
                isCommandOpen={isCommandOpen}
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
              </AmbientProviders>
            </VisitorContext.Provider>
          </LocaleContext.Provider>
        </ThemeContext.Provider>
      </PersistQueryClientProvider>
    </QueryClientProvider>
  );
}
