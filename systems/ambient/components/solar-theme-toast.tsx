"use client";

import { GLASS_PANEL } from "@/lib/glass";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Sunrise, Sunset } from "lucide-react";
import type { SolarTheme } from "../lib/solar-theme";
import type { SunEvent } from "../lib/sun";

// ---------------------------------------------------------------------------
// The sun-switch notice.
//
// The theme changed and nobody asked for it, so the notice has one job: say
// that the system did this, that it is only for this session, and that the
// saved Appearance preference has not moved. It arrives the way the language
// notice does — a card in the bottom-center toast slot — because it is the
// same kind of event: the system taking a choice the user did not make, and
// offering it back.
//
// Two ways to take it back, both one tap: Undo drops this switch, Turn off
// drops the whole behaviour (the setting lives in the wallpaper picker's
// Weather group, and in the command palette).
// ---------------------------------------------------------------------------

const TOAST_BUTTON = cn(
  "flex-1 rounded-lg border border-border/50 px-4 py-2",
  "text-sm text-muted-foreground whitespace-nowrap transition-colors",
  "hover:bg-accent hover:text-foreground active:scale-[0.98]"
);

interface SolarThemeToastProps {
  event: SunEvent;
  /** The theme the sun just put the app in. */
  theme: SolarTheme;
  /** The event's clock time, formatted; empty when it is not known. */
  timeLabel: string;
  onUndo: () => void;
  onTurnOff: () => void;
}

export function SolarThemeToast({
  event,
  theme,
  timeLabel,
  onUndo,
  onTurnOff,
}: SolarThemeToastProps) {
  const { locale } = useLocale();
  const Icon = event === "sunrise" ? Sunrise : Sunset;

  return (
    <div
      className={cn(
        GLASS_PANEL,
        "w-full max-w-md shadow-overlay",
        "animate-in slide-in-from-bottom-4 fade-in duration-200"
      )}
    >
      <div className="px-4 pt-4 pb-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
            <Icon className="size-3.5 text-foreground/80" />
          </span>
          <span className={TYPE.label}>
            {t(locale, event === "sunrise" ? "phaseSunrise" : "phaseSunset")}
            {timeLabel && (
              <span className="normal-case tabular-nums"> · {timeLabel}</span>
            )}
          </span>
        </div>
        <p className={TYPE.body}>
          {t(locale, theme === "light" ? "solarThemeToLight" : "solarThemeToDark")}
        </p>
        <p className={cn(TYPE.captionQuiet, "mt-1")}>{t(locale, "solarThemeNote")}</p>
      </div>

      <div className="flex gap-2 px-3 pb-3">
        <button type="button" onClick={onUndo} className={TOAST_BUTTON}>
          {t(locale, "solarThemeUndo")}
        </button>
        <button type="button" onClick={onTurnOff} className={TOAST_BUTTON}>
          {t(locale, "solarThemeTurnOff")}
        </button>
      </div>
    </div>
  );
}
