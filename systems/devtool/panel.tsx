"use client";

import { WeatherIcon } from "@/systems/ambient/components/weather-icon";
import { useLocale, useTheme, t } from "@/services";
import { useAmbientTime, useLocation, useWeather } from "@/systems/ambient";
import type { DevtoolGradientOverrides } from "@/systems/ambient/provider";
import { formatClockTime } from "@/systems/ambient/lib/format";
import {
  getSunEventGradient,
  getWeatherGradient,
} from "@/systems/ambient/lib/gradient";
import {
  WEATHER_CONDITIONS,
  getWeatherConditionLabel,
} from "@/systems/ambient/lib/weather";
import { useDevtool, DRAGGABLE_INSTANCES, DRAGGABLE_DEFAULTS } from "./provider";
import {
  usePreviewTuning,
  setPreviewTuning,
  resetPreviewTuning,
  PREVIEW_TUNING_DEFAULTS,
} from "@/components/motion-primitives/preview-tuning";
import { cn } from "@/lib/utils";
import {
  Brain,
  Bug,
  ChevronUp,
  Clock,
  Cloud,
  GripVertical,
  Haze,
  Layers,
  Moon,
  MoonStar,
  MousePointer2,
  RefreshCw,
  RotateCcw,
  Sun,
  SunMedium,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import { withDraggable } from "@/systems/draggable";
import { useEffect, useRef } from "react";

// =============================================================================
// Devtool FAB Component
// A foldable floating action button for devtools
// Positioned at top-right, similar to Next.js dev tools
// =============================================================================

function DevtoolFABInner() {
  const { locale } = useLocale();
  const { isEnabled, isOpen, toggle, signalDragReset } = useDevtool();

  // Reset drag position when devtool is toggled on (not fold/unfold)
  const prevEnabledRef = useRef(isEnabled);
  useEffect(() => {
    if (isEnabled && !prevEnabledRef.current) {
      signalDragReset("devtool");
    }
    prevEnabledRef.current = isEnabled;
  }, [isEnabled, signalDragReset]);

  // Don't render if devtool is not enabled
  if (!isEnabled) return null;

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
        aria-label="Open devtool panel"
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
        <DevtoolPanel />
      </div>
    </div>
  );
}

export const DevtoolFAB = withDraggable(DevtoolFABInner, {
  id: "devtool",
});

// =============================================================================
// Devtool Panel Component
// The expanded panel containing debug modules
// =============================================================================

function DevtoolPanel() {
  const { locale } = useLocale();
  const { close, toggleEnabled } = useDevtool();

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden cursor-default",
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
            {locale === "zh" ? "调试面板" : "Devtool Panel"}
          </span>
          <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            DEV
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close devtool panel"
          >
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="max-h-[50vh] sm:max-h-[60vh] overflow-y-auto">
        <GradientModule />
        <WeatherModule />
        <AmbientTimeModule />
        <HoverPreviewModule />
        <DraggableModule />
        <RefetchModule />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-mono">
            {locale === "zh" ? "按 D 切换" : "Press D to toggle"}
          </span>
          <button
            onClick={toggleEnabled}
            className="flex items-center gap-1 font-mono hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            <span>{locale === "zh" ? "关闭调试" : "Disable Devtool"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Debug Section Component
// =============================================================================

interface DebugSectionProps {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Tighter vertical padding for lightweight content (toggles, buttons) */
  compact?: boolean;
}

function DebugSection({ title, icon, action, children, compact }: DebugSectionProps) {
  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div className="px-4 py-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {icon}
            {title}
          </div>
          <div className="flex items-center min-h-5">{action}</div>
        </div>
      </div>
      <div className={cn("px-4", compact ? "py-2" : "py-3")}>{children}</div>
    </div>
  );
}

// =============================================================================
// Gradient Module
// =============================================================================

