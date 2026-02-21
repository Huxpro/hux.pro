"use client";

import { useLocale, type Locale } from "@/services";
import { showCustomToast, dismissToast } from "@/components/ui/system-sonner";
import type { PostLanguage } from "@/lib/content";
import { useTransitionRouter } from "next-view-transitions";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { LanguageConflictToast, LanguageSwitchToast } from "./language-toast";

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
 * - Hydration-aware conflict detection for shared links
 * - Showing conflict toast when route locale differs from system preference
 * - Showing feedback toast when user explicitly switches language
 * - Language switching via route navigation
 */
export function usePostLanguage({
  locale,
  language,
}: UsePostLanguageOptions): UsePostLanguageReturn {
  const { locale: systemLocale } = useLocale();
  const router = useTransitionRouter();
  const pathname = usePathname();

  const isBilingual = language === "both";
  const displayLocale = locale;

  // Track hydration and conflict toast state
  const hasMounted = useRef(false);
  const conflictToastShown = useRef(false);
  const conflictToastId = useRef<string | number | undefined>(undefined);

  // Show conflict toast for shared links (after hydration, when route locale differs from system)
  useEffect(() => {
    // Skip first render to wait for locale hydration
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const hasConflict = isBilingual && locale !== systemLocale;

    if (hasConflict && !conflictToastShown.current) {
      conflictToastShown.current = true;

      const handleChoice = (chosenLang: Locale) => {
        dismissToast(conflictToastId.current);
        if (chosenLang !== locale) {
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
  }, [systemLocale, locale, isBilingual, pathname, router]);

  // Compute alternate language info
  const alternateLocale = displayLocale === "en" ? "zh" : "en";
  const alternateLabel = displayLocale === "en" ? "中文版" : "English";

  // Switch to alternate language via route with feedback toast
  const switchLanguage = () => {
    // Dismiss any existing conflict toast
    dismissToast("language-conflict");
    conflictToastShown.current = true; // Prevent conflict toast from showing

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
