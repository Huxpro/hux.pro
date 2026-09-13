"use client";

import { TITLE_POETIC } from "@/components/ui/header-zone";
import { cn } from "@/lib/utils";
import Link from "next/link";
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
    <div className="relative w-full text-center">
      <h1 className={`${TITLE_POETIC} text-foreground`}>
        {timeGreeting}
      </h1>
      {/*
        In-flow slot (not absolute) so HomeStage can size the chrome from
        real content. min-height holds the returning-visitor line so the
        board doesn't jump after hydration.
      */}
      <p
        className={cn(
          "mt-2 text-sm sm:text-base leading-relaxed min-h-[1.5em]",
          !contextMessage && "invisible",
        )}
      >
        {contextMessage ?? "\u00a0"}
      </p>
    </div>
  );
}