function GradientModule() {
  const { locale } = useLocale();
  const {
    gradientMode,
    fullGradientEnabled,
    widgetGradientEnabled,
    softEdgingEnabled,
    devtoolGradientOverrides,
    setDevtoolGradientOverrides,
  } = useWeather();

  const modeLabel =
    gradientMode === "full"
      ? locale === "zh" ? "全屏" : "Full"
      : gradientMode === "widget"
      ? locale === "zh" ? "卡片" : "Widget"
      : locale === "zh" ? "关闭" : "Off";

  const toggleOverride = (
    key: keyof DevtoolGradientOverrides,
    currentResolved: boolean
  ) => {
    const currentOverride = devtoolGradientOverrides[key];
    // Cycle: auto → on → off → auto
    let next: boolean | undefined;
    if (currentOverride === undefined) {
      next = !currentResolved; // override to opposite of natural
    } else {
      next = undefined; // clear override (back to auto)
    }
    setDevtoolGradientOverrides({ ...devtoolGradientOverrides, [key]: next });
  };

  const flags: {
    key: keyof DevtoolGradientOverrides;
    label: string;
    resolved: boolean;
  }[] = [
    { key: "full", label: locale === "zh" ? "全屏" : "Full", resolved: fullGradientEnabled },
    { key: "widget", label: locale === "zh" ? "卡片" : "Widget", resolved: widgetGradientEnabled },
    { key: "softEdging", label: locale === "zh" ? "柔和边缘" : "Soft Edge", resolved: softEdgingEnabled },
  ];

  return (
    <DebugSection
      title={locale === "zh" ? "渐变" : "Gradient"}
      icon={<Layers className="h-4 w-4" />}
      compact
      action={
        <span className="text-[10px] font-mono text-muted-foreground">
          {modeLabel}
          <span className="ml-1 text-muted-foreground/40">W</span>
        </span>
      }
    >
      <div className="space-y-2">
        {flags.map(({ key, label, resolved }) => {
          const isOverridden = devtoolGradientOverrides[key] !== undefined;
          return (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  {label}
                </span>
                {isOverridden && (
                  <span className="text-[9px] font-mono text-amber-500/70 uppercase">
                    *
                  </span>
                )}
              </div>
              <button
                onClick={() => toggleOverride(key, resolved)}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
                  resolved
                    ? "bg-green-500/90 border-green-500/70"
                    : "bg-muted/40 border-border/60",
                  isOverridden && "ring-1 ring-amber-500/40"
                )}
                aria-pressed={resolved}
                aria-label={`Toggle ${label}`}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
                    resolved ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Weather Module
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
                  aria-label={`Set day weather to ${getWeatherConditionLabel(condition, locale)}`}
                  title={getWeatherConditionLabel(condition, locale)}
                >
                  <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                  <div className="absolute inset-0 flex items-center justify-center text-foreground/70">
                    <WeatherIcon condition={condition} isDay={true} className="h-3.5 w-3.5" />
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
                  aria-label={`Set night weather to ${getWeatherConditionLabel(condition, locale)}`}
                  title={getWeatherConditionLabel(condition, locale)}
                >
                  <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                  <div className="absolute inset-0 flex items-center justify-center text-foreground/70">
                    <WeatherIcon condition={condition} isDay={false} className="h-3.5 w-3.5" />
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

  const formatTime = (ms?: number) => formatClockTime(ms, locale);

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

  const sunriseGradient = getSunEventGradient({ event: "sunrise", theme }).backgroundImage;
  const sunsetGradient = getSunEventGradient({ event: "sunset", theme }).backgroundImage;

  return (
    <DebugSection
      title={t(locale, "devtoolTimeOfDay")}
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
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
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

        <div className="grid grid-cols-6 gap-1.5">
          <PhaseButton p="sunrise" icon={<Sunrise className="h-3.5 w-3.5" />} aria="Set phase to sunrise" gradientBg={sunriseGradient} />
          <PhaseButton p="morning" icon={<Haze className="h-3.5 w-3.5" />} aria="Set phase to morning" />
          <PhaseButton p="afternoon" icon={<SunMedium className="h-3.5 w-3.5" />} aria="Set phase to afternoon" />
          <PhaseButton p="sunset" icon={<Sunset className="h-3.5 w-3.5" />} aria="Set phase to sunset" gradientBg={sunsetGradient} />
          <PhaseButton p="evening" icon={<Moon className="h-3.5 w-3.5" />} aria="Set phase to evening" />
          <PhaseButton p="night" icon={<MoonStar className="h-3.5 w-3.5" />} aria="Set phase to night" />
        </div>
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Hover Preview Module
// Tunes the magnetic preview's dwell + warmth timings (see preview-tuning)
// =============================================================================

function TuneSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[10px] font-mono text-foreground/80 tabular-nums">
          {value}ms
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 cursor-pointer accent-foreground"
        aria-label={label}
      />
    </div>
  );
}

function HoverPreviewModule() {
  const { locale } = useLocale();
  const tuning = usePreviewTuning();
  const isOverridden =
    tuning.openDelay !== PREVIEW_TUNING_DEFAULTS.openDelay ||
    tuning.graceMs !== PREVIEW_TUNING_DEFAULTS.graceMs;

  return (
    <DebugSection
      title={locale === "zh" ? "悬停预览" : "Hover Preview"}
      icon={<MousePointer2 className="h-4 w-4" />}
      action={
        isOverridden ? (
          <button
            onClick={() => resetPreviewTuning()}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Reset hover preview timings"
          >
            <RotateCcw className="h-3 w-3" />
            <span>{locale === "zh" ? "重置" : "Reset"}</span>
          </button>
        ) : (
          <span className="text-[10px] font-mono text-muted-foreground/40">
            {locale === "zh" ? "默认" : "Default"}
          </span>
        )
      }
    >
      <div className="space-y-3">
        <TuneSlider
          label={locale === "zh" ? "首次延迟" : "Dwell"}
          value={tuning.openDelay}
          min={0}
          max={600}
          step={10}
          onChange={(v) => setPreviewTuning({ openDelay: v })}
        />
        <TuneSlider
          label={locale === "zh" ? "热区宽限" : "Grace"}
          value={tuning.graceMs}
          min={0}
          max={1200}
          step={20}
          onChange={(v) => setPreviewTuning({ graceMs: v })}
        />
        <p className="text-[10px] font-mono leading-relaxed text-muted-foreground/70">
          {locale === "zh"
            ? "首次悬停需停留「首次延迟」后展示；展示后「热区宽限」内移到其他项即时展示。"
            : "First hover waits out Dwell; once open, moving within Grace shows the next instantly."}
        </p>
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Draggable Module
// =============================================================================

function DraggableModule() {
  const { locale } = useLocale();
  const { getDraggableConfig, setDraggableConfig } = useDevtool();

  return (
    <DebugSection
      title={locale === "zh" ? "拖拽" : "Draggable"}
      icon={<GripVertical className="h-4 w-4" />}
    >
      <div className="space-y-1.5">
        {DRAGGABLE_INSTANCES.map((inst) => {
          const config = getDraggableConfig(inst.id);
          const defaults = DRAGGABLE_DEFAULTS[inst.id] || { draggable: false, persist: false };
          const dragOverridden = config.draggable !== defaults.draggable;
          const persistOverridden = config.persist !== defaults.persist;
          return (
            <div
              key={inst.id}
              className="flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-muted-foreground truncate">
                  {locale === "zh" ? inst.labelZh : inst.labelEn}
                </span>
                {(dragOverridden || persistOverridden) && (
                  <span className="text-[9px] font-mono text-amber-500/70 uppercase">
                    *
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Persist toggle */}
                <button
                    onClick={() =>
                      setDraggableConfig(inst.id, "persist", !config.persist)
                    }
                    className={cn(
                      "p-1 rounded transition-colors",
                      config.persist
                        ? "text-foreground bg-muted/60"
                        : "text-muted-foreground/40 hover:text-muted-foreground",
                      persistOverridden && "ring-1 ring-amber-500/40"
                    )}
                    aria-label={`Toggle position save for ${inst.labelEn}`}
                    title={
                      locale === "zh"
                        ? config.persist
                          ? "记住位置"
                          : "不记住位置"
                        : config.persist
                        ? "Save position"
                        : "Don't save position"
                    }
                  >
                    <Brain className="h-3 w-3" />
                  </button>
                {/* Drag toggle */}
                <button
                  onClick={() =>
                    setDraggableConfig(
                      inst.id,
                      "draggable",
                      !config.draggable
                    )
                  }
                  className={cn(
                    "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
                    config.draggable
                      ? "bg-green-500/90 border-green-500/70"
                      : "bg-muted/40 border-border/60",
                    dragOverridden && "ring-1 ring-amber-500/40"
                  )}
                  aria-pressed={config.draggable}
                  aria-label={`Toggle draggable for ${inst.labelEn}`}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
                      config.draggable ? "translate-x-4" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Refetch Module
// =============================================================================

function RefetchModule() {
  const { locale } = useLocale();
  const { refresh: refreshLocation, isFetching: locationFetching } = useLocation();
  const { refresh: refreshWeather, isFetching: weatherFetching } = useWeather();

  const busy = locationFetching || weatherFetching;

  return (
    <DebugSection
      title={locale === "zh" ? "刷新" : "Refetch"}
      icon={<RefreshCw className="h-4 w-4" />}
      compact
    >
      <div className="flex items-center gap-2">
        <button
          onClick={() => refreshLocation()}
          className={cn(
            "flex-1 rounded-lg border px-3 py-2",
            "text-xs font-mono text-muted-foreground transition-colors",
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
            "text-xs font-mono text-muted-foreground transition-colors",
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
