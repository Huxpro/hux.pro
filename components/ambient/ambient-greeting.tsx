"use client";

import { useAmbientTime, useLocale, useVisitor } from "@/components/providers";
import { getAmbientGreetingKeyFromPhase } from "@/lib/ambient/greeting";
import { t } from "@/lib/i18n";
import { type ReactNode, useEffect, useMemo, useState } from "react";

// Ambient Greeting Component - Hux speaking to the user
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
    // Prevent hydration mismatch
    return <div className="min-h-[120px]" />;
  }

  const timeGreeting = t(locale, greetingKey);

  // Determine contextual message
  let contextMessage: ReactNode = null;

  if (isReturningVisitor && lastVisited) {
    // Returning visitor who read something before
    if (daysSinceLastVisit !== null && daysSinceLastVisit > 7) {
      // Long time no see
      contextMessage = (
        <span className="block mt-2 text-muted-foreground">
          {t(locale, "greetingLongTime")}
        </span>
      );
    } else {
      // Recent visitor - show what they were reading
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
    // Returning but hasn't read anything specific
    contextMessage = (
      <span className="block mt-2 text-muted-foreground">
        {t(locale, "greetingWelcomeBack")}
      </span>
    );
  }

  return (
    <div className="text-center mb-16">
      {/* Time-based greeting - the main message */}
      <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
        {timeGreeting}
      </h1>
      {/* Contextual message */}
      {contextMessage && (
        <p className="mt-3 text-base sm:text-lg leading-relaxed">
          {contextMessage}
        </p>
      )}
    </div>
  );
}
