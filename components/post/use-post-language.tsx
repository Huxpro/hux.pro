"use client";

import { useLocale, type Locale } from "@/services";
import { showCustomToast, dismissToast } from "@/components/ui/system-sonner";
import type { PostLanguage } from "@/lib/content";
import { useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LanguageConflictToast, LanguageSwitchToast } from "./language-toast";

/** SessionStorage key used to suppress conflict toast after intentional switch */
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
}

/**
 * Hook to manage bilingual post language state and toasts
 *
 * Handles:
 * - Conflict detection for shared links (route locale ≠ system preference)
 * - Showing feedback toast when user explicitly switches language
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

  // Track conflict toast state
  const conflictToastShown = useRef(false);
  const conflictToastId = useRef<string | number | undefined>(undefined);

  // Show conflict toast for shared links.
  // Waits for `hydrated` to ensure systemLocale is the real stored value,
  // not the SSR default.
  useEffect(() => {
    if (!hydrated) return;

    // Check if this navigation was an intentional language switch
    // (set by switchLanguage() or conflict toast choice before route navigation).
    // Refs don't survive route changes since the component remounts.
    const intentional = sessionStorage.getItem(INTENTIONAL_SWITCH_KEY);
    if (intentional) {
      sessionStorage.removeItem(INTENTIONAL_SWITCH_KEY);
      conflictToastShown.current = true;
      return;
    }

    const hasConflict = isBilingual && locale !== systemLocale;

    if (hasConflict && !conflictToastShown.current) {
      conflictToastShown.current = true;

      const handleChoice = (chosenLang: Locale) => {
        dismissToast(conflictToastId.current);
        if (chosenLang !== locale) {
          // Mark as intentional so the new page doesn't re-show conflict toast
          sessionStorage.setItem(INTENTIONAL_SWITCH_KEY, "true");
          router.replace(pathname.replace(/\/(en|zh)$/, `/${chosenLang}`));
        }
      };

      conflictToastId.current = showCustomToast(
        <LanguageConflictToast
          sharedLang={locale}
          systemLang={systemLocale}
          onChoose={handleChoice}
        />,
        { id: "language-conflict" }
      );
    }

    // Cleanup on unmount
    return () => {
      if (conflictToastId.current) {
        dismissToast(conflictToastId.current);
      }
    };
  }, [hydrated, systemLocale, locale, isBilingual, pathname, router]);

  // Compute alternate language info
  const alternateLocale = displayLocale === "en" ? "zh" : "en";
  const alternateLabel = displayLocale === "en" ? "中文版" : "English";

  // Switch to alternate language via route with feedback toast
  const switchLanguage = () => {
    // Dismiss any existing conflict toast
    dismissToast("language-conflict");

    // Mark as intentional so the new page doesn't show conflict toast
    sessionStorage.setItem(INTENTIONAL_SWITCH_KEY, "true");

    // Navigate to alternate language route
    router.push(pathname.replace(/\/(en|zh)$/, `/${alternateLocale}`));

    // Show feedback toast
    showCustomToast(
      <LanguageSwitchToast
        currentLang={alternateLocale}
        systemLang={systemLocale}
      />,
      { duration: 3000, id: "language-switch" }
    );
  };

  return {
    displayLocale,
    switchLanguage,
    hasAlternate: isBilingual,
    alternateLabel,
  };
}
