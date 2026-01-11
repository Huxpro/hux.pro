"use client";

import { useLocale, type Locale } from "@/services";
import { showCustomToast, dismissToast } from "@/components/ui/system-sonner";
import { resolveDisplayLocale, type PostLanguage } from "@/lib/content";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { LanguageConflictToast, LanguageSwitchToast } from "./language-toast";

interface UsePostLanguageOptions {
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
 * - Showing conflict toast when URL lang differs from system preference
 * - Showing feedback toast when user explicitly switches language
 * - Language switching via URL
 */
export function usePostLanguage({
  language,
}: UsePostLanguageOptions): UsePostLanguageReturn {
  const { locale: systemLocale } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlLang = searchParams.get("lang") as Locale | null;
  const isBilingual = language === "both";

  // Derive display locale from URL (source of truth for bilingual posts)
  const displayLocale = resolveDisplayLocale(urlLang, systemLocale, language);

  // Track hydration and conflict toast state
  const hasMounted = useRef(false);
  const conflictToastShown = useRef(false);
  const conflictToastId = useRef<string | number | undefined>(undefined);

  // Show conflict toast for shared links (after hydration, when URL lang differs from system)
  useEffect(() => {
    // Skip first render to wait for locale hydration
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const hasConflict = isBilingual && urlLang && urlLang !== systemLocale;

    if (hasConflict && !conflictToastShown.current) {
      conflictToastShown.current = true;

      const handleChoice = (chosenLang: Locale) => {
        dismissToast(conflictToastId.current);
        if (chosenLang !== urlLang) {
          router.replace(`${pathname}?lang=${chosenLang}`);
        }
      };

      conflictToastId.current = showCustomToast(
        <LanguageConflictToast
          sharedLang={urlLang}
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
  }, [systemLocale, urlLang, isBilingual, pathname, router]);

  // Compute alternate language info
  const alternateLocale = displayLocale === "en" ? "zh" : "en";
  const alternateLabel = displayLocale === "en" ? "中文版" : "English";

  // Switch to alternate language via URL with feedback toast
  const switchLanguage = () => {
    // Dismiss any existing conflict toast
    dismissToast("language-conflict");
    conflictToastShown.current = true; // Prevent conflict toast from showing

    // Navigate to alternate language
    router.push(`${pathname}?lang=${alternateLocale}`);

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
