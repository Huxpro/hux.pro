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

function setLocaleCookie(locale: Locale): void {
  document.cookie = `locale=${locale};path=/;max-age=31536000;SameSite=Lax`;
}

/**
 * The stored locale, or — on a first visit — the browser's guess, stored so
 * the next visit reads it back. `guessed` says which: a guess is what the
 * first-visit prompt (components/ui/language-prompt.tsx) offers to confirm.
 */
function getStoredLocale(): { locale: Locale; guessed: boolean } {
  if (typeof window === "undefined") return { locale: defaultLocale, guessed: false };
  const stored = localStorage.getItem("locale");
  if (stored && locales.includes(stored as Locale)) {
    return { locale: stored as Locale, guessed: false };
  }
  // First visit: detect from browser language
  const browserLang = navigator.language.toLowerCase();
  const detectedLocale: Locale = browserLang.startsWith("zh") ? "zh" : "en";
  // Store the detected locale for future visits
  localStorage.setItem("locale", detectedLocale);
  setLocaleCookie(detectedLocale);
  return { locale: detectedLocale, guessed: true };
}

function setStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("locale", locale);
  setLocaleCookie(locale);
}

// =============================================================================
// Locale Context
// =============================================================================

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** True after the real locale has been read from localStorage */
  hydrated: boolean;
  /**
   * The locale is the browser's guess, made on this visit — the first —
   * and nobody has chosen one since.
   */
  guessed: boolean;
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined);

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [hydrated, setHydrated] = useState(false);
  const [guessed, setGuessed] = useState(false);

  useEffect(() => {
    const stored = getStoredLocale();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: reading browser-only localStorage
    setLocaleState(stored.locale);
    setGuessed(stored.guessed);
    setHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    setStoredLocale(newLocale);
    setGuessed(false);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, hydrated, guessed }}>
      {children}
    </LocaleContext.Provider>
  );
}
