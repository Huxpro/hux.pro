"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Theme Service
// Manages light/dark theme based on system preference
// =============================================================================

interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
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

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
