"use client";

import { BadgeLink } from "@/components/badge-link";
import { TYPE } from "@/lib/typography";
import { t, useLocale } from "@/services";
import { cn } from "@/lib/utils";
import { useSyncExternalStore } from "react";
import { useAbout } from "../provider";
import { GlowBorder } from "./glow-border";

function subscribeReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

/**
 * The About screen. It does not navigate: it floats over whatever page is
 * already up, blurs it, and rings the viewport with the edge light.
 */
export function AboutOverlay() {
  const { open, dismiss } = useAbout();
  const { locale } = useLocale();
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[10040] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="about-name">
      <button
        type="button"
        aria-label={t(locale, "aboutContinue")}
        className="absolute inset-0 cursor-default bg-background/55 backdrop-blur-2xl"
        onClick={dismiss}
      />
      <GlowBorder reducedMotion={reducedMotion} />
      <div className="pointer-events-none relative z-10 flex h-full items-center justify-center px-6">
        <div className="pointer-events-auto w-full max-w-[34rem] text-center">
          <p className={TYPE.label}>{t(locale, "about")}</p>
          <h1
            id="about-name"
            className="mt-3 font-serif text-3xl tracking-tight text-foreground sm:text-4xl"
          >
            {t(locale, "aboutName")}
          </h1>
          <p className={cn(TYPE.voice, "mx-auto mt-5 max-w-[32rem]")}>
            {t(locale, "aboutLead")}
          </p>
          <p className={cn(TYPE.body, "mx-auto mt-4 max-w-[30rem]")}>
            {t(locale, "aboutBody")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <BadgeLink href="https://lynxjs.org" icon="globe">Lynx</BadgeLink>
            <BadgeLink href="https://github.com/facebook/react" icon="github">React</BadgeLink>
            <BadgeLink
              kind="video"
              platform="bilibili"
              href="https://www.bilibili.com/video/BV1LY411Q7hC/"
            >
              COSCon
            </BadgeLink>
            <BadgeLink
              kind="slides"
              href="https://huxpro.github.io/jsconfcn2017/"
              title="Upgrading to Progressive Web Apps"
              thumbnail="/img/works/upgrading-to-pwa-cover.png"
            >
              JSConf
            </BadgeLink>
          </div>
          <p className={cn(TYPE.captionQuiet, "mt-8")}>{t(locale, "aboutCredits")}</p>
          <button
            type="button"
            onClick={dismiss}
            className={cn(TYPE.nav, "mt-4 inline-flex items-center gap-2")}
          >
            {t(locale, "aboutContinue")}
            <kbd className={TYPE.kbd}>esc</kbd>
          </button>
          <p className={cn(TYPE.labelSm, "mt-3")}>{t(locale, "aboutDismissHint")}</p>
        </div>
      </div>
    </div>
  );
}
