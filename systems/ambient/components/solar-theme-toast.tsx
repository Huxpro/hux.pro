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
// Under Follow the Sun the theme changes at sunrise and sunset with nobody
// touching anything, so it says so — but quietly. It is the small pill the
// language switch uses, not a card with buttons: by the time it lands the
// change has already dissolved in over two seconds, so there is nothing to
// confirm and nothing to undo in a hurry. One line: which event, which mode,
// and why — the Appearance it is following, which is where to change it.
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
      // The Android theme draws it as a snackbar (app/themes/android/system-ui.css).
      data-snackbar=""
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
