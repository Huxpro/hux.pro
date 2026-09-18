"use client";

import { HeaderZone } from "@/components/ui/header-zone";
import { TITLE_POETIC, TITLE_READER } from "@/components/ui/header-zone";
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
import { useHeroFade } from "./use-hero-fade";

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
  /** Content rendered below the title (e.g., meta row, language filter) */
  headerActions?: ReactNode;
  /** Title typography variant */
  variant?: "poetic" | "reader";
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
 * - Fixed-height HeaderZone for stable content-start position
 * - SystemNav back navigation
 * - Page header with title (with optional TextScramble animation)
 * - View Transition API integration for smooth page transitions
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
  headerActions,
  variant = "poetic",
  className,
  children,
}: PageLayoutProps) {
  const { locale } = useLocale();
  const [isHovered, setIsHovered] = useState(false);
  const heroFadeStyle = useHeroFade();

  const useScramble = !!page;

  const titleKey = page ? (`${page}Title` as TranslationKey) : undefined;
  const hoverKey = page ? (`${page}TitleHover` as TranslationKey) : undefined;

  const displayTitle = titleKey ? t(locale, titleKey) : title ?? "";
  const hoverTitle = hoverKey ? t(locale, hoverKey) : displayTitle;

  const characterSet = getScrambleCharacterSet(locale, page);

  const currentText = isHovered ? hoverTitle : displayTitle;
  const titleClassName = cn(
    "text-foreground",
    variant === "reader" ? TITLE_READER : TITLE_POETIC,
    useScramble && "cursor-default"
  );

  const titleJsx = (
    <header
      onMouseEnter={() => useScramble && setIsHovered(true)}
      onMouseLeave={() => useScramble && setIsHovered(false)}
    >
      {useScramble ? (
        <TextScramble
          as="h1"
          duration={0.5}
          speed={0.03}
          characterSet={characterSet}
          className={titleClassName}
        >
          {currentText}
        </TextScramble>
      ) : (
        <h1 className={titleClassName}>{displayTitle}</h1>
      )}
    </header>
  );

  return (
    <main
      data-variant={variant}
      className={cn(
        "mx-auto max-w-[680px] px-6 pt-16 sm:pt-24 pb-32 sm:pb-40",
        className
      )}
    >
      {variant === "reader" ? (
        <>
          {/* `reader-masthead` hands the title's size and the gap under it to
              the reading-size system in globals.css, so the whole composition
              moves when the reader changes the type size -- not the body
              alone. The Tailwind sizes below stay as the fallback. */}
          <div className="reader-masthead mb-12 sm:mb-14">
            <SystemNav href={backHref} path={backLabel} className="mb-8 sm:mb-12" />
            {titleJsx}
            {headerActions && <div className="mt-4">{headerActions}</div>}
          </div>
          {children}
        </>
      ) : (
        <>
          <HeaderZone
            className="hero-zone-fade sticky top-16 sm:top-24 z-10 mb-4 sm:mb-6"
            style={heroFadeStyle}
          >
            <div className="h-11 flex items-start">
              <SystemNav href={backHref} path={backLabel} />
            </div>
            <div
              className={cn(
                "flex-1 flex flex-col justify-center",
                headerActions && "pb-6 sm:pb-4"
              )}
            >
              <div className="relative">
                {titleJsx}
                {headerActions && (
                  <div className="absolute left-0 top-full w-max mt-2">
                    {headerActions}
                  </div>
                )}
              </div>
            </div>
          </HeaderZone>
          <div className="relative z-20">{children}</div>
        </>
      )}

    </main>
  );
}
