"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Theme Service
// Manages light/dark theme based on system preference
// =============================================================================

interface ThemeContextType {
  theme: "light" | "dark";
  preference: "light" | "dark" | "system";
  toggleTheme: () => void;
  setThemePreference: (preference: "light" | "dark" | "system") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

type Theme = "light" | "dark";
type ThemePreference = Theme | "system";

const THEME_STORAGE_KEY = "hux_theme";

/**
 * Blocking snippet injected into <head> so the `dark` class lands on <html>
 * BEFORE the first paint.
 *
 * This is not just about a flash of light content: iOS 26 Safari samples the
 * root background-color to tint its Liquid Glass status bar and bottom
 * toolbar, and it samples early. Applying the theme in an effect meant the
 * first painted root colour was always the light one, so the chrome kept a
 * white cast on a dark page.
 *
 * Kept in lock step with `getStoredPreference` / `getSystemTheme` below.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((p==="system"||p===null)&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

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

function getInitialTheme(preference: ThemePreference): Theme {
  if (typeof window === "undefined") return "light";
  return preference === "system" ? getSystemTheme() : preference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => getStoredPreference());
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme(getStoredPreference()));

  useEffect(() => {
    if (preference !== "system") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = () => {
      setTheme(mediaQuery.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, [preference]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    setPreference(nextTheme);
    setStoredPreference(nextTheme);
  }, [theme]);

  const setThemePreference = useCallback((nextPreference: ThemePreference) => {
    setPreference(nextPreference);
    setStoredPreference(nextPreference);
    setTheme(getInitialTheme(nextPreference));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, preference, toggleTheme, setThemePreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
