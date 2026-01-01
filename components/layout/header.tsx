"use client";

import { Languages } from "lucide-react";
import { useLocale } from "@/components/providers";
import { localeNames } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Header() {
  const { locale, setLocale } = useLocale();

  const toggleLocale = () => {
    setLocale(locale === "en" ? "zh" : "en");
  };

  return (
    <header className="fixed top-0 right-0 z-30 p-4">
      <button
        onClick={toggleLocale}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5",
          "text-sm font-medium",
          "bg-background/80 backdrop-blur-sm",
          "border border-border/50 rounded-full",
          "text-muted-foreground hover:text-foreground",
          "transition-all hover:border-border"
        )}
        aria-label={`Switch to ${locale === "en" ? "中文" : "English"}`}
      >
        <Languages className="h-4 w-4" />
        <span className="font-mono text-xs">
          {localeNames[locale === "en" ? "zh" : "en"]}
        </span>
      </button>
    </header>
  );
}
