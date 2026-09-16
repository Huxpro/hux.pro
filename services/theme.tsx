"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Theme Service
//
// Two layers decide what paints:
//
//   preference — light / dark / system. The user's, saved in localStorage.
//   override   — light / dark. The sun's, for this browser session only.
//
// The override is how "the theme follows the sun" works (see the ambient
// system's <SolarThemeSync />): when sunrise or sunset is crossed while the
// page is open, the app flips without the saved preference moving an inch. It
// lives in sessionStorage, so a reload in the same tab keeps the theme the sun
// set and closing the tab forgets it — which is what makes the flip a session
// thing rather than a setting changed behind the user's back.
//
// Anything the user chooses explicitly — the palette's Appearance command, a
// toggle — clears the override. The preference is theirs; the override is a
// guest.
// =============================================================================

type Theme = "light" | "dark";
type ThemePreference = Theme | "system";

interface ThemeContextType {
  /** The theme in effect: the override while one is in force, else the preference's. */
  theme: Theme;
  preference: ThemePreference;
  /** What the preference alone would paint — what an override is measured against. */
  baseTheme: Theme;
  /** The session override, or null when the preference is having its way. */
  override: Theme | null;
  toggleTheme: () => void;
  setThemePreference: (preference: ThemePreference) => void;
  /**
   * Set the session override. Passing the theme the preference already gives
   * clears it instead — an override that changes nothing is not one — and so
   * does passing null.
   */
  setThemeOverride: (theme: Theme | null) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

const THEME_STORAGE_KEY = "hux_theme";
/** sessionStorage: the override dies with the tab, by construction. */
const THEME_OVERRIDE_KEY = "hux_theme_session";

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

function setStoredPreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, preference);
}

function getStoredOverride(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(THEME_OVERRIDE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function setStoredOverride(theme: Theme | null): void {
  if (typeof window === "undefined") return;
  try {
    if (theme) sessionStorage.setItem(THEME_OVERRIDE_KEY, theme);
    else sessionStorage.removeItem(THEME_OVERRIDE_KEY);
  } catch {
    // Ignore storage errors (private mode, disabled storage)
  }
}

function getInitialTheme(preference: ThemePreference): Theme {
  if (typeof window === "undefined") return "light";
  return preference === "system" ? getSystemTheme() : preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredPreference());
  const [baseTheme, setBaseTheme] = useState<Theme>(() => getInitialTheme(getStoredPreference()));
  // Restored before first paint so a reload inside the session does not undo
  // the sun's switch. <SolarThemeSync /> validates it once the sun times are
  // known and drops it if the sun has moved on since.
  const [override, setOverride] = useState<Theme | null>(() => getStoredOverride());

  const theme = override ?? baseTheme;

  useEffect(() => {
    if (preference !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      setBaseTheme(mediaQuery.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, [preference]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    // Measured against what is on screen, override included: "toggle" means
    // the other one than this. Choosing is the user's move, so it also ends
    // whatever the sun was doing.
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setOverride(null);
    setStoredOverride(null);
    setBaseTheme(nextTheme);
    setPreference(nextTheme);
    setStoredPreference(nextTheme);
  }, [theme]);

  const setThemePreference = useCallback((nextPreference: ThemePreference) => {
    setOverride(null);
    setStoredOverride(null);
    setPreference(nextPreference);
    setStoredPreference(nextPreference);
    setBaseTheme(getInitialTheme(nextPreference));
  }, []);

  const setThemeOverride = useCallback(
    (next: Theme | null) => {
      const resolved = next === baseTheme ? null : next;
      setOverride(resolved);
      setStoredOverride(resolved);
    },
    [baseTheme]
  );

  return (
    <ThemeContext.Provider
      value={{
        theme,
        preference,
        baseTheme,
        override,
        toggleTheme,
        setThemePreference,
        setThemeOverride,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
