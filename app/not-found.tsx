"use client";

import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { TITLE_POETIC } from "@/components/ui/header-zone";
import { useLocale, t } from "@/services";
import { cn } from "@/lib/utils";
import { Link } from "next-view-transitions";
import { useState } from "react";

// =============================================================================
// 404 Identifier with Scramble Effect
// =============================================================================

function NotFoundIdentifier() {
  const [isHovered, setIsHovered] = useState(false);
  const targetText = isHovered ? "not found" : "404";

  return (
    <div className="text-center mb-12">
      <span
        className={cn(
          "font-mono text-xs tracking-wider relative inline-block cursor-default select-none transition-colors duration-300",
          isHovered ? "text-foreground" : "text-muted-foreground"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TextScramble
          trigger={true}
          duration={0.6}
          speed={0.03}
          characterSet="0123456789!@#$%^&*"
          as="span"
          className="inline-block"
        >
          {targetText}
        </TextScramble>
      </span>
    </div>
  );
}

// =============================================================================
// Return Home Button with Scramble Effect
// =============================================================================

function ReturnHomeButton() {
  const [isHovered, setIsHovered] = useState(false);
  const targetText = isHovered ? "λhux" : "cd ~";

  return (
    <div className="text-center">
      <Link
        href="/"
        className={cn(
          "inline-flex items-center gap-2 px-5 py-3 rounded-2xl select-none",
          "bg-glass backdrop-blur-xl",
          "border border-border/50",
          "text-sm text-foreground",
          "transition-all duration-300",
          "hover:border-border hover:bg-glass-hover"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <TextScramble
          trigger={true}
          duration={0.4}
          speed={0.03}
          characterSet="abcdefghijklmnopqrstuvwxyz~λ"
          as="span"
          className="font-mono text-xs"
        >
          {targetText}
        </TextScramble>
      </Link>
    </div>
  );
}

// =============================================================================
// 404 Page
// =============================================================================

export default function NotFound() {
  const { locale } = useLocale();

  return (
    <main className="mx-auto max-w-[680px] px-6 pt-12 sm:pt-24 pb-32 sm:pb-40 min-h-screen flex flex-col justify-center">
      {/* 404 identifier with scramble effect */}
      <NotFoundIdentifier />

      {/* 404 Message - Hux speaking to the user */}
      <div className="text-center mb-16 select-none cursor-default">
        <h1 className={`${TITLE_POETIC} text-foreground`}>
          {t(locale, "notFoundMessage")}
        </h1>

        {/* Subtle hint */}
        <p className="mt-6 text-muted-foreground text-sm sm:text-base">
          {t(locale, "notFoundHint")}
        </p>
      </div>

      {/* Navigation - cd ~ scrambles to λhux */}
      <ReturnHomeButton />
    </main>
  );
}
