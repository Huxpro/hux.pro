"use client";

import { useLocale, useVisitor, t } from "@/services";
import { useAmbientTime } from "../provider";
import { getAmbientGreetingKeyFromPhase } from "../lib/greeting";
import { type ReactNode, useEffect, useMemo, useState } from "react";

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

  if (!mounted) {
    return <div className="min-h-[120px]" />;
  }

  const timeGreeting = t(locale, greetingKey);

  let contextMessage: ReactNode = null;

  if (isReturningVisitor && lastVisited) {
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 7) {
      contextMessage = (
        <span className="block mt-2 text-muted-foreground">
          {t(locale, "greetingLongTime")}
        </span>
      );
    } else {
      contextMessage = (
        <span className="block mt-2">
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
  } else if (isReturningVisitor) {
    contextMessage = (
      <span className="block mt-2 text-muted-foreground">
        {t(locale, "greetingWelcomeBack")}
      </span>
    );
  }

  return (
    <div className="text-center mb-16">
      <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
        {timeGreeting}
      </h1>
      {contextMessage && (
        <p className="mt-3 text-base sm:text-lg leading-relaxed">
          {contextMessage}
        </p>
      )}
    </div>
  );
}
