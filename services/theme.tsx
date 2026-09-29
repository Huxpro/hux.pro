"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

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
// (`setSunTheme`, from <SolarThemeSync />), already staged: at a sunrise or a
// sunset it arrives in the middle of the sky's animation, not the instant the
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
  /**
   * The theme the sun has handed in, or null before it has one. Only Follow
   * the Sun paints it; the ambient system keeps it current either way, so
   * choosing Follow the Sun lands on the sun's answer at once.
   */
  sunTheme: Theme | null;
  /** The OS's `prefers-color-scheme`, under every Appearance: Follow the Sun's stand-in. */
  systemTheme: Theme;
  toggleTheme: () => void;
  setThemePreference: (preference: ThemePreference) => void;
  /** For the ambient system: the sun's answer, as the app should show it now. */
  setSunTheme: (theme: Theme | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
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
// off, which was a clear answer. Once: every preference written from here on
// carries the marker, so a "system" chosen today stays "system".
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
    localStorage.setItem(THEME_MIGRATED_KEY, "1");
  } catch {
    // Ignore storage errors (private mode, disabled storage)
  }
}

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_PREFERENCE;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (!isPreference(stored)) return DEFAULT_PREFERENCE;
    if (stored !== "system" || localStorage.getItem(THEME_MIGRATED_KEY)) return stored;
    const migrated: ThemePreference = legacyFollowedSun() ? "sun" : "system";
    setStoredPreference(migrated);
    sessionStorage.removeItem(LEGACY_OVERRIDE_KEY);
    return migrated;
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

  const theme: Theme =
    preference === "light" || preference === "dark"
      ? preference
      : preference === "sun"
        ? (sunTheme ?? systemTheme)
        : systemTheme;

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

  // "Toggle" means the other one than this, as a choice of its own — so it
  // leaves either Follow mode for the theme it names.
  const toggleTheme = useCallback(
    () => setThemePreference(theme === "light" ? "dark" : "light"),
    [theme, setThemePreference]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        preference,
        sunTheme,
        systemTheme,
        toggleTheme,
        setThemePreference,
        setSunTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
