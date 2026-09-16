"use client";

import { WeatherIcon } from "@/systems/ambient/components/weather-icon";
import {
  GLASS_MATERIALS,
  getGlassLabel,
  t,
  useGlass,
  useLocale,
  useTheme,
  GLASS_TINTS,
  getTintLabel,
} from "@/services";
import { useAmbientTime, useLocation, useWallpaper, useWeather } from "@/systems/ambient";
import { BEZEL_BAND_MAX, BEZEL_BAND_MIN, BEZEL_RADIUS_MAX } from "@hux/bezel";
import {
  DEFAULT_BEZEL_TINT,
  isBezelHex,
  type BezelTint,
} from "@/systems/ambient/lib/bezel";

/** The named tints plus the segmented control's own "pick a colour". */
type TintChoice = "black" | "dark" | "theme" | "custom";
import { formatClockTime } from "@/systems/ambient/lib/format";
import { getWeatherGradient, getWeatherStyleGradient } from "@/systems/ambient/lib/gradient";
import type { AmbientPhase } from "@/systems/ambient/lib/phase";
import { rgbToCss, sampleDaySky } from "@/systems/ambient/lib/scene";
import {
  getMoonPhaseName,
  startOfLocalDay,
  DEFAULT_SUNRISE_MINUTES,
  DEFAULT_SUNSET_MINUTES,
  minutesOfDay,
  type MoonPhaseName,
} from "@/systems/ambient/lib/solar";
import type { WallpaperStats } from "@/systems/ambient/lib/wallpaper/renderer";
import {
  getWeatherWallpaperName,
  WEATHER_STYLE_LABEL,
  WEATHER_STYLE_META,
  WEATHER_STYLES,
  type WeatherStyle,
} from "@/systems/ambient/lib/wallpaper";
import {
  WEATHER_CONDITION_LIST,
  getWeatherConditionLabel,
} from "@/systems/ambient/lib/weather";
import {
  useDevtool,
  DRAGGABLE_INSTANCES,
  DRAGGABLE_DEFAULTS,
  PHONE_PALETTE_DEFAULT,
  type PhonePalette,
} from "./provider";
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
  CalendarDays,
  ExternalLink,
  Check,
  ChevronDown,
  Command as CommandIcon,
  Clock,
  Cloud,
  Copy,
  GripVertical,
  Image as ImageIcon,
  Layers2,
  Moon,
  Music,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  X,
} from "lucide-react";
import { withDraggable } from "@/systems/draggable";
import {
  AdaptiveSurface,
  SHEET_DETENTS,
  type SurfacePresentation,
} from "@/systems/surface";
import Link from "next/link";
import { Slider } from "@/components/ui/slider";
import { useEffect, useMemo, useRef, useState } from "react";

// =============================================================================
// Devtool FAB + Panel
//
// Two things, not one. The pill is an ENTRY — a fixed button at the top right,
// draggable by itself, the way it has always been. The panel is a SURFACE, and
// so it is an <AdaptiveSurface> (systems/surface) like the wallpaper picker and
// the playlist: a bottom sheet on a phone, the same top-right floating window
// on anything wider.
//
// Being a surface is what the panel was missing. It used to be a desktop card
// squeezed to phone width: pinned to the top edge over the dock's Live
// Activity, dragged by a handle no finger wants, with no swipe to dismiss and
// no place in the surface stack — so a picker opened from it had nowhere to go
// but over it, and the panel had to fold itself out of the way first
// (`openPicker(); closePanel();`). Now the picker simply stacks on it, the
// devtool steps back a notch behind it, and closing the picker brings the
// devtool forward again — iOS's own answer to a sheet presenting a sheet.
//
// Non-modal, and that is the point: the devtool exists to watch the page react
// while wallpaper, glass and sky are turned. The page stays live underneath,
// scrollable and clickable, and a press on it is the page's.
// =============================================================================

/**
 * Phone: a sheet. Everything wider: the floating window it has always been.
 * There is no tablet panel shape here — a devtool hugging the trailing edge
 * full height would cover the page it is about.
 */
const DEVTOOL_PRESENTATION: SurfacePresentation = { base: "sheet", sm: "window" };

