"use client";

import { WeatherIcon } from "@/systems/ambient/components/weather-icon";
import {
  GLASS_MATERIALS,
  getGlassLabel,
  t,
  useLocale,
  useOptionalGlass,
  useTheme,
} from "@/services";
import { useAmbientTime, useLocation, useWallpaper, useWeather } from "@/systems/ambient";
import { formatClockTime } from "@/systems/ambient/lib/format";
import {
  getSunEventGradient,
  getWeatherGradient,
} from "@/systems/ambient/lib/gradient";
import {
  WEATHER_CONDITIONS,
  getWeatherConditionLabel,
} from "@/systems/ambient/lib/weather";
import { isReadingSurface } from "@/systems/ambient/lib/reading-surface";
import { useDevtool, DRAGGABLE_INSTANCES, DRAGGABLE_DEFAULTS } from "./provider";
import { useOptionalWindows } from "@/systems/windows";
import { useOptionalMusic } from "@/systems/music/provider";
import appsJson from "@/content/apps.json";
import type { AppLink } from "@/lib/app-icon-core";
import {
  setRulerSide,
  useRulerSide,
  type RulerSide,
} from "@/components/post/ruler-settings";
import {
  setBleedEnabled,
  useBleedEnabled,
  setReadingFont,
  setReadingMeasure,
  setReadingFocus,
  useReadingFont,
  useReadingMeasure,
  useReadingFocus,
  type ReadingFont,
  type ReadingMeasure,
} from "@/components/post/reading-settings";
import { cn } from "@/lib/utils";
import {
  AppWindow,
  BookOpen,
  Braces,
  Brain,
  Bug,
  ExternalLink,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Copy,
  GripVertical,
  Haze,
  Image as ImageIcon,
  Layers2,
  Moon,
  MoonStar,
  Music,
  RefreshCw,
  Smartphone,
  Sun,
  SunMedium,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
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
        data-drag-handle
        className={cn(
          "flex items-center gap-2 transition-all duration-300",
          "rounded-full touch-none",
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
  // Only the collapsed pill and the panel's title bar move the devtool; the
  // module bodies keep their sliders, inputs and scrolling.
  dragHandle: "[data-drag-handle]",
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
        "bg-glass-popover backdrop-blur-xl",
        "border border-border/50",
        "shadow-overlay"
      )}
    >
      {/* Header */}
      <div
        data-drag-handle
        className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/30 touch-none cursor-grab active:cursor-grabbing"
      >
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
        <ReadingModule />
        <WallpaperModule />
        <GlassModule />
        <WeatherModule />
        <AmbientTimeModule />
        <MusicModule />
        <DraggableModule />
        <AppsModule />
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
// Apps Module — inspect app windows + registry, and load a bundle over-the-air
// =============================================================================

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-right text-foreground/80">{v}</span>
    </div>
  );
}

