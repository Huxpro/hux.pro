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
  setRulerSide,
  useRulerSide,
  type RulerSide,
} from "@/components/post/ruler-settings";
import {
  setBleedEnabled,
  useBleedEnabled,
} from "@/components/post/bleed-settings";
import { cn } from "@/lib/utils";
import {
  Braces,
  Brain,
  Bug,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Copy,
  GripVertical,
  Haze,
  Layers,
  Moon,
  MoonStar,
  RefreshCw,
  Ruler,
  SlidersHorizontal,
  Sun,
  SunMedium,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import { withDraggable } from "@/systems/draggable";
import { useEffect, useRef, useState } from "react";

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
          "shadow-raised",
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
        "shadow-overlay"
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
        <FrontmatterModule />
        <GlobalUIModule />
        <GradientModule />
        <WeatherModule />
        <AmbientTimeModule />
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
  /** Stable id for persisting collapse state (locale-independent, unlike title). */
  id: string;
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Tighter vertical padding for lightweight content (toggles, buttons) */
  compact?: boolean;
  /** Collapsed state when the user hasn't set one yet. Default: expanded. */
  defaultCollapsed?: boolean;
}

function DebugSection({
  id,
  title,
  icon,
  action,
  children,
  compact,
  defaultCollapsed = false,
}: DebugSectionProps) {
  // Collapse state is persisted per-section in the devtool settings
  // (localStorage), keyed by `id`, so folds survive reloads. The title is the
  // natural click target; the `action` slot stays a separate sibling so its
  // controls (toggles, copy) keep working without toggling the fold.
  const { isSectionCollapsed, setSectionCollapsed } = useDevtool();
  const collapsed = isSectionCollapsed(id, defaultCollapsed);

  return (
    <div className="border-b border-border/30 last:border-b-0">
      <div className="px-4 py-2 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setSectionCollapsed(id, !collapsed)}
            className={cn(
              "flex items-center gap-2 flex-1 min-w-0",
              "text-xs font-mono text-muted-foreground uppercase tracking-wider",
              "hover:text-foreground/80 transition-colors"
            )}
            aria-expanded={!collapsed}
            aria-label={`Toggle ${title} section`}
          >
            <ChevronDown
              className={cn(
                "h-3 w-3 shrink-0 transition-transform duration-200",
                collapsed && "-rotate-90"
              )}
            />
            {icon}
            <span className="truncate">{title}</span>
          </button>
          {action && (
            <div className="flex items-center min-h-5 shrink-0">{action}</div>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className={cn("px-4", compact ? "py-2" : "py-3")}>{children}</div>
      )}
    </div>
  );
}

// =============================================================================
// Frontmatter Module
// Inspects the frontmatter of the current page (blog posts register theirs via
// <DevtoolPageMeta>). Empty on pages that don't publish any.
// =============================================================================

/** Render a frontmatter value as a compact, legible string. */
function formatFrontmatterValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) {
    return value.length ? value.map((v) => String(v)).join(", ") : "[]";
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function FrontmatterModule() {
  const { locale } = useLocale();
  const { pageMeta } = useDevtool();
  const [copied, setCopied] = useState(false);

  const entries = pageMeta ? Object.entries(pageMeta.frontmatter) : [];

  const copy = async () => {
    if (!pageMeta) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(pageMeta.frontmatter, null, 2)
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard blocked (insecure context / permissions) — no-op.
    }
  };

  return (
    <DebugSection
      id="frontmatter"
      title={locale === "zh" ? "元信息" : "Frontmatter"}
      icon={<Braces className="h-4 w-4" />}
      compact={!pageMeta}
      action={
        pageMeta ? (
          <button
            onClick={copy}
            className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Copy frontmatter as JSON"
            title={locale === "zh" ? "复制 JSON" : "Copy JSON"}
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            <span>{copied ? (locale === "zh" ? "已复制" : "Copied") : "JSON"}</span>
          </button>
        ) : null
      }
    >
      {!pageMeta ? (
        <div className="text-[10px] font-mono text-muted-foreground/60">
          {locale === "zh" ? "当前非博客页面" : "No frontmatter on this page"}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Route context — slug + which locale's file is rendered. */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-mono text-foreground/90 break-all">
              {pageMeta.slug}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
              {pageMeta.lang}
            </span>
            {pageMeta.language && pageMeta.language !== pageMeta.lang && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 px-1.5 py-0.5 border border-border/50 rounded">
                {pageMeta.language}
              </span>
            )}
          </div>

          {/* Frontmatter fields, in authored order. */}
          {entries.length ? (
            <div className="space-y-2 border-t border-border/30 pt-2.5">
              {entries.map(([key, value]) => (
                <div key={key} className="space-y-0.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
                    {key}
                  </div>
                  <div className="text-xs font-mono text-foreground/80 break-words whitespace-pre-wrap">
                    {formatFrontmatterValue(value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] font-mono text-muted-foreground/60 border-t border-border/30 pt-2.5">
              {locale === "zh" ? "无字段" : "No fields"}
            </div>
          )}
        </div>
      )}
    </DebugSection>
  );
}

// =============================================================================
// Global UI Module
// Site-wide reading-surface variations. Each setting persists (localStorage)
// and applies even with the devtool disabled — the panel is just the UI.
//   · Bleed     — let wide media break out of the reading column on desktop
//   · Ruler ToC — which screen edge the reading ruler docks to
// =============================================================================

function GlobalUIModule() {
  const { locale } = useLocale();
  const bleed = useBleedEnabled();
  const side = useRulerSide();

  const sides: { value: RulerSide; label: string }[] = [
    { value: "left", label: locale === "zh" ? "左" : "Left" },
    { value: "right", label: locale === "zh" ? "右" : "Right" },
  ];

  return (
    <DebugSection
      id="global-ui"
      title={locale === "zh" ? "全局 UI" : "Global UI"}
      icon={<SlidersHorizontal className="h-4 w-4" />}
      compact
    >
      <div className="space-y-3">
        {/* Bleed — wide media outset */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            {locale === "zh" ? "满溢出血" : "Media bleed"}
          </span>
          <button
            onClick={() => setBleedEnabled(!bleed)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full border transition-colors",
              bleed
                ? "bg-green-500/90 border-green-500/70"
                : "bg-muted/40 border-border/60"
            )}
            aria-pressed={bleed}
            aria-label="Toggle media bleed"
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
                bleed ? "translate-x-4" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        {/* Ruler ToC — dock edge */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <Ruler className="h-3 w-3" />
            {locale === "zh" ? "标尺停靠" : "Ruler dock"}
          </span>
          <div className="flex overflow-hidden rounded-md border border-border/60">
            {sides.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setRulerSide(value)}
                className={cn(
                  "px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
                  side === value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-pressed={side === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </DebugSection>
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
      id="gradient"
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
      id="weather"
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
      id="time"
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
// Draggable Module
// =============================================================================

function DraggableModule() {
  const { locale } = useLocale();
  const { getDraggableConfig, setDraggableConfig } = useDevtool();

  return (
    <DebugSection
      id="draggable"
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
      id="refetch"
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
