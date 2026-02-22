"use client";

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

  // Build context message only after mount to avoid hydration mismatch
  let contextMessage: ReactNode = null;

  if (mounted && isReturningVisitor && lastVisited) {
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 7) {
      contextMessage = (
        <span className="mt-2 block w-full text-muted-foreground">
          {t(locale, "greetingLongTime")}
        </span>
      );
    } else {
      contextMessage = (
        <span className="mt-2 block w-full">
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
      <span className="mt-2 block w-full text-muted-foreground">
        {t(locale, "greetingWelcomeBack")}
      </span>
    );
  }

  return (
    <div className="relative w-full text-center">
      <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
        {timeGreeting}
      </h1>
      {contextMessage && (
        <p className="absolute left-0 right-0 top-full text-sm sm:text-base leading-relaxed">
          {contextMessage}
        </p>
      )}
    </div>
  );
}
