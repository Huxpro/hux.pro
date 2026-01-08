"use client";

import { WeatherIcon } from "@/components/ambient/weather-icon";
import {
  useDebug,
  useAmbientTime,
  useLocale,
  useLocation,
  useTheme,
  useWeather,
} from "@/components/providers";
import {
  getSunEventGradient,
  getWeatherGradient,
} from "@/lib/ambient/gradient";
import {
  WEATHER_CONDITIONS,
  getWeatherConditionLabel,
} from "@/lib/ambient/weather";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Bug,
  ChevronUp,
  Clock,
  Cloud,
  Haze,
  Moon,
  MoonStar,
  RefreshCw,
  Sun,
  SunDim,
  SunMedium,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";

// =============================================================================
// Debug FAB Component
// A foldable floating action button for debug tools
// Positioned at top-right, similar to Next.js dev tools
//
// When collapsed: Shows "Debug" button with keyboard hint
// When expanded: FAB hides, panel shows with close button
// =============================================================================

export function DebugFAB() {
  const { locale } = useLocale();
  const { isFABEnabled, isOpen, toggle } = useDebug();

  // Don't render if FAB is not enabled
  if (!isFABEnabled) return null;

  return (
    <div
      className={cn(
        "fixed z-50 transition-all duration-300 ease-out",
        "top-4 right-4",
        // When open, expand to panel width
        isOpen ? "w-[420px] max-w-[calc(100vw-2rem)]" : "w-auto"
      )}
    >
      {/* Collapsed FAB button - hides when panel is open */}
      <button
        onClick={toggle}
        className={cn(
          "flex items-center gap-2 transition-all duration-300",
          "rounded-full",
          "bg-foreground text-background",
          "shadow-lg shadow-black/20",
          "hover:scale-105 active:scale-95",
          // Hide when expanded
          isOpen ? "opacity-0 pointer-events-none scale-75" : "opacity-100",
          // Size
          "h-10 px-4"
        )}
        aria-label="Open debug panel"
      >
        <Bug className="h-4 w-4" />
        <span className="text-xs font-mono uppercase tracking-wider">
          {locale === "zh" ? "调试" : "Debug"}
        </span>
        <kbd className="text-[10px] font-mono opacity-60 ml-1">D</kbd>
      </button>

      {/* Expanded panel */}
      <div
        className={cn(
          "absolute top-0 right-0 w-full",
          "transition-all duration-300 ease-out",
          "origin-top-right",
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
        )}
      >
        <DebugPanel />
      </div>
    </div>
  );
}

// =============================================================================
// Debug Panel Component
// The expanded panel containing debug modules
// More compact layout with scrollable content
// =============================================================================

