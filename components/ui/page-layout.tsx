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
import { ShrinkToWindow } from "@/systems/windows/components/shrink-control";
import { useState, type ReactNode } from "react";
import {
  heroContentClassName,
  heroZoneClassName,
  heroZoneStyle,
  useHeroExit,
} from "./hero-exit";
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
  /**
   * A bar that rests where `headerActions` would and stays: it rides up with
   * the content and pins at the top of the page instead of fading with the
   * hero. Instead of `headerActions`, not with it; the `poetic` header only.
   */
  pinnedActions?: ReactNode;
  /** Title typography variant */
  variant?: "poetic" | "reader";
  /**
   * When set, the nav row offers to shrink this fullscreen page into that
   * built-in app's window and return to the desktop.
   */
  shrinkApp?: string;
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
  pinnedActions,
  shrinkApp,
  variant = "poetic",
  className,
  children,
}: PageLayoutProps) {
  const { locale } = useLocale();
  const [isHovered, setIsHovered] = useState(false);
  const heroExit = useHeroExit();
  const heroFadeStyle = useHeroFade(heroExit === "fade");

  const useScramble = !!page;

  const titleKey = page ? (`${page}Title` as TranslationKey) : undefined;
  const hoverKey = page ? (`${page}TitleHover` as TranslationKey) : undefined;

  const displayTitle = titleKey ? t(locale, titleKey) : title ?? "";
  const hoverTitle = hoverKey ? t(locale, hoverKey) : displayTitle;

  const characterSet = getScrambleCharacterSet(locale, page);

  const currentText = isHovered ? hoverTitle : displayTitle;
  const titleClassName = cn(
    "text-foreground",
    variant === "reader" ? TITLE_READER : TITLE_POETIC
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
        // The column and its gutter are `--page-col` / `--page-gutter`
        // (globals.css), so a rail that bleeds past the column (`--page-bleed`)
        // reads the same numbers.
        "mx-auto max-w-[var(--page-col)] px-[var(--page-gutter)] pt-16 sm:pt-24 pb-32 sm:pb-40",
        // Title foot to hero bottom when a bar is pinned: what centring put
        // there when the actions sat in the zone (`h-44`/`h-48`, less the
        // nav, the `pb-6`/`pb-4` reserve and half the spare), kept so the
        // page looks the same at rest.
        pinnedActions && "[--pin-rest:3.75rem] sm:[--pin-rest:3.875rem]",
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
            <div className="mb-8 flex items-start justify-between gap-3 sm:mb-12">
              <SystemNav href={backHref} path={backLabel} className="mb-0" />
              {shrinkApp && <ShrinkToWindow appId={shrinkApp} />}
            </div>
            {titleJsx}
            {headerActions && <div className="mt-4">{headerActions}</div>}
          </div>
          {children}
        </>
      ) : (
        <>
          <HeaderZone
            data-hero-exit={heroExit}
            className={heroZoneClassName(heroExit, !heroFadeStyle, "system-voice")}
            style={heroZoneStyle(heroExit, heroFadeStyle)}
          >
            <div className="flex h-11 items-start justify-between gap-3">
              <SystemNav href={backHref} path={backLabel} />
              {shrinkApp && <ShrinkToWindow appId={shrinkApp} />}
            </div>
            <div
              className={cn(
                "flex-1 flex flex-col",
                // A pinned bar is not in this zone (it has to outlive the
                // hero's fade), so the title is set by its foot instead of
                // centred: `--pin-rest` below it, the same number the bar
                // is lifted by. They cannot drift apart, and the pair lands
                // where the centred title and its actions always did.
                pinnedActions
                  ? "justify-end pb-[var(--pin-rest)]"
                  : "justify-center",
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
          <div className={heroContentClassName(heroExit)}>
            {pinnedActions && (
              // Zero-height and sticky, so the bar pins without taking room
              // from the content: lifted out of the flow to rest half a
              // line under the title (the hero's bottom margin, then
              // `--pin-rest`, then back down the 0.5rem gap), and given the
              // same back as bottom margin. Above the content's own layers
              // (the chapter markers are `z-20`) so rows pass under it. It
              // pins a rem from the top, or half a rem under the Dock's
              // Live Activities when there are any (`--dock-clear`).
              <div
                className="sticky top-[max(1rem,calc(var(--dock-clear)+0.5rem))] z-30 h-0 -mt-[calc(var(--pin-rest)-0.5rem+var(--hero-gap))] mb-[calc(var(--pin-rest)-0.5rem+var(--hero-gap))]"
              >
                {pinnedActions}
              </div>
            )}
            {children}
          </div>
        </>
      )}

    </main>
  );
}
