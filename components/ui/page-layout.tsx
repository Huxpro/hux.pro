"use client";

import { SystemNav } from "@/components/ui/system-nav";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { cn } from "@/lib/utils";
import {
  getScrambleCharacterSet,
  t,
  type ScramblePage,
  type TranslationKey,
} from "@/lib/i18n";
import { useLocale } from "@/services";
import { useState, type ReactNode } from "react";

interface PageLayoutProps {
  /**
   * Page identifier for scramble-enabled titles with i18n.
   * Uses `${page}Title` and `${page}TitleHover` translation keys.
   * Mutually exclusive with `title`.
   */
  page?: ScramblePage;
  /**
   * Static page title - displayed in the header h1.
   * Use this for pages without scramble animation.
   * Mutually exclusive with `page`.
   */
  title?: string;
  /** Back navigation href, defaults to "/" */
  backHref?: string;
  /** Back navigation label, defaults to "λhux" */
  backLabel?: string;
  /** Additional className for the main element */
  className?: string;
  /** Page content */
  children: ReactNode;
}

/**
 * PageLayout - Shared layout for content pages
 *
 * Provides consistent structure across prose, log, prompt, and docs pages:
 * - Centered container (max-w-[680px])
 * - SystemNav back navigation
 * - Page header with title (with optional TextScramble animation)
 * - View Transition API integration for smooth page transitions
 *
 * The layout elements have view-transition-name properties that match
 * corresponding elements on the home page, enabling smooth morphing
 * animations when navigating between pages.
 *
 * @example
 * // With scramble animation (i18n-aware)
 * <PageLayout page="writing">...</PageLayout>
 *
 * @example
 * // With static title
 * <PageLayout title="Documentation">...</PageLayout>
 */
export function PageLayout({
  page,
  title,
  backHref = "/",
  backLabel = "λhux",
  className,
  children,
}: PageLayoutProps) {
  const { locale } = useLocale();
  const [isHovered, setIsHovered] = useState(false);

  // Determine if we're using scramble mode (page prop) or static mode (title prop)
  const useScramble = !!page;

  // Get title and hover text from translations if using page prop
  const titleKey = page ? (`${page}Title` as TranslationKey) : undefined;
  const hoverKey = page ? (`${page}TitleHover` as TranslationKey) : undefined;

  const displayTitle = titleKey ? t(locale, titleKey) : title ?? "";
  const hoverTitle = hoverKey ? t(locale, hoverKey) : displayTitle;

  // Get character set for scramble animation
  const characterSet = getScrambleCharacterSet(locale, page);

  // Display text switches on hover
  const currentText = isHovered ? hoverTitle : displayTitle;

  return (
    <main className={cn("mx-auto max-w-[680px] px-6 pt-16 sm:pt-24 pb-32", className)}>
      {/* Back link - System UI */}
      <SystemNav href={backHref} path={backLabel} className="mb-16" />

      {/* Header */}
      <header
        className="mb-20"
        onMouseEnter={() => useScramble && setIsHovered(true)}
        onMouseLeave={() => useScramble && setIsHovered(false)}
      >
        {useScramble ? (
          <TextScramble
            as="h1"
            duration={0.5}
            speed={0.03}
            characterSet={characterSet}
            className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight cursor-default"
          >
            {currentText}
          </TextScramble>
        ) : (
          <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
            {displayTitle}
          </h1>
        )}
      </header>

      {children}
    </main>
  );
}