function DebugPanel() {
  const { locale } = useLocale();
  const { close, toggleFAB } = useDebug();

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden",
        "bg-popover/95 backdrop-blur-xl",
        "border border-border/50",
        "shadow-2xl shadow-black/20"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-foreground" />
          <span className="text-sm font-mono text-foreground">
            {locale === "zh" ? "调试面板" : "Debug Panel"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            DEV
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close debug panel"
          >
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Scrollable content - max height with scroll on mobile */}
      <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto">
        <WeatherModule />
        <AmbientTimeModule />
        <RefetchModule />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">
            {locale === "zh" ? "按 D 切换" : "Press D to toggle"}
          </span>
          <button
            onClick={toggleFAB}
            className="flex items-center gap-1 font-mono hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            <span>{locale === "zh" ? "关闭 FAB" : "Disable FAB"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Debug Section Component
// Wrapper for individual debug tool sections
// =============================================================================

interface DebugSectionProps {
  title: string;
  icon?: React.ReactNode;
  /** Optional action element to render on the right side of the header */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function DebugSection({
  title,
  icon,
  action,
  children,
}: DebugSectionProps) {
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div className="px-4 py-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {icon}
            {title}
          </div>
          {action}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

// =============================================================================
// Weather Module
// Override weather conditions for testing gradient backgrounds
// =============================================================================

function WeatherModule() {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const {
    weather,
    debugOverride,
    isOverrideEnabled,
    setDebugOverride,
    setOverrideEnabled,
  } = useWeather();

  const effectiveCondition = debugOverride?.condition ?? weather?.condition;
  const effectiveIsDay = debugOverride?.isDay ?? weather?.isDay;

  return (
    <DebugSection
      title={t(locale, "widgetWeather")}
      icon={<Cloud className="h-4 w-4" />}
      action={
        <button
          onClick={() => setOverrideEnabled(!isOverrideEnabled)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
            isOverrideEnabled
              ? "bg-green-500/90 border-green-500/70"
              : "bg-muted/40 border-border/60"
          )}
          aria-pressed={isOverrideEnabled}
          aria-label="Toggle weather override"
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
              isOverrideEnabled ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      }
    >
      <div className="space-y-3">
        {/* Day conditions */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Sun className="h-3 w-3" />
            <span>{t(locale, "timeDay")}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {Object.keys(WEATHER_CONDITIONS).map((k) => {
              const condition = k as keyof typeof WEATHER_CONDITIONS;
              const isSelected =
                isOverrideEnabled &&
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
                    setDebugOverride({ condition, isDay: true });
                    setOverrideEnabled(true);
                  }}
                  className={cn(
                    "relative rounded-lg aspect-square",
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
                  title={getWeatherConditionLabel(condition, locale)}
                >
                  <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                  <div className="absolute inset-0 flex items-center justify-center text-foreground/70">
                    <WeatherIcon
                      condition={condition}
                      isDay={true}
                      className="h-3.5 w-3.5"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Night conditions */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <Moon className="h-3 w-3" />
            <span>{t(locale, "timeNight")}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {Object.keys(WEATHER_CONDITIONS).map((k) => {
              const condition = k as keyof typeof WEATHER_CONDITIONS;
              const isSelected =
                isOverrideEnabled &&
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
                    setDebugOverride({ condition, isDay: false });
                    setOverrideEnabled(true);
                  }}
                  className={cn(
                    "relative rounded-lg aspect-square",
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
                  title={getWeatherConditionLabel(condition, locale)}
                >
                  <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                  <div className="absolute inset-0 flex items-center justify-center text-foreground/70">
                    <WeatherIcon
                      condition={condition}
                      isDay={false}
                      className="h-3.5 w-3.5"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Ambient Time Module
// Simulate sunrise/sunset window (affects Greeting + Gradient)
// =============================================================================

function AmbientTimeModule() {
  const { locale } = useLocale();
  const { theme } = useTheme();
  const { weather } = useWeather();
  const {
    phase,
    derivedPhase,
    overridePhase,
    isOverrideEnabled,
    setOverrideEnabled,
    setOverridePhase,
  } = useAmbientTime();

  const sunriseMs = weather?.sunriseMs;
  const sunsetMs = weather?.sunsetMs;

  const formatTime = (ms?: number) => {
    if (typeof ms !== "number") return "--:--";
    try {
      return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(ms));
    } catch {
      return "--:--";
    }
  };

  const labelForPhase = (p: typeof phase) => {
    const mapEn: Record<typeof phase, string> = {
      sunrise: "Sunrise",
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      sunset: "Sunset",
      night: "Night",
    };
    const mapZh: Record<typeof phase, string> = {
      sunrise: "日出",
      morning: "早晨",
      afternoon: "下午",
      evening: "傍晚",
      sunset: "日落",
      night: "夜晚",
    };
    return locale === "zh" ? mapZh[p] : mapEn[p];
  };

  const PhaseButton = ({
    p,
    icon,
    aria,
    gradientBg,
  }: {
    p: typeof phase;
    icon: React.ReactNode;
    aria: string;
    gradientBg?: string;
  }) => {
    const isSelected = isOverrideEnabled && overridePhase === p;
    return (
      <button
        onClick={() => {
          setOverridePhase(p);
          setOverrideEnabled(true);
        }}
        className={cn(
          "relative rounded-xl aspect-square",
          "border transition-all duration-200",
          "overflow-hidden",
          isSelected
            ? "border-foreground/60 ring-2 ring-foreground/50"
            : "border-border/40 hover:border-border",
          !isOverrideEnabled ? "opacity-70" : ""
        )}
        style={gradientBg ? { backgroundImage: gradientBg } : undefined}
        aria-label={aria}
        title={labelForPhase(p)}
      >
        {gradientBg ? (
          <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
        ) : (
          <div className="absolute inset-0 bg-muted/10" />
        )}
        <div className="absolute inset-0 flex items-center justify-center text-foreground/70">
          {icon}
        </div>
      </button>
    );
  };

  const sunriseGradient = getSunEventGradient({
    event: "sunrise",
    theme,
  }).backgroundImage;
  const sunsetGradient = getSunEventGradient({
    event: "sunset",
    theme,
  }).backgroundImage;

  return (
    <DebugSection
      title={locale === "zh" ? "TIME OF DAY" : "TIME OF DAY"}
      icon={<Clock className="h-4 w-4" />}
      action={
        <button
          onClick={() => setOverrideEnabled(!isOverrideEnabled)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
            isOverrideEnabled
              ? "bg-green-500/90 border-green-500/70"
              : "bg-muted/40 border-border/60"
          )}
          aria-pressed={isOverrideEnabled}
          aria-label="Toggle time of day override"
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
              isOverrideEnabled ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
      }
    >
      <div className="space-y-3">
        {/* Sunrise / Sunset times + current */}
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <Sunrise className="h-3.5 w-3.5" />
              <span>{formatTime(sunriseMs)}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Sunset className="h-3.5 w-3.5" />
              <span>{formatTime(sunsetMs)}</span>
            </span>
          </div>
          <div className="text-right">
            <span>{locale === "zh" ? "当前: " : "Current: "}</span>
            <span className="text-foreground/80">
              {labelForPhase(isOverrideEnabled ? phase : derivedPhase)}
            </span>
          </div>
        </div>

        {/* Phase buttons (icons only) */}
        <div className="grid grid-cols-6 gap-1.5">
          <PhaseButton
            p="sunrise"
            icon={<Sunrise className="h-3.5 w-3.5" />}
            aria="Set phase to sunrise"
            gradientBg={sunriseGradient}
          />
          <PhaseButton
            p="morning"
            icon={<Haze className="h-3.5 w-3.5" />}
            aria="Set phase to morning"
          />
          <PhaseButton
            p="afternoon"
            icon={<SunMedium className="h-3.5 w-3.5" />}
            aria="Set phase to afternoon"
          />
          <PhaseButton
            p="sunset"
            icon={<Sunset className="h-3.5 w-3.5" />}
            aria="Set phase to sunset"
            gradientBg={sunsetGradient}
          />
          <PhaseButton
            p="evening"
            icon={<Moon className="h-3.5 w-3.5" />}
            aria="Set phase to evening"
          />
          <PhaseButton
            p="night"
            icon={<MoonStar className="h-3.5 w-3.5" />}
            aria="Set phase to night"
          />
        </div>
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Refetch Module
// Force re-request location + weather
// =============================================================================

function RefetchModule() {
  const { locale } = useLocale();
  const { refresh: refreshLocation, isFetching: locationFetching } =
    useLocation();
  const { refresh: refreshWeather, isFetching: weatherFetching } = useWeather();

  const busy = locationFetching || weatherFetching;

  return (
    <DebugSection
      title={locale === "zh" ? "刷新" : "Refetch"}
      icon={<RefreshCw className="h-4 w-4" />}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => refreshLocation()}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2",
            "text-xs font-mono transition-colors",
            "border-border/50 hover:border-border",
            busy ? "opacity-60" : ""
          )}
          aria-label="Refetch location"
        >
          {locale === "zh" ? "重请求位置" : "Location"}
        </button>
        <button
          onClick={() => refreshWeather()}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2",
            "text-xs font-mono transition-colors",
            "border-border/50 hover:border-border",
            busy ? "opacity-60" : ""
          )}
          aria-label="Refetch weather"
        >
          {locale === "zh" ? "重请求天气" : "Weather"}
        </button>
      </div>
      <div className="mt-2 text-[10px] font-mono text-muted-foreground">
        {locale === "zh"
          ? "提示：天气刷新会同时刷新位置与天气。"
          : "Note: Weather refresh invalidates both location and weather."}
      </div>
    </DebugSection>
  );
}
