"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// =============================================================================
// Theme Service
//
// Appearance is one preference with four answers:
//
//   light / dark  what they say. Nothing else moves them.
//   system        Follow the System: the OS's `prefers-color-scheme`.
//   sun           Follow the Sun: Light while the sun is up, Dark once it is
//                 down. The default.
//
// The sun's answer is not this service's to know — it takes a location and a
// forecast, which the ambient system has — so the ambient system hands it in
// (`useSunThemeSlot`, from <SolarThemeSync />), already staged: at a sunrise or
// a sunset it arrives in the middle of the sky's animation, not the instant the
// sun crosses. Until it has one, Follow the Sun trusts the system, and moves to
// the sun's answer when the forecast lands.
//
// The preference is saved in localStorage. The sun's answer is not saved at
// all: it is recomputed on every visit, so a page opened after dark opens dark.
// =============================================================================

type Theme = "light" | "dark";
export type ThemePreference = Theme | "system" | "sun";

interface ThemeContextType {
  /** The theme in effect, whatever decided it. */
  theme: Theme;
  preference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  /**
   * The next Appearance in the cycle, starting from what Follow the Sun shows:
   * Follow the Sun → the theme it is not showing → the one it is → Follow the
   * System → Follow the Sun. Leaving Follow the Sun lands on the theme it is
   * not showing, so the first step always changes the page; the second puts
   * back what the sun had, now held. No memory of where the cycle began: the
   * sun's answer is kept current under every Appearance, so the order is read
   * off it on each step.
   */
  cycleThemePreference: () => void;
}

/**
 * The sun's answer, for the ambient system alone: null before it has one.
 * A context of its own, so the answer arriving — every visit, whatever the
 * Appearance — re-renders only its one reader, not everything that reads the
 * theme.
 */
interface SunThemeSlot {
  sunTheme: Theme | null;
  setSunTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const SunThemeContext = createContext<SunThemeSlot | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function useSunThemeSlot() {
  const context = useContext(SunThemeContext);
  if (!context) throw new Error("useSunThemeSlot must be used within ThemeProvider");
  return context;
}

const THEME_STORAGE_KEY = "hux_theme";
const DEFAULT_PREFERENCE: ThemePreference = "sun";

// -----------------------------------------------------------------------------
// Before Follow the Sun was an Appearance, it was a switch of its own in the
// ambient settings (`themeFollowsSun`, on unless turned off) that only acted on
// a sunrise or a sunset watched live, as a session override on top of the
// preference. A saved "system" from then was almost always the default plus
// that switch, so it becomes Follow the Sun — unless the switch had been turned
// off, which was a clear answer. Once, on the first read: the marker it leaves
// means a "system" chosen from then on stays "system".
// -----------------------------------------------------------------------------

const THEME_MIGRATED_KEY = "hux_theme_v2";
const LEGACY_AMBIENT_SETTINGS_KEY = "hux_ambient_settings";
const LEGACY_OVERRIDE_KEY = "hux_theme_session";

function legacyFollowedSun(): boolean {
  try {
    const settings = JSON.parse(localStorage.getItem(LEGACY_AMBIENT_SETTINGS_KEY) || "{}");
    return settings?.themeFollowsSun !== false;
  } catch {
    return true;
  }
}

function isPreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system" || value === "sun";
}

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setStoredPreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore storage errors (private mode, disabled storage)
  }
}

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCE;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const preference = isPreference(stored) ? stored : DEFAULT_PREFERENCE;
    if (localStorage.getItem(THEME_MIGRATED_KEY)) return preference;
    localStorage.setItem(THEME_MIGRATED_KEY, "1");
    sessionStorage.removeItem(LEGACY_OVERRIDE_KEY);
    if (preference !== "system" || !legacyFollowedSun()) return preference;
    setStoredPreference("sun");
    return "sun";
  } catch {
    return DEFAULT_PREFERENCE;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredPreference());
  const [systemTheme, setSystemTheme] = useState<Theme>(() =>
    typeof window === "undefined" ? "light" : getSystemTheme()
  );
  const [sunTheme, setSunTheme] = useState<Theme | null>(null);

  // What Follow the Sun shows, under any Appearance.
  const sunShows = sunTheme ?? systemTheme;
  const theme: Theme =
    preference === "sun" ? sunShows : preference === "system" ? systemTheme : preference;

  // Heard in every preference: Follow the Sun falls back to it too.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setThemePreference = useCallback((next: ThemePreference) => {
    setPreference(next);
    setStoredPreference(next);
  }, []);

  // Read when the cycle steps rather than subscribed to, so the sun's answer
  // moving under a fixed Appearance does not rebuild the context.
  const sunShowsRef = useRef(sunShows);
  useEffect(() => {
    sunShowsRef.current = sunShows;
  }, [sunShows]);

  const cycleThemePreference = useCallback(() => {
    const shows = sunShowsRef.current;
    const cycle: ThemePreference[] = ["sun", shows === "light" ? "dark" : "light", shows, "system"];
    setThemePreference(cycle[(cycle.indexOf(preference) + 1) % cycle.length]);
  }, [preference, setThemePreference]);

  const value = useMemo(
    () => ({ theme, preference, setThemePreference, cycleThemePreference }),
    [theme, preference, setThemePreference, cycleThemePreference]
  );
  const sunSlot = useMemo(() => ({ sunTheme, setSunTheme }), [sunTheme]);

  return (
    <ThemeContext.Provider value={value}>
      <SunThemeContext.Provider value={sunSlot}>{children}</SunThemeContext.Provider>
    </ThemeContext.Provider>
  );
}
