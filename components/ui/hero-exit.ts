"use client";

import { isIOSBrowser } from "@/systems/ambient/lib/platform";
import {
  useOptionalDevtool,
  type HeroExit,
} from "@/systems/devtool/provider";
import { cn } from "@/lib/utils";
import { useEffect, useState, type CSSProperties } from "react";

export type { HeroExit };

/**
 * How the hero leaves as the page scrolls.
 *
 *   scroll  in flow: the hero rides the page up and off — the home screen
 *           when this mode is on.
 *   fade    sticky: the hero holds and phases out while the content slides
 *           over it — the blog / work / prompt look.
 *
 * The platform picks the default. Both modes are real; the DevTool pins
 * either for the session so we can choose per-platform later without a
 * code change in two places.
 */
export function defaultHeroExit(_isIOS: boolean | null): HeroExit {
  // Same on every platform today. iOS may want `fade` and desktop `scroll`
  // (or the reverse) — change only this function when we pick.
  return "fade";
}

/** Resolved hero-exit, honouring a DevTool session pin when the panel is on. */
export function useHeroExit(): HeroExit {
  const [isIOS, setIsIOS] = useState<boolean | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: platform read
    setIsIOS(isIOSBrowser());
  }, []);

  const devtool = useOptionalDevtool();
  const override = devtool?.isEnabled ? devtool.heroExitOverride : undefined;
  return override ?? defaultHeroExit(isIOS);
}

/**
 * Class names for a HeaderZone that respects the current hero-exit.
 * `cssFade` is true when the CSS scroll timeline is driving the fade
 * (no JS fallback style); the `.hero-zone-fade` class is what the CSS
 * matches, so it stays off while JS owns opacity.
 */
export function heroZoneClassName(
  exit: HeroExit,
  cssFade: boolean,
  extra?: string
): string {
  return cn(
    extra,
    // `--hero-gap` (globals.css) so a bar pinned out of the zone can be
    // lifted back over it by the same amount (PageLayout `pinnedActions`).
    "mb-[var(--hero-gap)]",
    exit === "fade" && "sticky top-16 sm:top-24 z-10",
    exit === "fade" && cssFade && "hero-zone-fade"
  );
}

export function heroZoneStyle(
  exit: HeroExit,
  fadeStyle: CSSProperties | undefined
): CSSProperties | undefined {
  return exit === "fade" ? fadeStyle : undefined;
}

/** Content that must slide over a sticky fading hero. */
export function heroContentClassName(exit: HeroExit, extra?: string): string {
  return cn(extra, exit === "fade" && "relative z-20");
}
