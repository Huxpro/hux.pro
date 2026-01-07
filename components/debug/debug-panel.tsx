"use client";

import { useAmbient, useLocale } from "@/components/providers";
import { useTheme } from "@/components/providers";
import { getWeatherGradient } from "@/lib/ambient/gradient";
import { WeatherIcon } from "@/components/ambient/weather-icon";
import { WEATHER_CONDITIONS, getWeatherConditionLabel } from "@/lib/ambient/weather";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { Cloud, Moon, Sun } from "lucide-react";

function WeatherModule() {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const {
    weather,
    debugWeatherOverride,
    debugWeatherOverrideEnabled,
    setDebugWeatherOverride,
    setDebugWeatherOverrideEnabled,
  } = useAmbient();

  const effectiveCondition = debugWeatherOverride?.condition ?? weather?.condition;
  const effectiveIsDay = debugWeatherOverride?.isDay ?? weather?.isDay;

  return (
    <div className="space-y-4">
      {/* Header row (like Next.js-style module header) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Cloud className="h-4 w-4" />
          <span>{t(locale, "widgetWeather").toUpperCase()}</span>
        </div>

        {/* iOS-ish override toggle */}
        <button
          onClick={() => setDebugWeatherOverrideEnabled(!debugWeatherOverrideEnabled)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
            debugWeatherOverrideEnabled
              ? "bg-green-500/90 border-green-500/70"
              : "bg-muted/40 border-border/60"
          )}
          aria-pressed={debugWeatherOverrideEnabled}
          aria-label="Toggle weather override"
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-background shadow transition-transform",
              debugWeatherOverrideEnabled ? "translate-x-5" : "translate-x-1"
            )}
          />
        </button>
      </div>

      {/* Day */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Sun className="h-4 w-4" />
          <span>{t(locale, "timeDay")}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {Object.keys(WEATHER_CONDITIONS).map((k) => {
            const condition = k as keyof typeof WEATHER_CONDITIONS;
            const isSelected =
              debugWeatherOverrideEnabled &&
              effectiveIsDay !== false &&
              condition === effectiveCondition;
            const preview = getWeatherGradient({
              condition,
              isDay: true,
              theme,
            });
            return (
              <button
                key={`day-${condition}`}
                onClick={() => {
                  setDebugWeatherOverride({ condition, isDay: true });
                  setDebugWeatherOverrideEnabled(true);
                }}
                className={cn(
                  "relative rounded-2xl h-16",
                  "border transition-all duration-200",
                  "overflow-hidden",
                  isSelected
                    ? "border-foreground/60 ring-2 ring-foreground/50"
                    : "border-border/40 hover:border-border"
                )}
                style={{ backgroundImage: preview.backgroundImage }}
                aria-label={`Set day weather to ${getWeatherConditionLabel(
                  condition,
                  locale
                )}`}
              >
                <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                <div className="absolute inset-0 flex items-center justify-center text-foreground/70">
                  <WeatherIcon condition={condition} isDay={true} className="h-6 w-6" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Night */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <Moon className="h-4 w-4" />
          <span>{t(locale, "timeNight")}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {Object.keys(WEATHER_CONDITIONS).map((k) => {
            const condition = k as keyof typeof WEATHER_CONDITIONS;
            const isSelected =
              debugWeatherOverrideEnabled &&
              effectiveIsDay === false &&
              condition === effectiveCondition;
            const preview = getWeatherGradient({
              condition,
              isDay: false,
              theme,
            });
            return (
              <button
                key={`night-${condition}`}
                onClick={() => {
                  setDebugWeatherOverride({ condition, isDay: false });
                  setDebugWeatherOverrideEnabled(true);
                }}
                className={cn(
                  "relative rounded-2xl h-16",
                  "border transition-all duration-200",
                  "overflow-hidden",
                  isSelected
                    ? "border-foreground/60 ring-2 ring-foreground/50"
                    : "border-border/40 hover:border-border"
                )}
                style={{ backgroundImage: preview.backgroundImage }}
                aria-label={`Set night weather to ${getWeatherConditionLabel(
                  condition,
                  locale
                )}`}
              >
                <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                <div className="absolute inset-0 flex items-center justify-center text-foreground/70">
                  <WeatherIcon
                    condition={condition}
                    isDay={false}
                    className="h-6 w-6"
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function DebugPanel() {
  const { settings, debugPanelOpen, setDebugPanelOpen, setDebugFabEnabled } =
    useAmbient();

  // In dev, keep a small “nextjs-style” affordance: panel state persists in-memory.
  useEffect(() => {
    if (!settings.debugFabEnabled) {
      setDebugPanelOpen(false);
    }
  }, [settings.debugFabEnabled, setDebugPanelOpen]);

  const badgeText = debugPanelOpen ? "close" : "debug";

  if (!settings.debugFabEnabled) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col items-end">
      {/* Foldable FAB */}
      <button
        onClick={() => setDebugPanelOpen(!debugPanelOpen)}
        className={cn(
          "flex items-center gap-2",
          "bg-popover/80 backdrop-blur-xl",
          "border border-border/50 rounded-full",
          "shadow-lg shadow-black/10",
          "px-3 py-1.5",
          "text-xs font-mono text-muted-foreground hover:text-foreground",
          "transition-colors"
        )}
        aria-label="Toggle debug panel"
      >
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted/50 text-foreground">
          D
        </span>
        <span className="uppercase tracking-wider">{badgeText}</span>
      </button>

      {/* Panel */}
      <div
        className={cn(
          "origin-top-right transition-all duration-200 ease-out",
          debugPanelOpen
            ? "opacity-100 scale-100 translate-y-2 pointer-events-auto"
            : "opacity-0 scale-95 translate-y-1 pointer-events-none"
        )}
      >
        <div
          className={cn(
            "mt-2 w-[360px] rounded-2xl p-4",
            "bg-popover/85 backdrop-blur-xl",
            "border border-border/50",
            "shadow-2xl shadow-black/10"
          )}
        >
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-4">
            debug panel
          </div>

          {/* v1 modules */}
          <WeatherModule />

          <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
              fab
            </span>
            <button
              onClick={() => setDebugFabEnabled(false)}
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              turn off
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