function AppsModule() {
  const win = useOptionalWindows();
  const apps = (appsJson as { apps: AppLink[] }).apps;
  const [url, setUrl] = useState("");
  if (!win) return null;

  const sourceOf = (app: AppLink) =>
    app.runtime === "lynx"
      ? app.bundleUrl?.startsWith("http")
        ? "online"
        : "built-in"
      : "web";

  const loadOta = () => {
    const u = url.trim();
    if (u) {
      win.openBundleUrl(u);
      setUrl("");
    }
  };

  return (
    <DebugSection
      id="apps"
      title="Apps"
      icon={<AppWindow className="h-3 w-3" />}
      defaultCollapsed
    >
      <div className="space-y-3 px-4 py-3">
        {/* Over-the-air bundle loader */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Load bundle (OTA)
          </div>
          <div className="flex gap-1.5">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadOta()}
              placeholder="https://…/main.web.bundle"
              spellCheck={false}
              className="min-w-0 flex-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-mono text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={loadOta}
              className="shrink-0 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-mono text-foreground hover:bg-muted"
            >
              Load
            </button>
          </div>
        </div>

        {/* Live windows */}
        {win.windows.length > 0 && (
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Open windows ({win.windows.length})
            </div>
            {win.windows.map((w) => (
              <div
                key={w.id}
                className="space-y-0.5 rounded-lg border border-border/50 bg-muted/20 p-2 text-[11px] font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-foreground">{w.app.title}</span>
                  <span className="text-muted-foreground">{w.mode}</span>
                </div>
                <MetaRow k="runtime" v={w.app.runtime ?? "web"} />
                {w.app.flavor && <MetaRow k="flavor" v={w.app.flavor} />}
                <MetaRow k="source" v={sourceOf(w.app)} />
                <MetaRow k="size" v={w.sizePreset} />
                <MetaRow
                  k="rect"
                  v={`${Math.round(w.rect.x)},${Math.round(w.rect.y)} · ${Math.round(w.rect.width)}×${Math.round(w.rect.height)}`}
                />
                {w.app.bundleUrl && <MetaRow k="bundle" v={w.app.bundleUrl} />}
                {w.app.runtime !== "lynx" && <MetaRow k="url" v={w.app.url} />}
              </div>
            ))}
          </div>
        )}

        {/* Registry */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Registry ({apps.length})
          </div>
          {apps.map((app) => (
            <div
              key={app.id}
              className="flex items-center gap-2 rounded-lg border border-border/40 px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-foreground">{app.title}</div>
                <div className="truncate text-[10px] font-mono text-muted-foreground">
                  {sourceOf(app)} ·{" "}
                  {app.runtime === "lynx" ? (app.flavor ?? "react") : "web"} ·{" "}
                  {app.size ?? "auto"}
                </div>
              </div>
              <button
                onClick={() => win.openApp(app)}
                className="shrink-0 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[10px] font-mono text-foreground hover:bg-muted"
              >
                Open
              </button>
              {app.runtime !== "lynx" && (
                <a
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
                  aria-label={`Open ${app.title} externally`}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </DebugSection>
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
// Reading Module
// Article reading-surface variations. Each setting persists (localStorage)
// and applies even with the devtool disabled — the panel is just the UI.
//   · Typeface  — body copy: sans or serif
//   · Measure   — reading column width: narrow / default / wide
//   · Bleed     — let wide media break out of the reading column on desktop
//   · Focus     — dim every block but the one at the reading line
//   · Ruler ToC — which screen edge the reading ruler docks to
// =============================================================================

/** Compact label + control row shared by the reading settings. */
function PanelRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Pill on/off switch, matching the gradient/weather toggles. */
function PanelToggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
        on ? "bg-green-500/90 border-green-500/70" : "bg-muted/40 border-border/60"
      )}
      aria-pressed={on}
      aria-label={label}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
          on ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

/** Segmented single-select, matching the ruler dock control. */
function PanelSegmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-border/60">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          className={cn(
            "px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors",
            value === o.value
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          aria-pressed={value === o.value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ReadingModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const font = useReadingFont();
  const measure = useReadingMeasure();
  const bleed = useBleedEnabled();
  const focus = useReadingFocus();
  const side = useRulerSide();

  const fonts: { value: ReadingFont; label: string }[] = [
    { value: "sans", label: zh ? "无衬线" : "Sans" },
    { value: "serif", label: zh ? "衬线" : "Serif" },
  ];
  const measures: { value: ReadingMeasure; label: string; title: string }[] = [
    { value: "narrow", label: zh ? "窄" : "S", title: zh ? "窄" : "Narrow" },
    { value: "default", label: zh ? "中" : "M", title: zh ? "标准" : "Default" },
    { value: "wide", label: zh ? "宽" : "L", title: zh ? "宽" : "Wide" },
  ];
  const sides: { value: RulerSide; label: string }[] = [
    { value: "left", label: zh ? "左" : "Left" },
    { value: "right", label: zh ? "右" : "Right" },
  ];

  return (
    <DebugSection
      id="reading"
      title={zh ? "阅读" : "Reading"}
      icon={<BookOpen className="h-4 w-4" />}
      compact
    >
      <div className="space-y-3">
        <PanelRow label={zh ? "字体" : "Typeface"}>
          <PanelSegmented value={font} options={fonts} onChange={setReadingFont} />
        </PanelRow>
        <PanelRow label={zh ? "宽度" : "Measure"}>
          <PanelSegmented
            value={measure}
            options={measures}
            onChange={setReadingMeasure}
          />
        </PanelRow>
        <PanelRow label={zh ? "满溢出血" : "Media bleed"}>
          <PanelToggle
            on={bleed}
            onClick={() => setBleedEnabled(!bleed)}
            label="Toggle media bleed"
          />
        </PanelRow>
        <PanelRow label={zh ? "专注模式" : "Focus mode"}>
          <PanelToggle
            on={focus}
            onClick={() => setReadingFocus(!focus)}
            label="Toggle focus mode"
          />
        </PanelRow>
        <PanelRow label={zh ? "标尺停靠" : "Ruler dock"}>
          <PanelSegmented value={side} options={sides} onChange={setRulerSide} />
        </PanelRow>
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Glass Module
//
// The material every floating System UI surface is made of. Two options, the
// same two iOS 26 offers — Tinted (色调) and Clear (透明) — and the same effect:
// one class on <html> swapping a handful of CSS variables, so nothing
// re-renders and every `bg-glass*` surface follows along.
// =============================================================================

function GlassModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const glass = useOptionalGlass();
  if (!glass) return null;

  const options = GLASS_MATERIALS.map((value) => ({
    value,
    label: getGlassLabel(value, locale),
  }));

  return (
    <DebugSection
      id="glass"
      title={t(locale, "settingsGlass")}
      icon={<Layers2 className="h-4 w-4" />}
      compact
      action={
        <span className="text-[10px] font-mono text-muted-foreground">
          {glass.material}
          <span className="ml-1 text-muted-foreground/40">G</span>
        </span>
      }
    >
      <div className="space-y-2">
        <PanelRow label={zh ? "材质" : "Material"}>
          <PanelSegmented
            value={glass.material}
            options={options}
            onChange={glass.setMaterial}
          />
        </PanelRow>
        <p className="text-[10px] leading-snug text-muted-foreground/60">
          {zh
            ? "透明：接近无填充的通透质感，背后的壁纸直接透出来。色调：当前这种带卡片底色的材质。"
            : "Clear thins every surface to a vibrancy wash so the wallpaper reads through it. Tinted keeps the card fill."}
        </p>
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Wallpaper Module
//
// Everything about the background lives here, because everything about the
// background is now one system. The swatch grid leads with Weather — it is the
// first wallpaper, not a separate "kind" to pick first — and the rest are the
// Apple pairs. Below it, the rendering flags as plain switches: where the
// wallpaper paints, and how much of it survives on a reading page.
//
// Placement and the reading treatment write persisted settings, so the panel
// and the picker sheet can never disagree. Soft edging has no persisted setting
// (it is derived from the platform), so it stays a devtool override.
// =============================================================================

function WallpaperModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const pathname = usePathname();
  const {
    kind,
    setKind,
    wallpaper,
    wallpapers,
    selectWallpaper,
    variant,
    opacity,
    veil,
    blurred,
    src,
    dimHome,
    setDimHome,
    readingBlur,
    setReadingBlur,
    readingDim,
    setReadingDim,
    openPicker,
  } = useWallpaper();
  const {
    gradientMode,
    fullGradientEnabled,
    widgetGradientEnabled,
    softEdgingEnabled,
    devtoolGradientOverrides,
    setDevtoolGradientOverrides,
  } = useWeather();

  const isImage = kind === "image";
  const reading = isReadingSurface({ kind, pathname });

  // Full and Widget are independent switches here, not two halves of one
  // segmented control: the persisted setting can only be one of them, but the
  // devtool exists precisely to see combinations the setting cannot express —
  // both on at once included. They drive the ephemeral overrides, which is what
  // those were for; the persisted mode follows only when nothing is overridden.
  const overrideFlag = (key: "full" | "widget" | "softEdging", on: boolean) =>
    setDevtoolGradientOverrides({ ...devtoolGradientOverrides, [key]: on });
  const isOverridden = (key: "full" | "widget" | "softEdging") =>
    devtoolGradientOverrides[key] !== undefined;
  const clearOverrides = () => setDevtoolGradientOverrides({});
  const anyOverride =
    isOverridden("full") || isOverridden("widget") || isOverridden("softEdging");

  // One line that answers "what am I actually looking at".
  const now = [
    isImage ? wallpaper.name : zh ? "天气" : "Weather",
    variant,
    isImage ? (reading ? (zh ? "阅读" : "read") : zh ? "桌面" : "desktop") : gradientMode,
  ].join(" · ");

  return (
    <DebugSection
      id="wallpaper"
      title={t(locale, "settingsWallpaper")}
      icon={<ImageIcon className="h-4 w-4" />}
      compact
      action={
        <span className="text-[10px] font-mono text-muted-foreground">
          {isImage ? wallpaper.id : "weather"}
          <span className="ml-1 text-muted-foreground/40">W</span>
        </span>
      }
    >
      <div className="space-y-3">
        <div className="text-[10px] font-mono text-muted-foreground">
          {zh ? "当前: " : "Now: "}
          <span className="text-foreground/80">{now}</span>
          <span className="ml-1.5 text-muted-foreground/50">
            @{opacity.toFixed(2)}
            {veil > 0 && ` −${veil.toFixed(2)}`}
            {blurred && " blur"}
          </span>
        </div>

        {/* Weather is the first cell, not a separate control above the grid:
            picking a background is one choice, and this is that choice. */}
        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={() => setKind("weather")}
            title={zh ? "天气" : "Weather"}
            aria-label="Set wallpaper to Weather"
            aria-pressed={!isImage}
            className={cn(
              "relative aspect-square overflow-hidden rounded-lg border transition-all",
              "flex items-center justify-center bg-muted/30",
              !isImage
                ? "border-foreground/60 ring-2 ring-foreground/50"
                : "border-border/40 hover:border-border"
            )}
          >
            <Cloud className="h-3.5 w-3.5 text-foreground/70" />
          </button>
          {wallpapers.map((w) => {
            const selected = isImage && w.id === wallpaper.id;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => selectWallpaper(w.id)}
                title={`${w.name} · ${w.platform} ${w.year}${
                  w.portrait ? " · portrait" : ""
                }`}
                aria-label={`Set wallpaper to ${w.name}`}
                aria-pressed={selected}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border transition-all",
                  selected
                    ? "border-foreground/60 ring-2 ring-foreground/50"
                    : "border-border/40 hover:border-border"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w[variant].thumb}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                {/* Tall source: the swatch is square, so nothing else in this
                    grid would tell you the full-size file is a phone crop. */}
                {w.portrait && (
                  <Smartphone
                    aria-hidden
                    className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]"
                    strokeWidth={2.5}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Where it paints. */}
        <div className="space-y-2 border-t border-border/30 pt-2.5">
          <PanelRow
            label={`${zh ? "全屏" : "Full"}${isOverridden("full") ? " *" : ""}`}
          >
            <PanelToggle
              on={fullGradientEnabled}
              onClick={() => overrideFlag("full", !fullGradientEnabled)}
              label="Toggle full-page wallpaper"
            />
          </PanelRow>
          <PanelRow
            label={`${zh ? "卡片" : "Widget"}${isOverridden("widget") ? " *" : ""}`}
          >
            <PanelToggle
              on={widgetGradientEnabled}
              onClick={() => overrideFlag("widget", !widgetGradientEnabled)}
              label="Toggle widget wallpaper"
            />
          </PanelRow>
          <PanelRow
            label={`${zh ? "柔和边缘" : "Soft edge"}${isOverridden("softEdging") ? " *" : ""}`}
          >
            <PanelToggle
              on={softEdgingEnabled}
              onClick={() => overrideFlag("softEdging", !softEdgingEnabled)}
              label="Toggle soft edging"
            />
          </PanelRow>
          {anyOverride && (
            <button
              onClick={clearOverrides}
              className="w-full text-left text-[10px] font-mono text-amber-500/70 transition-colors hover:text-amber-400"
            >
              {zh
                ? `* 已覆盖设置（${gradientMode}）· 点击恢复`
                : `* overriding the setting (${gradientMode}) · click to clear`}
            </button>
          )}
        </div>

        {/* How much of it survives where. Home defaults to none of this. */}
        <div className="space-y-2 border-t border-border/30 pt-2.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            {zh ? "图片处理" : "Image treatment"}
          </div>
          <PanelRow label={zh ? "首页压暗" : "Dim home"}>
            <PanelToggle
              on={dimHome}
              onClick={() => setDimHome(!dimHome)}
              label="Toggle dimming on the home screen"
            />
          </PanelRow>
          <PanelRow label={zh ? "二级页虚化" : "Reading blur"}>
            <PanelToggle
              on={readingBlur}
              onClick={() => setReadingBlur(!readingBlur)}
              label="Toggle blur on reading pages"
            />
          </PanelRow>
          <PanelRow label={zh ? "二级页压暗" : "Reading dim"}>
            <PanelToggle
              on={readingDim}
              onClick={() => setReadingDim(!readingDim)}
              label="Toggle dimming on reading pages"
            />
          </PanelRow>
        </div>

        <button
          onClick={openPicker}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
          {zh ? "打开壁纸选择器" : "Open picker"}
        </button>

        {/* The resolved asset — the fastest way to trace a wrong background. */}
        <div className="break-all text-[10px] font-mono text-muted-foreground">
          {isImage ? src : zh ? "天气渐变" : "weather gradient"}
        </div>
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
// Music Module
// Inspect the global player state and toggle the offline mock backend
// (`hux_music_mock` — see systems/music/lib/mock.ts). Toggling hot-swaps the
// backend in place via the provider (teardown → reset → re-init), no reload.
// =============================================================================

function MusicModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const music = useOptionalMusic();
  const mock = music?.isMockEnabled ?? false;
  const toggleMock = () => music?.setMockEnabled(!mock);

  return (
    <DebugSection
      id="music"
      title={t(locale, "settingsMusic")}
      icon={<Music className="h-4 w-4" />}
      compact
      defaultCollapsed
      action={
        mock ? (
          <span className="text-[10px] font-mono text-amber-500/70 uppercase">
            mock
          </span>
        ) : null
      }
    >
      <div className="space-y-3">
        <PanelRow label={zh ? "模拟播放器" : "Mock player"}>
          <PanelToggle on={mock} onClick={toggleMock} label="Toggle music mock" />
        </PanelRow>
        <div className="text-[10px] font-mono text-muted-foreground">
          {zh
            ? "离线夹具驱动整个音乐系统（无需 YouTube）。切换立即生效并重置播放状态。"
            : "Offline fixture drives the whole music system (no YouTube). Takes effect instantly; playback state resets."}
        </div>
        {music && (
          <div className="space-y-1 border-t border-border/30 pt-2 text-[11px] font-mono">
            <MetaRow k="state" v={music.playerState} />
            <MetaRow k="track" v={music.track?.title || "—"} />
            <MetaRow
              k="playlist"
              v={
                music.playlist.length
                  ? `${music.playlistIndex + 1} / ${music.playlist.length}`
                  : "—"
              }
            />
          </div>
        )}
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
