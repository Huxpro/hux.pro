"use client";

import { TITLE_POETIC } from "@/components/ui/header-zone";
import Link from "next/link";
import { t, useLocale, useVisitor } from "@/services";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { getAmbientGreetingKeyFromPhase } from "../lib/greeting";
import { useAmbientTime } from "../provider";

/**
 * `eyebrow` is a line set over the greeting (the home screen's weather line).
 * Like the context line under it, it is positioned out of flow, so the
 * greeting holds the same place whether either is there or not.
 */
export function AmbientGreeting({ eyebrow }: { eyebrow?: ReactNode } = {}) {
  const { locale } = useLocale();
  const { lastVisited, isReturningVisitor, daysSinceLastVisit } = useVisitor();
  const { phase } = useAmbientTime();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const greetingKey = useMemo(
    () => getAmbientGreetingKeyFromPhase(phase),
    [phase]
  );

  const timeGreeting = t(locale, greetingKey);

  let contextMessage: ReactNode = null;

  if (mounted && isReturningVisitor && lastVisited) {
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 7) {
      contextMessage = (
        <span className="block w-full text-muted-foreground">
          {t(locale, "greetingLongTime")}
        </span>
      );
    } else {
      const title = lastVisited.href ? (
        <Link
          href={lastVisited.href}
          className="font-serif italic text-foreground decoration-foreground/30 decoration-1 underline-offset-4 transition-colors hover:underline hover:text-foreground/70"
        >
          {lastVisited.title}
        </Link>
      ) : (
        <span className="font-serif italic text-foreground">
          {lastVisited.title}
        </span>
      );
      contextMessage = (
        <span className="block w-full">
          <span className="text-muted-foreground">
            {t(locale, "greetingLastReading")}{" "}
          </span>
          {title}
          <span className="text-muted-foreground">.</span>
        </span>
      );
    }
  } else if (mounted && isReturningVisitor) {
    contextMessage = (
      <span className="block w-full text-muted-foreground">
        {t(locale, "greetingWelcomeBack")}
      </span>
    );
  }

  return (
    <div className="relative w-full text-center system-voice cursor-default">
      {eyebrow && (
        <div className="absolute left-0 right-0 bottom-full mb-2">
          {eyebrow}
        </div>
      )}
      <h1 className={`${TITLE_POETIC} text-foreground`}>
        {timeGreeting}
      </h1>
      {contextMessage && (
        <p className="absolute left-0 right-0 top-full mt-2 text-sm sm:text-base leading-relaxed">
          {contextMessage}
        </p>
      )}
    </div>
  );
}
