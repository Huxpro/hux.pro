"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  defaultLocale,
  getScrambleCharacterSet,
  localeNames,
  locales,
  scrambleCharacterSets,
  t,
  translations,
  type Locale,
  type ScramblePage,
  type TranslationKey,
} from "@/lib/i18n";

// Re-export i18n utilities for convenience
export {
  defaultLocale,
  getScrambleCharacterSet,
  localeNames,
  locales,
  scrambleCharacterSets,
  t,
  translations,
  type Locale,
  type ScramblePage,
  type TranslationKey,
};

// =============================================================================
// Locale Service
// Manages current locale selection with localStorage persistence
// =============================================================================

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;
  const stored = localStorage.getItem("locale");
  if (stored && locales.includes(stored as Locale)) {
    return stored as Locale;
  }
  // First visit: detect from browser language
  const browserLang = navigator.language.toLowerCase();
  const detectedLocale: Locale = browserLang.startsWith("zh") ? "zh" : "en";
  // Store the detected locale for future visits
  localStorage.setItem("locale", detectedLocale);
  return detectedLocale;
}

function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("locale", locale);
}

// =============================================================================
// Locale Context
// =============================================================================

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: reading browser-only localStorage
    setLocaleState(getStoredLocale());
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
