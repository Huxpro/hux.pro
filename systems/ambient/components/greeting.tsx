"use client";

import { TITLE_POETIC } from "@/components/ui/header-zone";
import { t, useLocale, useVisitor } from "@/services";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { getAmbientGreetingKeyFromPhase } from "../lib/greeting";
import { useAmbientTime } from "../provider";

export function AmbientGreeting() {
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
      contextMessage = (
        <span className="block w-full">
          <span className="text-muted-foreground">
            {t(locale, "greetingLastReading")}{" "}
          </span>
          <span className="font-serif italic text-foreground">
            {lastVisited.title}
          </span>
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
    <div className="relative w-full text-center">
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