function DevtoolPillInner() {
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
    // The box is not the button: only the pill itself takes pointers, so the
    // top-right corner belongs to whatever surface is up there — a full-height
    // picker's close button sits exactly here, and a hidden pill must not eat
    // the tap meant for it.
    <div className="pointer-events-none fixed top-4 right-4 z-50">
      <button
        onClick={toggle}
        data-drag-handle
        className={cn(
          "pointer-events-auto flex items-center gap-2 transition-all duration-300",
          "rounded-full touch-none",
          "bg-foreground text-background",
          "shadow-raised",
          "hover:scale-105 active:scale-95",
          // Out of the way while the panel is up; the panel has its own close.
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
    </div>
  );
}

const DevtoolPill = withDraggable(DevtoolPillInner, {
  id: "devtool",
  // The pill is its own drag handle, and the only one: the panel is a separate
  // surface now, with its own header and its own draggable instance.
  dragHandle: "[data-drag-handle]",
});

export function DevtoolFAB() {
  return (
    <>
      <DevtoolPill />
      <DevtoolPanel />
    </>
  );
}

// =============================================================================
// Devtool Panel Component
// The surface holding the debug modules
// =============================================================================

function DevtoolPanel() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const { isEnabled, isOpen, open, close, toggleEnabled } = useDevtool();

  if (!isEnabled) return null;

  return (
    <AdaptiveSurface
      id="surface-devtool"
      open={isOpen}
      onOpenChange={(next) => (next ? open() : close())}
      presentation={DEVTOOL_PRESENTATION}
      // Where the devtool has always lived on a desktop, and where it must
      // stay: centred, it would cover the page it is there to watch.
      windowPlacement="top-right"
      windowWidth="min(calc(100vw - 2rem), 420px)"
      maxHeight="min(70vh, 720px)"
      // On a phone: the site's detents, so a picker opened from here arrives
      // level with it and a drag carries either to the top.
      snapPoints={SHEET_DETENTS}
      title={
        <span className="flex items-center gap-2">
          <Bug className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{zh ? "调试面板" : "Devtool Panel"}</span>
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none normal-case tracking-normal">
            DEV
          </span>
        </span>
      }
      closeLabel={zh ? "关闭调试面板" : "Close devtool panel"}
      // The modules bring their own padding and full-bleed section rules.
      contentClassName="pb-0"
      footer={
        <div className="border-t border-border/50 bg-muted/20 px-4 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-mono">
              {zh ? "按 D 切换" : "Press D to toggle"}
            </span>
            <button
              onClick={toggleEnabled}
              className="flex items-center gap-1 font-mono transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
              <span>{zh ? "关闭调试" : "Disable Devtool"}</span>
            </button>
          </div>
        </div>
      }
    >
      <FrontmatterModule />
      <ReadingModule />
      <WallpaperModule />
      <GlassModule />
      <SkyModule />
      <MusicModule />
      <CommandModule />
      <DraggableModule />
      <AppsModule />
      <RefetchModule />
    </AdaptiveSurface>
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
              className="min-w-0 flex-1 rounded-md border border-border/60 bg-muted/30 px-2 py-1 text-[11px] font-mono text-foreground placeholder:text-tertiary-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
        <div className="text-[10px] font-mono text-tertiary-foreground">
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
              <span className="text-[10px] font-mono uppercase tracking-wider text-tertiary-foreground px-1.5 py-0.5 border border-border/50 rounded">
                {pageMeta.language}
              </span>
            )}
          </div>

          {/* Frontmatter fields, in authored order. */}
          {entries.length ? (
            <div className="space-y-2 border-t border-border/30 pt-2.5">
              {entries.map(([key, value]) => (
                <div key={key} className="space-y-0.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-tertiary-foreground">
                    {key}
                  </div>
                  <div className="text-xs font-mono text-foreground/80 break-words whitespace-pre-wrap">
                    {formatFrontmatterValue(value)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] font-mono text-tertiary-foreground border-t border-border/30 pt-2.5">
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
/**
 * The one signal the panel gives for "this is not the default". Deliberately
 * just an asterisk: what a deviation means belongs in the source, not in a
 * paragraph under every row. Clicking it restores the default, which is what
 * the removed "click to clear" / "click for auto" lines used to do.
 */
function PanelStar({
  onReset,
  source,
  label,
}: {
  onReset: () => void;
  /**
   * Where the value comes from, by colour: amber is a session override (gone on
   * reload, and for edge rows on a kind change), sky is a saved setting.
   */
  source: "session" | "saved";
  /** A more specific name for the reset, where one star among several needs one. */
  label?: string;
}) {
  const title =
    label ?? (source === "session" ? "Session override — reset" : "Saved — reset");
  return (
    <button
      onClick={onReset}
      title={title}
      aria-label={title}
      className={cn(
        "ml-1 font-mono transition-colors",
        source === "session"
          ? "text-amber-500/80 hover:text-amber-400"
          : "text-sky-500/80 hover:text-sky-400"
      )}
    >
      *
    </button>
  );
}

function PanelRow({
  label,
  children,
  star,
}: {
  label: string;
  children: React.ReactNode;
  /** <PanelStar> when this row is not at its default. */
  star?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
        {label}
        {star}
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
  disabled = false,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  /** The setting is kept but has nothing to act on right now. */
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors",
        on ? "bg-green-500/90 border-green-500/70" : "bg-muted/40 border-border/60",
        disabled && "opacity-40 cursor-not-allowed"
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

/** Continuous value, for the things you settle by dragging rather than typing. */
function PanelRange({
  value,
  min,
  max,
  step,
  onChange,
  label,
  format = (v) => String(v),
  wide = false,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  label: string;
  format?: (value: number) => string;
  /** Full-width, on a line of its own, with the reading shown by the caller. */
  wide?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", wide ? "w-full" : "shrink-0")}>
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={onChange}
        className={wide ? "w-full" : "w-24"}
      />
      {!wide && (
        <span className="w-8 text-right text-[10px] font-mono tabular-nums text-muted-foreground">
          {format(value)}
        </span>
      )}
    </div>
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
  const glass = useGlass();
  const { legibility, legibilityOverride, labPolicy } = useWallpaper();

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
          <span className="ml-1 text-quaternary-foreground">G</span>
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
        <PanelRow
          label={t(locale, "settingsTint")}
          star={
            glass.tint === "neutral" ? null : (
              <PanelStar source="saved" onReset={() => glass.setTint("neutral")} label="Back to neutral" />
            )
          }
        >
          <PanelSegmented
            value={glass.tint}
            options={GLASS_TINTS.map((value) => ({
              value,
              label: getTintLabel(value, locale),
            }))}
            onChange={glass.setTint}
          />
        </PanelRow>
        {/* What the legibility policy resolved for the wallpaper that is
            painting, on the row that opens the lab where it is tuned — the
            same row the Wallpaper module uses for the current picture. */}
        <Link
          href="/editor/legibility"
          className="flex w-full items-center gap-2 rounded-md border border-border/60 px-2 py-1.5 text-left transition-colors hover:bg-muted/40"
        >
          <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-foreground/80">
            {legibility.flip ? "flip" : legibility.flipMid ? "flip·mid" : "ink"}
            <span className="ml-1.5 tabular-nums text-tertiary-foreground">
              busy {legibility.busy.toFixed(2)} · relief {legibility.relief.toFixed(2)} · +
              {legibility.inkBoost}% · glass +{legibility.glassAdd}%
              {(legibilityOverride || labPolicy) && " · lab"}
            </span>
          </span>
          <ExternalLink className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </DebugSection>
  );
}

// =============================================================================
// Wallpaper Module
//
// Everything about the background lives here, because everything about the
// background is now one system. Choosing a picture is left to the picker: the
// module only switches kind and shows what is up, and a tap on that opens the
// picker. Below it, the rendering flags as plain switches: where the wallpaper
// paints, and how much of it survives on a reading page.
//
// Under Weather there are two more rows. Style is the persisted choice among
// the picker's three weather tiles (Sky / Gradient / Classic); "No WebGL2" is
// the one session override that exists here — it pretends WebGL2 is missing so
// the Sky's fallback can be seen on a machine that has it. Style and engine
// are otherwise one-to-one, so there is no engine picker. The last line reads
// the live engine back: internal resolution, adaptive scale and frame time for
// GL, or which CSS style is painting.
//
// Full, Widget and Soft edge are ephemeral devtool overrides of what the
// settings and the platform resolve to; the reading treatment rows write the
// persisted settings the picker sheet shares.
// =============================================================================

function WallpaperModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const {
    kind,
    setKind,
    weatherStyle,
    selectWeather,
    effectiveStyle,
    renderer,
    shaderSupported,
    statsRef,
    wallpaper,
    variant,
    opacity,
    veil,
    blurred,
    reading,
    src,
    bezel,
    bezelScroll,
    bezelColor,
    bezelTint,
    setBezelTint,
    bezelBand,
    bezelBandSetting,
    setBezelBand,
    bezelRadius,
    bezelRadiusSetting,
    setBezelRadius,
    readingBlur,
    setReadingBlur,
    readingDim,
    setReadingDim,
    openPicker,
    placement,
    fullEnabled,
    widgetEnabled,
    softEdgeEnabled,
    devtoolOverrides,
    setDevtoolOverrides,
  } = useWallpaper();
  const { scene } = useWeather();
  const { phase } = useAmbientTime();

  const isImage = kind === "image";
  const isShader = !isImage && renderer === "shader";
  // The swatch: what the CSS stack would paint for the effective style.
  const swatch = getWeatherStyleGradient(effectiveStyle, scene, phase);

  // Poll the renderer stats while the shader is live — as a formatted line, so
  // an unchanged readout is a no-op render.
  const [glStats, setGlStats] = useState<string | null>(null);
  useEffect(() => {
    if (!isShader) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync: clear stale stats
      setGlStats(null);
      return;
    }
    const tick = () => {
      const st = statsRef.current?.();
      setGlStats(
        st ? `${st.width}×${st.height} · ${st.scale.toFixed(2)}× · ${st.frameMs.toFixed(1)}ms` : null
      );
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [isShader, statsRef]);

  // The segmented control has a position the setting does not: "custom" is not
  // a tint, it is "whatever the swatch says". Every row here is live; @hux/bezel
  // shows each change to the browser chrome as it happens.
  const tints: { value: TintChoice; label: string; title: string }[] = [
    {
      value: "black",
      label: zh ? "黑" : "Black",
      title: zh ? "纯黑，ryOS 的做法" : "Pure black, as ryOS does",
    },
    {
      value: "dark",
      label: zh ? "深" : "Dark",
      title: zh ? "两个主题都用深色底" : "The dark ground, in both themes",
    },
    {
      value: "theme",
      label: zh ? "主题" : "Theme",
      title: zh ? "跟随主题的页面底色" : "The page ground, following the theme",
    },
    {
      value: "custom",
      label: zh ? "自定" : "Custom",
      title: zh ? "自选颜色" : "Pick a colour",
    },
  ];

  // Full and Widget are independent switches here, not two halves of one
  // segmented control: the persisted setting can only be one of them, but the
  // devtool exists precisely to see combinations the setting cannot express —
  // both on at once included. They drive the ephemeral overrides, which is what
  // those were for; the persisted mode follows only when nothing is overridden.
  const placements = [
    {
      key: "full",
      label: t(locale, "wallpaperPlacementFull"),
      aria: "Toggle full-page wallpaper",
      on: fullEnabled,
    },
    {
      key: "widget",
      label: t(locale, "wallpaperPlacementWidget"),
      aria: "Toggle widget wallpaper",
      on: widgetEnabled,
    },
    {
      key: "softEdging",
      label: zh ? "柔和边缘" : "Soft edge",
      aria: "Toggle soft edging",
      on: softEdgeEnabled,
    },
  ] as const;
  type OverrideKey = "full" | "widget" | "softEdging" | "bezel" | "scroll" | "noWebGL";
  const overrideFlag = (key: Exclude<OverrideKey, "scroll">, on: boolean) =>
    setDevtoolOverrides({ ...devtoolOverrides, [key]: on });
  const clearFlag = (key: OverrideKey) =>
    setDevtoolOverrides({ ...devtoolOverrides, [key]: undefined });
  const sessionStar = (key: OverrideKey) =>
    devtoolOverrides[key] !== undefined ? (
      <PanelStar onReset={() => clearFlag(key)} source="session" />
    ) : null;

  // One line that answers "what am I actually looking at".
  const weatherName = getWeatherWallpaperName(locale, weatherStyle);
  const now = [
    isImage ? wallpaper.name : weatherName,
    variant,
    isImage ? (reading ? (zh ? "阅读" : "read") : zh ? "桌面" : "desktop") : placement,
  ].join(" · ");

  // What the weather layer is being drawn by, with the GL numbers when live.
  const fellBack = weatherStyle === "sky" && effectiveStyle !== "sky";
  const engineLine = isShader
    ? `GL · ${glStats ?? "…"}`
    : `CSS · ${t(locale, WEATHER_STYLE_LABEL[effectiveStyle])}${
        fellBack ? ` (${zh ? "无 WebGL2，天空退回" : "no WebGL2, Sky fell back"})` : ""
      }`;

  return (
    <DebugSection
      id="wallpaper"
      title={t(locale, "settingsWallpaper")}
      icon={<ImageIcon className="h-4 w-4" />}
      compact
      action={
        <span className="text-[10px] font-mono text-muted-foreground">
          {isImage ? wallpaper.id : `weather · ${isShader ? "gl" : "css"}`}
          <span className="ml-1 text-quaternary-foreground">W</span>
        </span>
      }
    >
      <div className="space-y-3">
        <div className="text-[10px] font-mono text-muted-foreground">
          {zh ? "当前: " : "Now: "}
          <span className="text-foreground/80">{now}</span>
          <span className="ml-1.5 text-tertiary-foreground">
            @{opacity.toFixed(2)}
            {veil > 0 && ` −${veil.toFixed(2)}`}
            {blurred && " blur"}
          </span>
        </div>

        {/* Which wallpaper. Only a switch and the current picture: choosing
            among thirty-odd tiles is the picker's job, and a second grid here
            was a second picker to keep in step. Under Weather, the style is
            the picker's two tiles as a segmented row, and Engine is the devtool
            override on top of it — what actually paints. */}
        <PanelRow label={zh ? "类型" : "Kind"}>
          <PanelSegmented<"weather" | "image">
            value={kind}
            options={[
              { value: "weather", label: t(locale, "wallpaperWeather") },
              { value: "image", label: zh ? "图片" : "Image" },
            ]}
            onChange={setKind}
          />
        </PanelRow>
        {!isImage && (
          <>
            <PanelRow
              label={zh ? "风格" : "Style"}
              star={
                weatherStyle === "sky" ? null : (
                  <PanelStar onReset={() => selectWeather("sky")} source="saved" label="Back to Sky" />
                )
              }
            >
              <PanelSegmented<WeatherStyle>
                value={weatherStyle}
                options={WEATHER_STYLES.map((style) => ({
                  value: style,
                  label: t(locale, WEATHER_STYLE_LABEL[style]),
                  title:
                    style === "sky" && !shaderSupported
                      ? t(locale, "wallpaperNoWebGL")
                      : t(locale, WEATHER_STYLE_META[style]),
                }))}
                onChange={selectWeather}
              />
            </PanelRow>
            {/* The only engine knob: pretend WebGL2 is missing, to see the Sky's
                fallback here. Style and engine are otherwise one-to-one. */}
            <PanelRow label={zh ? "无 WebGL2" : "No WebGL2"} star={sessionStar("noWebGL")}>
              <PanelToggle
                on={devtoolOverrides.noWebGL === true}
                onClick={() => overrideFlag("noWebGL", !devtoolOverrides.noWebGL)}
                label="Simulate no WebGL2"
              />
            </PanelRow>
          </>
        )}
        <button
          type="button"
          // The picker stacks on the devtool rather than replacing it: the
          // panel steps back a notch behind it and comes forward when it goes.
          onClick={openPicker}
          aria-label={zh ? "打开壁纸选择器" : "Open wallpaper picker"}
          className="flex w-full items-center gap-2 rounded-md border border-border/60 p-1 text-left transition-colors hover:bg-muted/40"
        >
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={wallpaper[variant].thumb}
              alt=""
              className="h-6 w-10 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <span
              className="flex h-6 w-10 shrink-0 items-center justify-center rounded-sm"
              style={{ backgroundImage: swatch }}
            >
              {weatherStyle === "sky" ? (
                <Sparkles className="h-3 w-3 text-white/85 drop-shadow" />
              ) : (
                <Cloud className="h-3 w-3 text-white/85 drop-shadow" />
              )}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-foreground/80">
            {isImage
              ? wallpaper.name
              : weatherName}
            {isImage && (
              <span className="ml-1.5 tabular-nums text-tertiary-foreground">
                {wallpaper[variant].width}×{wallpaper[variant].height}
              </span>
            )}
          </span>
          <ExternalLink className="mr-1 h-3 w-3 shrink-0 text-muted-foreground" />
        </button>

        {/* Where it paints. */}
        <div className="space-y-2 border-t border-border/30 pt-2.5">
          {placements.map((p) => (
            <PanelRow
              key={p.key}
              label={p.label}
              star={sessionStar(p.key)}
            >
              <PanelToggle
                on={p.on}
                onClick={() => overrideFlag(p.key, !p.on)}
                label={p.aria}
              />
            </PanelRow>
          ))}
        </div>

        {/* The bezel. On/off follows the kind unless overridden for the
            session; tint, band and radius are saved. */}
        <div className="space-y-2 border-t border-border/30 pt-2.5">
          <PanelRow label={zh ? "边框" : "Bezel"} star={sessionStar("bezel")}>
            <PanelToggle
              on={bezel}
              onClick={() => overrideFlag("bezel", !bezel)}
              label="Toggle bezel"
            />
          </PanelRow>
          {bezel && (
            <>
              <PanelRow
                label={zh ? "颜色" : "Tint"}
                star={
                  bezelTint !== DEFAULT_BEZEL_TINT ? (
                    <PanelStar onReset={() => setBezelTint(DEFAULT_BEZEL_TINT)} source="saved" />
                  ) : null
                }
              >
                <PanelSegmented<TintChoice>
                  value={isBezelHex(bezelTint) ? "custom" : bezelTint}
                  options={tints}
                  onChange={(choice) =>
                    setBezelTint(choice === "custom" ? (bezelColor as BezelTint) : choice)
                  }
                />
              </PanelRow>
              <PanelRow label={bezelColor}>
                <input
                  type="color"
                  value={bezelColor}
                  aria-label="Bezel custom colour"
                  onChange={(e) => setBezelTint(e.target.value as BezelTint)}
                  className="h-5 w-10 shrink-0 cursor-pointer rounded border border-border/60 bg-transparent p-0"
                />
              </PanelRow>
              <PanelRow
                label={zh ? "边框厚度" : "Band"}
                star={
                  bezelBandSetting !== null ? (
                    <PanelStar onReset={() => setBezelBand(null)} source="saved" />
                  ) : null
                }
              >
                <PanelRange
                  value={bezelBand}
                  min={BEZEL_BAND_MIN}
                  max={BEZEL_BAND_MAX}
                  step={1}
                  onChange={setBezelBand}
                  label="Bezel band thickness"
                  format={(v) => `${v}px`}
                />
              </PanelRow>
              <PanelRow
                label={zh ? "圆角" : "Radius"}
                star={
                  bezelRadiusSetting !== null ? (
                    <PanelStar onReset={() => setBezelRadius(null)} source="saved" />
                  ) : null
                }
              >
                <PanelRange
                  value={bezelRadius}
                  min={0}
                  max={BEZEL_RADIUS_MAX}
                  step={2}
                  onChange={setBezelRadius}
                  label="Bezel corner radius"
                  format={(v) => `${v}px`}
                />
              </PanelRow>
            </>
          )}
          {/* Where the page scrolls: the window, or a container in a locked
              document. The platform picks; this overrides it for the session. */}
          <PanelRow label={zh ? "滚动" : "Scroll"} star={sessionStar("scroll")}>
            <PanelSegmented<"window" | "container">
              value={bezelScroll}
              options={[
                { value: "window", label: "Window" },
                { value: "container", label: "Container" },
              ]}
              onChange={(scroll) => setDevtoolOverrides({ ...devtoolOverrides, scroll })}
            />
          </PanelRow>
        </div>

        {/* How much of it survives on a reading page. Home gets none of this.
            The veil applies to every kind; the blur only to a picture, so its
            switch goes quiet under the weather rather than pretending. */}
        <div className="space-y-2 border-t border-border/30 pt-2.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-tertiary-foreground">
            {zh ? "阅读页处理" : "Reading treatment"}
          </div>
          <PanelRow
            label={isImage ? (zh ? "二级页虚化" : "Reading blur") : zh ? "二级页虚化 · 仅图片" : "Reading blur · images only"}
            star={
              readingBlur ? null : (
                <PanelStar onReset={() => setReadingBlur(true)} source="saved" />
              )
            }
          >
            <PanelToggle
              on={readingBlur}
              disabled={!isImage}
              onClick={() => setReadingBlur(!readingBlur)}
              label="Toggle blur on reading pages"
            />
          </PanelRow>
          <PanelRow
            label={zh ? "二级页压暗" : "Reading dim"}
            star={
              readingDim ? null : (
                <PanelStar onReset={() => setReadingDim(true)} source="saved" />
              )
            }
          >
            <PanelToggle
              on={readingDim}
              onClick={() => setReadingDim(!readingDim)}
              label="Toggle dimming on reading pages"
            />
          </PanelRow>
        </div>

        {/* The resolved asset — the fastest way to trace a wrong background. */}
        <div className="break-all text-[10px] font-mono tabular-nums text-muted-foreground">
          {isImage ? src : engineLine}
        </div>
      </div>
    </DebugSection>
  );
}
// =============================================================================
// Slider row for the scene tweaks. Same grammar as every other row: label on
// the left, a star when it is not at its natural value, the reading on the
// right, the control underneath.
// =============================================================================

function PanelSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  star,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  star?: React.ReactNode;
  onChange: (v: number) => void;
  /** Stable, locale-independent name for scripts and assistive tech. */
  ariaLabel: string;
}) {
  return (
    <div className="space-y-1">
      <PanelRow label={label} star={star}>
        <span className="text-[10px] font-mono tabular-nums text-foreground/80">{format(value)}</span>
      </PanelRow>
      <PanelRange wide value={value} min={min} max={max} step={step} onChange={onChange} label={ariaLabel} />
    </div>
  );
}

// =============================================================================
// Moon phase glyph — the lit part of the disc for a phase in [0, 1).
// Terminator is an ellipse of half-width |cos(2πp)|; waxing lights the right
// limb (northern hemisphere), and `mirror` flips it for the south.
// =============================================================================

function MoonPhaseIcon({
  phase,
  mirror = false,
  className,
}: {
  phase: number;
  mirror?: boolean;
  className?: string;
}) {
  const r = 6;
  const p = ((phase % 1) + 1) % 1;
  const k = Math.cos(p * 2 * Math.PI);
  const rx = Math.max(0.01, Math.abs(k) * r);
  const waxing = p < 0.5;
  // Outer limb: right semicircle when waxing, left when waning (top → bottom).
  const limb = waxing ? `A ${r} ${r} 0 0 1 0 ${r}` : `A ${r} ${r} 0 0 0 0 ${r}`;
  // Return along the terminator ellipse (bottom → top). Crescent (k > 0)
  // curves back on the same side as the limb; gibbous (k < 0) bulges across.
  const sweep = waxing ? (k > 0 ? 0 : 1) : k > 0 ? 1 : 0;
  const terminator = `A ${rx} ${r} 0 0 ${sweep} 0 ${-r}`;
  return (
    <svg
      viewBox="-7 -7 14 14"
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      aria-hidden
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      <circle r={r} className="fill-muted-foreground/25" />
      <path d={`M 0 ${-r} ${limb} ${terminator} Z`} className="fill-foreground/85" />
    </svg>
  );
}

// =============================================================================
// Sky Module — weather and time as one thing
//
// The wallpaper is a function of (condition, clock); the two used to sit in
// separate modules with a hint pointing from one to the other. Here they are
// one picture:
//
//   · a status line saying what the sky IS right now — condition, phase,
//     clock, sun height, moon phase — every field derived from the same scene;
//   · a day timeline painted with the sky's own colours for the current
//     condition, sunrise and sunset ticked on it, with a playhead you drag.
//     Change the condition and the strip repaints; move the playhead and the
//     condition chips swap to their night faces. Phase names under it jump;
//   · the six conditions, one row, previewed at the effective time of day.
//     Click to force one, click it again to go back to the real weather —
//     no toggle to remember;
//   · the date (which is what changes the moon), and a fold of fine-tune
//     sliders over the derived scene plus the raw API readout.
//
// Day/night is never chosen here. It follows the clock, so a moon in a daytime
// sky is impossible by construction. One "Now" in the corner puts everything
// back — time, day, condition and tweaks alike.
// =============================================================================

const PHASE_ORDER: AmbientPhase[] = [
  "sunrise",
  "morning",
  "afternoon",
  "sunset",
  "evening",
  "night",
];

const PHASE_LABEL: Record<"en" | "zh", Record<AmbientPhase, string>> = {
  en: {
    sunrise: "Sunrise",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    sunset: "Sunset",
    night: "Night",
  },
  zh: {
    sunrise: "日出",
    morning: "早晨",
    afternoon: "下午",
    evening: "傍晚",
    sunset: "日落",
    night: "夜晚",
  },
};

const MOON_NAME: Record<"en" | "zh", Record<MoonPhaseName, string>> = {
  en: {
    new: "New moon",
    "waxing-crescent": "Waxing crescent",
    "first-quarter": "First quarter",
    "waxing-gibbous": "Waxing gibbous",
    full: "Full moon",
    "waning-gibbous": "Waning gibbous",
    "last-quarter": "Last quarter",
    "waning-crescent": "Waning crescent",
  },
  zh: {
    new: "新月",
    "waxing-crescent": "娥眉月",
    "first-quarter": "上弦月",
    "waxing-gibbous": "盈凸月",
    full: "满月",
    "waning-gibbous": "亏凸月",
    "last-quarter": "下弦月",
    "waning-crescent": "残月",
  },
};


/** The quiet outlined chip the Sky module's Now and Play buttons are made of. */
const PANEL_CHIP = cn(
  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
  "text-[10px] font-mono uppercase tracking-wider transition-colors"
);

/** The timeline's playhead: a range input with an invisible track. */
const PLAYHEAD_INPUT = cn(
  "absolute inset-0 h-full w-full cursor-ew-resize appearance-none bg-transparent",
  "[&::-webkit-slider-runnable-track]:h-full [&::-webkit-slider-runnable-track]:bg-transparent",
  "[&::-webkit-slider-thumb]:h-10 [&::-webkit-slider-thumb]:w-[3px] [&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
  "[&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(0,0,0,0.55)]",
  "[&::-moz-range-track]:bg-transparent",
  "[&::-moz-range-thumb]:h-10 [&::-moz-range-thumb]:w-[3px] [&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
);

function SkyModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const lang = zh ? "zh" : "en";
  const { theme } = useTheme();
  const { location } = useLocation();
  const {
    weather,
    scene,
    sceneWeather,
    debugOverride,
    setDebugOverride,
    sceneOverrides,
    setSceneOverrides,
  } = useWeather();
  const {
    nowMs,
    realNowMs,
    phase,
    sunriseMs,
    sunsetMs,
    timeScrubMinutes,
    setTimeScrubMinutes,
    dayOffset,
    setDayOffset,
    isTimeTravelActive,
    resetTimeTravel,
  } = useAmbientTime();

  const isDayNow = scene.sun.isDay;
  const isOverridden = debugOverride !== null;
  const isTuned = Object.keys(sceneOverrides).length > 0;
  const anythingForced = isTimeTravelActive || isOverridden || isTuned;

  // --- The day ------------------------------------------------------------
  const dayStartMs = startOfLocalDay(nowMs);
  /** A clock reading for minutes past midnight, in the locale's format. */
  const clock = (minutes: number) => formatClockTime(dayStartMs + minutes * 60_000, locale);
  const lat = location?.lat;
  const lon = location?.lon;

  // The strip: 72 scenes across the day for the *current* condition, so a
  // forced Thunder greys the whole day and a clear day glows at both ends.
  const dayGradient = useMemo(() => {
    const colors = sampleDaySky({
      dayMs: dayStartMs,
      lat,
      lon,
      weather: sceneWeather,
      theme,
      overrides: sceneOverrides,
    });
    const stops = colors.map(
      (c, i) => `${rgbToCss(c)} ${((i / (colors.length - 1)) * 100).toFixed(1)}%`
    );
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }, [dayStartMs, lat, lon, sceneWeather, theme, sceneOverrides]);

  const sr = minutesOfDay(sunriseMs, DEFAULT_SUNRISE_MINUTES);
  const ss = minutesOfDay(sunsetMs, DEFAULT_SUNSET_MINUTES);
  const noon = Math.round((sr + ss) / 2);
  const SUN_WINDOW = 45;
  const phaseTimes: Record<AmbientPhase, number> = {
    sunrise: sr,
    morning: Math.round((sr + SUN_WINDOW + noon) / 2),
    afternoon: Math.round((noon + ss - SUN_WINDOW) / 2),
    sunset: ss,
    evening: Math.min(1439, ss + SUN_WINDOW + 75),
    night: Math.min(1439, ss + SUN_WINDOW + 180 + 45),
  };

  const nowDate = new Date(nowMs);
  const clockMinutes = timeScrubMinutes ?? minutesOfDay(nowMs);
  const realMinutes = minutesOfDay(realNowMs);
  const pct = (m: number) => `${((m / 1440) * 100).toFixed(2)}%`;

  // --- Play: sweep dawn → dusk and loop ------------------------------------
  const [playing, setPlaying] = useState(false);
  const PLAY_LEAD_MIN = 90;
  const PLAY_DURATION_MS = 45_000;
  const playStart = Math.max(0, sr - PLAY_LEAD_MIN);
  const playEnd = Math.min(1439, ss + PLAY_LEAD_MIN);
  const playPosRef = useRef(playStart);

  useEffect(() => {
    if (!playing) return;
    const span = Math.max(60, playEnd - playStart);
    const tickMs = 100;
    const step = (span / PLAY_DURATION_MS) * tickMs;
    const id = window.setInterval(() => {
      let next = playPosRef.current + step;
      if (next > playEnd) next = playStart;
      playPosRef.current = next;
      setTimeScrubMinutes(Math.round(next));
    }, tickMs);
    return () => window.clearInterval(id);
  }, [playing, playStart, playEnd, setTimeScrubMinutes]);

  const startPlay = () => {
    const current = timeScrubMinutes;
    playPosRef.current =
      current !== null && current >= playStart && current < playEnd
        ? current
        : playStart;
    setTimeScrubMinutes(Math.round(playPosRef.current));
    setPlaying(true);
  };

  const jumpTo = (minutes: number) => {
    setPlaying(false);
    setTimeScrubMinutes(minutes);
  };

  const resetAll = () => {
    setPlaying(false);
    resetTimeTravel();
    setDebugOverride(null);
    setSceneOverrides({});
  };

  // --- Tune fold -----------------------------------------------------------
  const [tuneOpen, setTuneOpen] = useState(false);
  const setTune = (patch: Partial<typeof sceneOverrides>) =>
    setSceneOverrides({ ...sceneOverrides, ...patch });
  const clearTune = (key: keyof typeof sceneOverrides) => {
    const next = { ...sceneOverrides };
    delete next[key];
    setSceneOverrides(next);
  };

  // The four tweakable numbers: slider value ↔ scene value, one row each.
  const percent = (v: number) => `${v}%`;
  const tune: {
    key: keyof typeof sceneOverrides;
    label: string;
    aria: string;
    value: number;
    max: number;
    format: (v: number) => string;
    toScene: (v: number) => number;
  }[] = [
    { key: "cloudCover", label: zh ? "云量" : "Cloud", aria: "Cloud", value: Math.round(scene.clouds.cover * 100), max: 100, format: percent, toScene: (v) => v / 100 },
    { key: "precipitationIntensity", label: zh ? "降水" : "Precip", aria: "Precip", value: Math.round(scene.precipitation.intensity * 100), max: 100, format: percent, toScene: (v) => v / 100 },
    { key: "windSpeedKmh", label: zh ? "风速" : "Wind", aria: "Wind", value: Math.round(sceneOverrides.windSpeedKmh ?? weather?.windSpeedKmh ?? 8), max: 60, format: (v) => `${v} km/h`, toScene: (v) => v },
    { key: "veilAmount", label: zh ? "遮罩" : "Veil", aria: "Veil", value: Math.round(scene.veil.amount * 100), max: 90, format: percent, toScene: (v) => v / 100 },
  ];

  // --- Readouts ------------------------------------------------------------
  const moonName = getMoonPhaseName(scene.moon.phase);
  const moonUpLabel = scene.moon.elevation > 0 ? (zh ? "在天上" : "up") : zh ? "在地平线下" : "set";
  const dateLabel = new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  }).format(nowDate);
  const conditionLabel = getWeatherConditionLabel(scene.condition, locale);

  return (
    <DebugSection
      id="sky"
      title={zh ? "天空" : "Sky"}
      icon={<Cloud className="h-4 w-4" />}
      action={
        anythingForced ? (
          <button
            onClick={resetAll}
            className={cn(PANEL_CHIP, "border-border/60 text-muted-foreground hover:text-foreground")}
            aria-label="Back to now"
            title={zh ? "回到真实的现在：时间、天气、微调全部复位" : "Back to real time and real weather; clears every tweak"}
          >
            <RotateCcw className="h-3 w-3" />
            {zh ? "现在" : "Now"}
          </button>
        ) : (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {zh ? "实时" : "Live"}
          </span>
        )
      }
    >
      <div className="space-y-3">
        {/* What the sky is right now — every field from the same scene. */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-1.5 text-[11px] font-mono">
          <span className="flex min-w-0 items-center gap-1.5 text-foreground/90">
            <WeatherIcon condition={scene.condition} isDay={isDayNow} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{conditionLabel}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="truncate">{PHASE_LABEL[lang][phase]}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="tabular-nums">{clock(clockMinutes)}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={zh ? "太阳高度角" : "Sun elevation"}>
              <Sun className="h-3 w-3" />
              {scene.sun.elevation.toFixed(0)}°
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={`${MOON_NAME[lang][moonName]} · ${moonUpLabel}`}
            >
              <MoonPhaseIcon phase={scene.moon.phase} mirror={scene.hemisphere === -1} className="h-3 w-3" />
              {Math.round(scene.moon.illumination * 100)}%
            </span>
          </span>
        </div>

        {/* The day. Painted with the sky's own colours for this condition;
            sunrise and sunset ticked; the playhead is the clock. */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {t(locale, "devtoolTimeOfDay")}
              {timeScrubMinutes !== null && (
                <PanelStar
                  onReset={() => jumpTo(realMinutes)}
                  source="session"
                  label={zh ? "回到当前时刻" : "Back to the real time of day"}
                />
              )}
            </span>
            <button
              onClick={() => (playing ? setPlaying(false) : startPlay())}
              className={cn(
                PANEL_CHIP,
                playing
                  ? "border-foreground/40 bg-accent text-accent-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              )}
              aria-label={playing ? "Pause sunrise to sunset" : "Play sunrise to sunset"}
              aria-pressed={playing}
              title={zh ? "从日出播放到日落" : "Play from dawn to dusk"}
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              <Sunrise className="h-3 w-3" />
              <span>→</span>
              <Sunset className="h-3 w-3" />
            </button>
          </div>
          <div
            className="relative h-10 overflow-hidden rounded-lg ring-1 ring-border/50"
            style={{ backgroundImage: dayGradient }}
          >
            {[sr, ss].map((m) => (
              <span
                key={m}
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-white/55 mix-blend-difference"
                style={{ left: pct(m) }}
              />
            ))}
            {isTimeTravelActive && (
              <span
                aria-hidden
                title={zh ? "真实的现在" : "Real now"}
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-white/70 mix-blend-difference"
                style={{ left: pct(realMinutes) }}
              />
            )}
            <input
              type="range"
              min={0}
              max={1439}
              step={1}
              value={clockMinutes}
              onChange={(e) => jumpTo(Number(e.target.value))}
              className={PLAYHEAD_INPUT}
              aria-label="Time of day scrub"
              aria-valuetext={clock(clockMinutes)}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Sunrise className="h-3 w-3" />
              {formatClockTime(sunriseMs, locale)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Sunset className="h-3 w-3" />
              {formatClockTime(sunsetMs, locale)}
            </span>
          </div>
          {/* Phase names: click to jump; the one the clock is in is lit. */}
          <div className="grid grid-cols-6 gap-1">
            {PHASE_ORDER.map((p) => {
              const current = phase === p;
              return (
                <button
                  key={p}
                  onClick={() => jumpTo(phaseTimes[p])}
                  aria-label={`Jump to ${p}`}
                  aria-current={current ? "time" : undefined}
                  title={`${PHASE_LABEL[lang][p]} · ${clock(phaseTimes[p])}`}
                  className={cn(
                    "truncate rounded-md px-0.5 py-1 text-[9px] font-mono transition-colors",
                    current
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}
                >
                  {PHASE_LABEL[lang][p]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Condition. Chips wear the day or night face of the clock above. */}
        <div className="space-y-1.5 border-t border-border/30 pt-2.5">
          <div className="flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5">
              {isDayNow ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {zh ? "天气" : "Condition"}
              {isOverridden && (
                <PanelStar
                  onReset={() => setDebugOverride(null)}
                  source="session"
                  label="Clear weather override"
                />
              )}
            </span>
            <span className="normal-case tracking-normal text-muted-foreground/70">
              {weather
                ? `${zh ? "实况" : "live"}: ${getWeatherConditionLabel(weather.condition, locale)}`
                : zh
                  ? "暂无实况"
                  : "no live weather"}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {WEATHER_CONDITION_LIST.map((condition) => {
              const selected = debugOverride?.condition === condition;
              const isLive = weather?.condition === condition;
              const preview = getWeatherGradient({ condition, isDay: isDayNow, theme });
              return (
                <button
                  key={condition}
                  onClick={() =>
                    setDebugOverride(selected ? null : { condition })
                  }
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border transition-all duration-200",
                    selected
                      ? "border-foreground/60 ring-2 ring-foreground/50"
                      : "border-border/40 hover:border-border"
                  )}
                  style={{ backgroundImage: preview }}
                  aria-label={`Set weather to ${getWeatherConditionLabel(condition, locale)}`}
                  aria-pressed={selected}
                  title={
                    selected
                      ? zh
                        ? "再点一次回到实况"
                        : "Click again for the live weather"
                      : getWeatherConditionLabel(condition, locale)
                  }
                >
                  <div className="absolute inset-0 bg-white/10 dark:bg-black/10" />
                  <div className="absolute inset-0 flex items-center justify-center text-foreground/70">
                    <WeatherIcon condition={condition} isDay={isDayNow} className="h-3.5 w-3.5" />
                  </div>
                  {isLive && (
                    <span
                      aria-hidden
                      className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-green-500 ring-1 ring-background"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* The date — which is what moves the moon. */}
        <div className="space-y-1.5 border-t border-border/30 pt-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {zh ? "日期 / 月相" : "Date / Moon"}
              {dayOffset !== 0 && (
                <PanelStar onReset={() => setDayOffset(0)} source="session" label={zh ? "回到今天" : "Back to today"} />
              )}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
              <MoonPhaseIcon phase={scene.moon.phase} mirror={scene.hemisphere === -1} />
              <span className="text-foreground/80">{MOON_NAME[lang][moonName]}</span>
            </span>
          </div>
          <PanelRange
            wide
            value={dayOffset}
            min={-15}
            max={15}
            step={1}
            onChange={setDayOffset}
            label="Date offset"
          />
          <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-muted-foreground">
            <span className={dayOffset !== 0 ? "text-foreground/80" : ""}>
              {dateLabel}
              {dayOffset !== 0 && ` (${dayOffset > 0 ? "+" : ""}${dayOffset}d)`}
            </span>
            <span>
              {zh ? "月亮" : "moon"} {scene.moon.elevation.toFixed(0)}° · {Math.round(scene.moon.azimuth)}°
              {" · "}
              {moonUpLabel}
            </span>
          </div>
        </div>

        {/* Fine-tune, folded: the derived numbers, each draggable. */}
        <div className="border-t border-border/30 pt-2">
          <button
            onClick={() => setTuneOpen((v) => !v)}
            aria-expanded={tuneOpen}
            aria-label="Toggle scene tuning"
            className="flex w-full items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground/80"
          >
            <span className="flex items-center gap-1.5">
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !tuneOpen && "-rotate-90")} />
              <SlidersHorizontal className="h-3 w-3" />
              {zh ? "微调" : "Tune"}
              {isTuned && (
                <PanelStar
                  onReset={() => setSceneOverrides({})}
                  source="session"
                  label={zh ? "清除微调" : "Clear tuning"}
                />
              )}
            </span>
            <span className="normal-case tracking-normal tabular-nums text-muted-foreground/70">
              {zh ? "云" : "cloud"} {Math.round(scene.clouds.cover * 100)}% ·{" "}
              {zh ? "降水" : "precip"} {Math.round(scene.precipitation.intensity * 100)}% ·{" "}
              {zh ? "风" : "wind"} {Math.round(sceneOverrides.windSpeedKmh ?? weather?.windSpeedKmh ?? 8)}
            </span>
          </button>
          {tuneOpen && (
            <div className="space-y-2 pt-2.5">
              {tune.map((row) => (
                <PanelSlider
                  key={row.key}
                  label={row.label}
                  ariaLabel={row.aria}
                  value={row.value}
                  min={0}
                  max={row.max}
                  step={1}
                  format={row.format}
                  star={
                    sceneOverrides[row.key] !== undefined ? (
                      <PanelStar
                        onReset={() => clearTune(row.key)}
                        source="session"
                        label={`Reset ${row.aria}`}
                      />
                    ) : null
                  }
                  onChange={(v) => setTune({ [row.key]: row.toScene(v) })}
                />
              ))}
              {weather && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-border/30 pt-2 text-[10px] font-mono text-muted-foreground">
                  <MetaRow k="code" v={String(weather.weatherCode)} />
                  <MetaRow k="cloud" v={weather.cloudCover === undefined ? "—" : `${Math.round(weather.cloudCover * 100)}%`} />
                  <MetaRow k="precip" v={weather.precipitationMmH === undefined ? "—" : `${weather.precipitationMmH} mm/h`} />
                  <MetaRow k="wind" v={weather.windSpeedKmh === undefined ? "—" : `${Math.round(weather.windSpeedKmh)} km/h`} />
                  <MetaRow k="sun" v={`${scene.sun.elevation.toFixed(1)}° · ${Math.round(scene.sun.azimuth)}°`} />
                  <MetaRow k="api" v={weather.isDay === undefined ? "—" : weather.isDay ? "day" : "night"} />
                </div>
              )}
            </div>
          )}
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
// Command Module
// The palette's shape on a phone. "Sheet" is the palette as it is; "Popover"
// is the desktop card at phone width — the palette as it was, kept whole so
// the two can be compared on the same device. A saved setting (blue star).
// =============================================================================

function CommandModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const { phonePalette, setPhonePalette } = useDevtool();
  const options: { value: PhonePalette; label: string; title: string }[] = [
    {
      value: "sheet",
      label: zh ? "抽屉" : "Sheet",
      title: zh ? "底部 action sheet（现在）" : "Bottom sheet (current)",
    },
    {
      value: "popover",
      label: zh ? "浮窗" : "Popover",
      title: zh ? "桌面浮窗，手机宽度（以前）" : "Desktop card at phone width (previous)",
    },
  ];

  return (
    <DebugSection
      id="command"
      title={zh ? "命令" : "Command"}
      icon={<CommandIcon className="h-4 w-4" />}
      compact
      defaultCollapsed
    >
      <PanelRow
        label={zh ? "手机面板" : "Phone palette"}
        star={
          phonePalette !== PHONE_PALETTE_DEFAULT ? (
            <PanelStar
              source="saved"
              onReset={() => setPhonePalette(PHONE_PALETTE_DEFAULT)}
            />
          ) : undefined
        }
      >
        <PanelSegmented value={phonePalette} options={options} onChange={setPhonePalette} />
      </PanelRow>
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
      defaultCollapsed
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
                        : "text-quaternary-foreground hover:text-muted-foreground",
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
      defaultCollapsed
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
