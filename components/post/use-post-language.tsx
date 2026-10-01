"use client";

import { t, useLocale, type Locale } from "@/services";
import type { PostLanguage } from "@/lib/content";
import { showNotice } from "@/systems/dock";
import { Languages } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { languageName } from "./language-sheet";

/** SessionStorage key used to suppress the shared-language sheet after an intentional switch */
const INTENTIONAL_SWITCH_KEY = "language-switch-intentional";

interface UsePostLanguageOptions {
  locale: Locale;
  language: PostLanguage;
}

interface UsePostLanguageReturn {
  /** The locale to use for displaying content */
  displayLocale: Locale;
  /** Function to switch to the alternate language */
  switchLanguage: () => void;
  /** Whether the post has an alternate language version */
  hasAlternate: boolean;
  /** Label for the language switch button (e.g., "中文版" or "English") */
  alternateLabel: string;
  /**
   * The link was shared in the other language than the reader's: props for
   * `<LanguageSharedSheet>`, which the caller renders.
   */
  shared: {
    open: boolean;
    shared: Locale;
    preferred: Locale;
    onChoose: (lang: Locale) => void;
  };
}

/**
 * Hook to manage bilingual post language state, its sheet and its notice
 *
 * Handles:
 * - Conflict detection for shared links (route locale ≠ system preference),
 *   answered in a sheet (language-sheet.tsx)
 * - A Dock notice when the user explicitly switches language
 * - Language switching via route navigation
 *
 * Hydration strategy:
 * - Uses `hydrated` from LocaleProvider to wait for real systemLocale
 *   (replaces the old hasMounted ref guard which relied on useSearchParams
 *   triggering a re-render after Suspense)
 * - Uses sessionStorage to distinguish intentional language switches from
 *   shared links (refs are lost on route navigation since components remount)
 */
export function usePostLanguage({
  locale,
  language,
}: UsePostLanguageOptions): UsePostLanguageReturn {
  const { locale: systemLocale, hydrated } = useLocale();
  const router = useTransitionRouter();
  const pathname = usePathname();

  const isBilingual = language === "both";
  const displayLocale = locale;

  // Whether this page has already decided about the conflict: asked once, or
  // arrived here by an intentional switch.
  const conflictChecked = useRef(false);
  const [conflictOpen, setConflictOpen] = useState(false);

  // Ask about the conflict for shared links.
  // Waits for `hydrated` to ensure systemLocale is the real stored value,
  // not the SSR default.
  useEffect(() => {
    if (!hydrated) return;

    // Check if this navigation was an intentional language switch
    // (set by switchLanguage() or the sheet's choice before route navigation).
    // Refs don't survive route changes since the component remounts.
    const intentional = sessionStorage.getItem(INTENTIONAL_SWITCH_KEY);
    if (intentional) {
      sessionStorage.removeItem(INTENTIONAL_SWITCH_KEY);
      conflictChecked.current = true;
      return;
    }

    if (isBilingual && locale !== systemLocale && !conflictChecked.current) {
      conflictChecked.current = true;
      // Read from sessionStorage, which the render cannot see.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConflictOpen(true);
    }
  }, [hydrated, systemLocale, locale, isBilingual]);

  const chooseLanguage = (chosen: Locale) => {
    setConflictOpen(false);
    if (chosen === locale) return;
    // Mark as intentional so the new page doesn't ask again
    sessionStorage.setItem(INTENTIONAL_SWITCH_KEY, "true");
    router.replace(pathname.replace(/\/(en|zh)$/, `/${chosen}`));
  };

  // Compute alternate language info
  const alternateLocale = displayLocale === "en" ? "zh" : "en";
  const alternateLabel = displayLocale === "en" ? "中文版" : "English";

  // Switch to alternate language via route, and say so in the Dock
  const switchLanguage = () => {
    setConflictOpen(false);

    // Mark as intentional so the new page doesn't ask about the conflict
    sessionStorage.setItem(INTENTIONAL_SWITCH_KEY, "true");

    // Navigate to alternate language route
    router.push(pathname.replace(/\/(en|zh)$/, `/${alternateLocale}`));

    // In the reader's own language, whichever the page is now in.
    showNotice({
      id: "language-switch",
      icon: Languages,
      title: t(systemLocale, "languageReadingIn").replace(
        "{lang}",
        languageName(systemLocale, alternateLocale)
      ),
      // Reading the other one is a visit, not a change of mind.
      note:
        alternateLocale === systemLocale
          ? undefined
          : t(systemLocale, "languageNote"),
      duration: 3000,
    });
  };

  return {
    displayLocale,
    switchLanguage,
    hasAlternate: isBilingual,
    alternateLabel,
    shared: {
      open: conflictOpen,
      shared: locale,
      preferred: systemLocale,
      onChoose: chooseLanguage,
    },
  };
}
