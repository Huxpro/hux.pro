"use client";

import { GLASS_PANEL } from "@/lib/glass";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Sunrise, Sunset } from "lucide-react";
import type { SolarTheme } from "../lib/solar-theme";

// ---------------------------------------------------------------------------
// The sun-switch notice.
//
// The theme changed and nobody asked for it, so it says so — but quietly. It
// is the small pill the language switch uses, not a card with buttons: by the
// time it lands the change has already dissolved in over two seconds, so there
// is nothing to confirm and nothing to undo in a hurry. One line: which event,
// which mode, and that the saved Appearance preference has not moved. The way
// to turn it off is where settings live — the wallpaper picker's Weather
// group, or the command palette.
// ---------------------------------------------------------------------------

interface SolarThemeToastProps {
  /** The theme the sun just put the app in — which says which event it was. */
  theme: SolarTheme;
}

export function SolarThemeToast({ theme }: SolarThemeToastProps) {
  const { locale } = useLocale();
  const Icon = theme === "light" ? Sunrise : Sunset;

  return (
    <div
      className={cn(
        GLASS_PANEL,
        "inline-flex items-center gap-3 rounded-full px-4 py-3 shadow-raised",
        "animate-in slide-in-from-bottom-2 fade-in duration-200"
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn(TYPE.body, "whitespace-nowrap")}>
        <span className="font-medium text-foreground">
          {t(locale, theme === "light" ? "solarThemeToLight" : "solarThemeToDark")}
        </span>
        <span className="text-tertiary-foreground">
          {" · "}
          {t(locale, "solarThemeNote")}
        </span>
      </span>
    </div>
  );
}
