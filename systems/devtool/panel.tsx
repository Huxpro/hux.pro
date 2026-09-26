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
import { useAmbientTime, useLocation, useSolarTheme, useWallpaper, useWeather } from "@/systems/ambient";
import { BEZEL_BAND_MAX, BEZEL_BAND_MIN, BEZEL_RADIUS_MAX } from "vitre";
import {
  DEFAULT_BEZEL_TINT,
  isBezelHex,
  type BezelTint,
} from "@/systems/ambient/lib/bezel";

/** The named tints plus the segmented control's own "pick a colour". */
type TintChoice = "black" | "dark" | "theme" | "custom";
import { formatClockTime } from "@/systems/ambient/lib/format";
import { gravityTiltDegrees, readGravity } from "@/systems/ambient/lib/gyroscope";
import { getWeatherGradient, getWeatherStyleGradient } from "@/systems/ambient/lib/gradient";
import type { AmbientPhase } from "@/systems/ambient/lib/phase";
import {
  meteorSkyIsOpen,
  meteorWindows,
  meteorWindowSpan,
  METEOR_SUN_MAX_DEG,
} from "@/systems/ambient/lib/poke";
import {
  daySceneAt,
  deriveWeatherScene,
  rgbToCss,
  sampleDaySky,
  toSceneWeather,
  type DaySampleParams,
} from "@/systems/ambient/lib/scene";
import {
  getMoonPhaseName,
  startOfLocalDay,
  DAY_MINUTES,
  DEFAULT_SUNRISE_MINUTES,
  DEFAULT_SUNSET_MINUTES,
  minutesOfDay,
  type MoonPhaseName,
} from "@/systems/ambient/lib/solar";
import type { WallpaperStats } from "@/systems/ambient/lib/wallpaper/renderer";
import {
  getWallpaperPlayName,
  getWeatherWallpaperName,
  WEATHER_STYLE_LABEL,
  WEATHER_STYLE_META,
  WEATHER_STYLES,
  type WeatherStyle,
} from "@/systems/ambient/lib/wallpaper";
import {
  WEATHER_CONDITION_LIST,
  getWeatherConditionLabel,
  type WeatherCondition,
} from "@/systems/ambient/lib/weather";
import {
  sectionFoldKey,
  useDevtool,
  DRAGGABLE_INSTANCES,
  DRAGGABLE_DEFAULTS,
  PHONE_PALETTE_DEFAULT,
  HOME_WEATHER_DEFAULT,
  type HomeWeather,
  type PhonePalette,
} from "./provider";
import { useHeroExit } from "@/components/ui/hero-exit";
import { useOptionalAbout } from "@/systems/about/provider";
import {
  GLOW_TUNING_DEFAULTS,
  setGlowTuning,
  useGlowTuning,
  type GlowTuning,
} from "@/systems/glow";
import { useOptionalWindows } from "@/systems/windows";
import { useOptionalMusic } from "@/systems/music/provider";
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
  setReadingSize,
  setReadingFocus,
  useReadingFont,
  useReadingMeasure,
  useReadingSize,
  useReadingFocus,
  type ReadingFont,
  type ReadingMeasure,
  type ReadingSize,
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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Segmented, Switch } from "@/components/ui/controls";
import { Slider } from "@/components/ui/slider";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// =============================================================================
// Devtool content — the modules, and nothing about where they are shown.
//
// The devtool is hosted in three different shells over its life (a bottom
// sheet, a floating window, and neither while it is a pill), and none of that
// is this file's business. `dock.tsx` owns the shells and the gesture that
// moves between them; here are the modules and the footer that go inside
// whichever one is up.
// =============================================================================

/**
 * The modules' ids, in the order they are rendered — so the rail reads in the
 * same order as the list it indexes. Keep in step with `DevtoolModules`.
 */
const MODULE_ORDER = [
  "frontmatter",
  "reading",
  "wallpaper",
  "glass",
  "sky",
  "music",
  "command",
  "glow",
  "draggable",
  "windows",
] as const;

/** The module list. Whatever is hosting it supplies the scroll area. */
export function DevtoolModules() {
  return (
    <>
      <FrontmatterModule />
      <ReadingModule />
      <WallpaperModule />
      <GlassModule />
      <SkyModule />
      <MusicModule />
      <CommandModule />
      <GlowModule />
      <DraggableModule />
      <WindowsModule />
    </>
  );
}

// =============================================================================
// Sections — what the modules tell the rail about themselves
//
// Every module knows two things about itself the panel as a whole cannot:
// whether it matters here and now (`relevant`), and whether anything inside it
// is off its default (`star`). Relevance decides the fold until one is chosen
// by hand; the star says "look in here" while the module is folded. The rail
// needs both for every module at once, so each <DebugSection> reports them
// here as it renders — the modules stay the only place that knows.
// =============================================================================

/** Off its default: amber for this session only, sky for a saved setting. */
type Star = "session" | "saved" | null;

interface SectionEntry {
  id: string;
  title: string;
  icon: React.ReactNode;
  relevant: boolean;
  star: Star;
}

interface SectionsApi {
  register: (entry: SectionEntry) => void;
  unregister: (id: string) => void;
  setNode: (id: string, node: HTMLElement | null) => void;
}

interface SectionsState {
  /** Registered sections, in {@link MODULE_ORDER}. */
  entries: SectionEntry[];
  /** Scroll the module list so this section's header is at the top. */
  scrollTo: (id: string) => void;
}

// Two contexts so a section reporting itself does not re-render every other
// section: they only hold the (stable) api; the rail reads the entries.
const SectionsApiContext = createContext<SectionsApi | null>(null);
const SectionsContext = createContext<SectionsState | null>(null);

/**
 * Wraps a shell's whole body — rail and modules both — so the two can meet.
 * `scrollRef` is the shell's scroll area, which the rail scrolls.
 */
export function DevtoolSections({
  scrollRef,
  children,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const [byId, setById] = useState<Record<string, SectionEntry>>({});
  const nodes = useRef(new Map<string, HTMLElement>());

  const api = useMemo<SectionsApi>(
    () => ({
      register: (entry) =>
        setById((prev) => {
          const old = prev[entry.id];
          // The icon is a fresh element every render and never changes, so
          // it is not a reason to re-render the rail.
          if (
            old &&
            old.title === entry.title &&
            old.relevant === entry.relevant &&
            old.star === entry.star
          ) {
            return prev;
          }
          return { ...prev, [entry.id]: entry };
        }),
      unregister: (id) =>
        setById((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        }),
      setNode: (id, node) => {
        if (node) nodes.current.set(id, node);
        else nodes.current.delete(id);
      },
    }),
    []
  );

  const scrollTo = useCallback(
    (id: string) => {
      const container = scrollRef.current;
      const node = nodes.current.get(id);
      if (!container || !node) return;
      const top =
        node.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop;
      container.scrollTo({ top, behavior: "smooth" });
    },
    [scrollRef]
  );

  const state = useMemo<SectionsState>(
    () => ({
      entries: MODULE_ORDER.flatMap((id) => (byId[id] ? [byId[id]] : [])),
      scrollTo,
    }),
    [byId, scrollTo]
  );

  return (
    <SectionsApiContext.Provider value={api}>
      <SectionsContext.Provider value={state}>{children}</SectionsContext.Provider>
    </SectionsApiContext.Provider>
  );
}

/**
 * The rail: one icon per module, above the list. Three things at a glance —
 * a dot under the ones that matter here, a star on the ones with something
 * changed inside, a filled chip on the ones that are open.
 *
 * A tap is "show me this one": it opens that module, folds the rest, and
 * scrolls to it. Tapping it again gives the folds back to relevance and your
 * own choices. With Shift (or ⌘ / Ctrl / Alt) a tap opens the module without
 * folding anything else. The rail's folds are for getting around, so they are
 * never saved, and a new page starts without them.
 */
export function DevtoolRail() {
  const sections = useContext(SectionsContext);
  const { isSectionCollapsed, railFolds, solo, setRailFolds } = useDevtool();
  if (!sections || sections.entries.length === 0) return null;
  const { entries, scrollTo } = sections;

  const pick = (e: React.MouseEvent, entry: SectionEntry) => {
    const key = sectionFoldKey(entry.id, entry.relevant);
    if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) {
      setRailFolds({ ...railFolds, [key]: false }, solo);
    } else if (solo === entry.id) {
      setRailFolds({}, null);
    } else {
      setRailFolds(
        Object.fromEntries(
          entries.map((x) => [sectionFoldKey(x.id, x.relevant), x.id !== entry.id])
        ),
        entry.id
      );
    }
    // After the folds have rendered, so the offset is the one it will have.
    requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(entry.id)));
  };

  return (
    <div
      role="toolbar"
      aria-label="Devtool modules"
      className="flex items-center justify-between gap-0.5 border-b border-border/40 px-3 pb-2"
    >
      {entries.map((entry) => {
        const open = !isSectionCollapsed(
          sectionFoldKey(entry.id, entry.relevant),
          !entry.relevant
        );
        return (
          <button
            key={entry.id}
            onClick={(e) => pick(e, entry)}
            title={entry.title}
            aria-label={entry.title}
            aria-pressed={open}
            className={cn(
              "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
              "[&_svg]:h-3.5 [&_svg]:w-3.5",
              open
                ? "bg-muted/70 text-foreground"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground/80",
              solo === entry.id && "ring-1 ring-border"
            )}
          >
            {entry.icon}
            {entry.relevant && (
              <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-current opacity-70" />
            )}
            {entry.star && (
              <span
                className={cn(
                  "absolute right-0.5 top-0 font-mono text-[10px] leading-none",
                  entry.star === "session" ? "text-amber-500/80" : "text-sky-500/80"
                )}
              >
                *
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The wallpaper is the page: the ambient modules matter most here. */
function useIsHome(): boolean {
  return usePathname() === "/";
}

/** The strongest of several stars: a session override outranks a saved one. */
function strongest(...stars: Star[]): Star {
  if (stars.includes("session")) return "session";
  if (stars.includes("saved")) return "saved";
  return null;
}

/** The status line under the modules: how to toggle, and how to turn it off. */
export function DevtoolFooter() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const { toggleEnabled } = useDevtool();

  return (
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
  );
}

/** The header's title: the bug, the name, the DEV badge. */
export function DevtoolTitle() {
  const { locale } = useLocale();
  return (
    <span className="flex items-center gap-2">
      <Bug className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">
        {locale === "zh" ? "调试面板" : "Devtool Panel"}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] leading-none normal-case tracking-normal">
        DEV
      </span>
    </span>
  );
}

// =============================================================================
// Windows Module
// Inspects the app windows that are open, front-most first: what each one is
// running and where it sits. Launching apps and loading a bundle by URL are
// the command palette's job (⌘K → Apps), so they are not repeated here.
// =============================================================================

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-right text-foreground/80">{v}</span>
    </div>
  );
}

/** Where a window's code comes from: the web, a bundle we ship, or one fetched. */
function windowSource(app: AppLink): string {
  if (app.runtime !== "lynx") return "web";
  return app.bundleUrl?.startsWith("http") ? "online" : "built-in";
}

function WindowsModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const win = useOptionalWindows();
  if (!win) return null;

  const windows = [...win.windows].sort((a, b) => b.z - a.z);

  return (
    <DebugSection
      id="windows"
      title={zh ? "窗口" : "Windows"}
      icon={<AppWindow className="h-4 w-4" />}
      compact={!windows.length}
      relevant={windows.length > 0}
      action={
        windows.length ? (
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
            {windows.length}
          </span>
        ) : null
      }
    >
      {!windows.length ? (
        <div className="text-[10px] font-mono text-tertiary-foreground">
          {zh ? "没有打开的窗口" : "No open windows"}
        </div>
      ) : (
        <div className="space-y-2.5">
          {windows.map((w, i) => {
            const { app, rect } = w;
            const location = app.runtime === "lynx" ? app.bundleUrl : app.url;
            return (
              <div
                key={w.id}
                className={cn("space-y-1.5", i > 0 && "border-t border-border/30 pt-2.5")}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 truncate text-xs font-mono text-foreground/90">
                    {app.title}
                  </span>
                  {w.id === win.focusedId && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      {zh ? "焦点" : "focused"}
                    </span>
                  )}
                  {w.mode === "minimized" && (
                    <span className="text-[10px] font-mono uppercase tracking-wider text-tertiary-foreground px-1.5 py-0.5 border border-border/50 rounded">
                      {zh ? "已最小化" : "minimized"}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-mono text-muted-foreground">
                  <MetaRow
                    k="runtime"
                    v={app.runtime === "lynx" ? `lynx · ${app.flavor ?? "react"}` : "web"}
                  />
                  <MetaRow k="source" v={windowSource(app)} />
                  <MetaRow k="size" v={w.sizePreset} />
                  <MetaRow k="reloads" v={String(w.generation)} />
                  <div className="col-span-2">
                    <MetaRow
                      k="rect"
                      v={`${Math.round(rect.x)},${Math.round(rect.y)} · ${Math.round(rect.width)}×${Math.round(rect.height)}`}
                    />
                  </div>
                </div>
                {location && (
                  <div className="text-[10px] font-mono text-tertiary-foreground break-all">
                    {location}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </DebugSection>
  );
}

// =============================================================================
// Debug Section Component
// =============================================================================

interface DebugSectionProps {
  /** Stable id: the rail's, and the key its folds are saved under. */
  id: string;
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Tighter vertical padding for lightweight content (toggles, buttons) */
  compact?: boolean;
  /**
   * Whether this module matters here and now. Unfolded when it does, folded
   * when it does not — until a fold is chosen by hand, which is remembered
   * separately for each answer.
   */
  relevant: boolean;
  /** Something inside is off its default. Shown beside the title, and on the rail. */
  star?: Star;
  /**
   * Put everything in the module back to its default. With it, the title's
   * star is a button: pressing it resets the whole module, as a row's star
   * resets its row.
   */
  onReset?: () => void;
}

function DebugSection({
  id,
  title,
  icon,
  action,
  children,
  compact,
  relevant,
  star = null,
  onReset,
}: DebugSectionProps) {
  // The title is the natural click target; the `action` slot stays a separate
  // sibling so its controls (toggles, copy) keep working without toggling the
  // fold.
  const { isSectionCollapsed, setSectionCollapsed } = useDevtool();
  const sections = useContext(SectionsApiContext);
  const foldKey = sectionFoldKey(id, relevant);
  const collapsed = isSectionCollapsed(foldKey, !relevant);

  useEffect(() => {
    sections?.register({ id, title, icon, relevant, star });
  }, [sections, id, title, icon, relevant, star]);
  useEffect(() => () => sections?.unregister(id), [sections, id]);
  const setNode = useCallback(
    (node: HTMLDivElement | null) => sections?.setNode(id, node),
    [sections, id]
  );

  return (
    <div ref={setNode} className="border-b border-border/30 last:border-b-0">
      <div className="px-4 py-2 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-1 min-w-0 items-center">
            <button
              onClick={() => setSectionCollapsed(foldKey, !collapsed)}
              className={cn(
                "flex items-center gap-2 min-w-0",
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
            {star &&
              (onReset ? (
                <button
                  onClick={onReset}
                  className={cn(
                    "ml-0.5 shrink-0 text-xs font-mono transition-colors",
                    star === "session"
                      ? "text-amber-500/80 hover:text-amber-400"
                      : "text-sky-500/80 hover:text-sky-400"
                  )}
                  title={`Reset ${title} to its defaults`}
                  aria-label={`Reset ${title} to its defaults`}
                >
                  *
                </button>
              ) : (
                <span
                  className={cn(
                    "ml-0.5 shrink-0 text-xs font-mono",
                    star === "session" ? "text-amber-500/80" : "text-sky-500/80"
                  )}
                  title={
                    star === "session"
                      ? "Something in here is overridden for this session"
                      : "Something in here is off its default"
                  }
                >
                  *
                </span>
              ))}
            {/* The rest of the title bar folds too, as it did when the title
                button spanned it; the star is a button of its own beside it. */}
            <div
              aria-hidden
              className="flex-1 self-stretch cursor-pointer"
              onClick={() => setSectionCollapsed(foldKey, !collapsed)}
            />
          </div>
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
      relevant={pageMeta !== null}
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

/**
 * The shared controls in the devtool's voice. Both take their props straight
 * from the component so the panel cannot drift from it — the hand-written
 * shadow types these replaced had already lost `Segmented`'s `label`, which
 * left every segmented group in here without an accessible name.
 */
function PanelToggle(props: Omit<React.ComponentProps<typeof Switch>, "tone">) {
  return <Switch tone="system" {...props} />;
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

function PanelSegmented<T extends string>(
  props: Omit<React.ComponentProps<typeof Segmented<T>>, "tone">
) {
  return <Segmented tone="system" {...props} />;
}

/** The reading defaults, where the stores keep them. */
const READING_DEFAULT = {
  font: "sans",
  size: "default",
  measure: "default",
  bleed: true,
  focus: false,
  side: "right",
} as const;

/** One letter per step, as the segmented controls label them. */
const STEP_LETTER = {
  small: "S",
  narrow: "S",
  default: "M",
  large: "L",
  wide: "L",
} as const;

function ReadingModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const { pageMeta } = useDevtool();
  const font = useReadingFont();
  const size = useReadingSize();
  const measure = useReadingMeasure();
  const bleed = useBleedEnabled();
  const focus = useReadingFocus();
  const side = useRulerSide();

  const fonts: { value: ReadingFont; label: string }[] = [
    { value: "sans", label: zh ? "无衬线" : "Sans" },
    { value: "serif", label: zh ? "衬线" : "Serif" },
  ];
  const sizes: { value: ReadingSize; label: string; title: string }[] = [
    { value: "small", label: zh ? "小" : "S", title: zh ? "小" : "Small" },
    { value: "default", label: zh ? "中" : "M", title: zh ? "标准" : "Default" },
    { value: "large", label: zh ? "大" : "L", title: zh ? "大" : "Large" },
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

  // Every one of these is a saved setting, so a blue star where it is changed.
  const saved = (changed: boolean, reset: () => void) =>
    changed ? <PanelStar source="saved" onReset={reset} /> : null;
  const changed =
    font !== READING_DEFAULT.font ||
    size !== READING_DEFAULT.size ||
    measure !== READING_DEFAULT.measure ||
    bleed !== READING_DEFAULT.bleed ||
    focus !== READING_DEFAULT.focus ||
    side !== READING_DEFAULT.side;

  const summary = [
    font,
    `${STEP_LETTER[size]}/${STEP_LETTER[measure]}`,
    focus && "focus",
    !bleed && "no bleed",
    side === "left" && "ruler L",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DebugSection
      id="reading"
      title={zh ? "阅读" : "Reading"}
      icon={<BookOpen className="h-4 w-4" />}
      compact
      relevant={pageMeta !== null}
      star={changed ? "saved" : null}
      action={
        <span className="text-[10px] font-mono text-muted-foreground">{summary}</span>
      }
    >
      <div className="space-y-3">
        <PanelRow
          label={zh ? "字体" : "Typeface"}
          star={saved(font !== READING_DEFAULT.font, () => setReadingFont(READING_DEFAULT.font))}
        >
          <PanelSegmented value={font} options={fonts} onChange={setReadingFont} />
        </PanelRow>
        <PanelRow
          label={zh ? "字号" : "Size"}
          star={saved(size !== READING_DEFAULT.size, () => setReadingSize(READING_DEFAULT.size))}
        >
          <PanelSegmented value={size} options={sizes} onChange={setReadingSize} />
        </PanelRow>
        <PanelRow
          label={zh ? "宽度" : "Measure"}
          star={saved(measure !== READING_DEFAULT.measure, () =>
            setReadingMeasure(READING_DEFAULT.measure)
          )}
        >
          <PanelSegmented
            value={measure}
            options={measures}
            onChange={setReadingMeasure}
          />
        </PanelRow>
        <PanelRow
          label={zh ? "满溢出血" : "Media bleed"}
          star={saved(bleed !== READING_DEFAULT.bleed, () => setBleedEnabled(READING_DEFAULT.bleed))}
        >
          <PanelToggle
            on={bleed}
            onClick={() => setBleedEnabled(!bleed)}
            label="Toggle media bleed"
          />
        </PanelRow>
        <PanelRow
          label={zh ? "专注模式" : "Focus mode"}
          star={saved(focus !== READING_DEFAULT.focus, () => setReadingFocus(READING_DEFAULT.focus))}
        >
          <PanelToggle
            on={focus}
            onClick={() => setReadingFocus(!focus)}
            label="Toggle focus mode"
          />
        </PanelRow>
        <PanelRow
          label={zh ? "标尺停靠" : "Ruler dock"}
          star={saved(side !== READING_DEFAULT.side, () => setRulerSide(READING_DEFAULT.side))}
        >
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
  const isHome = useIsHome();
  const star: Star = glass.tint !== "neutral" ? "saved" : null;

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
      relevant={isHome}
      star={star}
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
    play,
    playAlbum,
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
  const { heroExitOverride, setHeroExitOverride } = useDevtool();
  const heroExit = useHeroExit();
  const isHome = useIsHome();
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
  // a tint, it is "whatever the swatch says". Every row here is live; vitre
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

  // The rows' stars, summed for the header. Only the rows that are showing:
  // the bezel's saved rows count while the bezel is on, the style while the
  // kind is Weather — a star has to be findable once the module is open.
  const sessionOverridden =
    Object.values(devtoolOverrides).some((v) => v !== undefined) ||
    heroExitOverride !== undefined;
  const savedChanged =
    (!isImage && weatherStyle !== "sky") ||
    (bezel &&
      (bezelTint !== DEFAULT_BEZEL_TINT ||
        bezelBandSetting !== null ||
        bezelRadiusSetting !== null)) ||
    !readingBlur ||
    !readingDim;
  const star = strongest(
    sessionOverridden ? "session" : null,
    savedChanged ? "saved" : null
  );

  // One line that answers "what am I actually looking at".
  const weatherName = getWeatherWallpaperName(locale, weatherStyle);
  const now = [
    isImage
      ? play !== "off" && playAlbum
        ? `${getWallpaperPlayName(locale, play, playAlbum)} · ${wallpaper.name}`
        : wallpaper.name
      : weatherName,
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
      relevant={isHome || star === "session"}
      star={star}
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
              ? play !== "off" && playAlbum
                ? `${getWallpaperPlayName(locale, play, playAlbum)} · ${wallpaper.name}`
                : wallpaper.name
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
          {/* How the hero leaves: in flow (home's lift) or sticky-and-fade
              (blog / work / prompt). The platform picks; this pins one. */}
          <PanelRow
            label={zh ? "标题离场" : "Hero exit"}
            star={
              heroExitOverride !== undefined ? (
                <PanelStar
                  onReset={() => setHeroExitOverride(undefined)}
                  source="session"
                />
              ) : null
            }
          >
            <PanelSegmented<"scroll" | "fade">
              value={heroExit}
              options={[
                { value: "scroll", label: zh ? "滚走" : "Scroll" },
                { value: "fade", label: zh ? "淡出" : "Fade" },
              ]}
              onChange={setHeroExitOverride}
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

/**
 * A shooting star: a head with motion streaks trailing it.
 *
 * Tabler Icons' `comet`, inlined — MIT, Copyright (c) 2020-2026 Paweł Kuna
 * (https://tabler.io/icons). One glyph does not earn a dependency, and the
 * drawing conventions are the same as the icon set the rest of this panel uses
 * (24 x 24, 2px stroke, round caps and joins), so it sits among them without
 * looking imported.
 *
 * Drawing one by hand is the trap here: at this size a tapering streak reads
 * as a mouse cursor and a thin one as a pin. Judge any replacement by rendering
 * it at the size it ships at, over the real chip gradients, in both themes.
 */
function MeteorMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-3 w-3 shrink-0", className)}
      aria-hidden
    >
      <path d="M15.5 18.5l-3 1.5l.5 -3.5l-2 -2l3 -.5l1.5 -3l1.5 3l3 .5l-2 2l.5 3.5l-3 -1.5" />
      <path d="M4 4l7 7" />
      <path d="M9 4l3.5 3.5" />
      <path d="M4 9l3.5 3.5" />
    </svg>
  );
}

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


const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Any bearing onto 0…359. The track below runs past 360, so this is not idle. */
const wrap360 = (deg: number) => ((deg % 360) + 360) % 360;

/** The eight-point name for a met wind direction, for the devtool's readout. */
function compassPoint(deg: number): string {
  return COMPASS[Math.round(wrap360(deg) / 45) % 8];
}

/**
 * Where the wind-direction slider starts, and why it is not at 0°.
 *
 * `wind.x` is `sin(from) × hemisphere × speed`, so a track running 0 → 359
 * goes calm → right → calm → left → calm: both ends dead, and the direction
 * you drag bears no relation to the direction the rain leans. The track runs
 * **270° → 450°** instead — west, through north, to east — which is monotonic
 * the whole way: drag left and the rain leans left, drag right and it leans
 * right, and the middle is the one bearing that has no crosswind in it.
 *
 * Nothing is lost by covering half the compass. The sky only ever shows a
 * wind's east–west component (the screen looks south; the north–south part
 * blows along the view axis), and `sin(180° − d) === sin(d)`, so every
 * southerly bearing paints exactly what its northerly mirror does.
 */
const WIND_TRACK_MIN = 270;
const WIND_TRACK_MAX = 450;

/** Fold any bearing onto the one inside the track that blows the same way. */
function toWindTrack(deg: number): number {
  let d = wrap360(Math.round(deg));
  if (d > 90 && d <= 270) d = 180 - d;
  else if (d > 270) d -= 360;
  return d + 360;
}

/** Which way a bearing pushes the rain, for the readout. */
function leanArrow(deg: number, hemisphere: 1 | -1): string {
  const x = Math.sin((deg * Math.PI) / 180) * hemisphere;
  return x > 0.02 ? "→" : x < -0.02 ? "←" : "·";
}

/** Minutes in a day — the scrub's range, and one loop of Play. */

/**
 * The transport: a minute for the day, or half of one. Two buttons rather than
 * a speed on one, so a glance says which is running and either is one press
 * away from the other.
 */
const PLAY_RATES = [
  { rate: 1, label: { en: "Day", zh: "一天" } },
  { rate: 2, label: { en: "2×", zh: "2×" } },
] as const;

/** The quiet outlined chip the Sky module's Now and Play buttons are made of. */
/**
 * The ink every mark on the day timeline is drawn in. White through
 * `mix-blend-difference`, so one value stays legible over a night that is
 * nearly black and a noon that is nearly white — which is the whole reason the
 * strip can carry marks at all. One constant because it was four literals at
 * two different alphas, under a comment claiming they were the same.
 */
const TIMELINE_INK = "border-white/60 bg-white/60 mix-blend-difference";

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
  const {
    location,
    refresh: refreshLocation,
    isFetching: locationFetching,
  } = useLocation();
  const {
    weather,
    scene,
    sceneWeather,
    debugOverride,
    setDebugOverride,
    sceneOverrides,
    setSceneOverrides,
    refresh: refreshWeather,
    isFetching: weatherFetching,
  } = useWeather();
  const isHome = useIsHome();
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
  const { followSun, setFollowSun, sunTheme } = useSolarTheme();
  const { gyro, setGyroEnabled, effectiveStyle } = useWallpaper();
  const { homeWeather, setHomeWeather } = useDevtool();

  const isDayNow = scene.sun.isDay;
  const isOverridden = debugOverride !== null;
  const isTuned = Object.keys(sceneOverrides).length > 0;
  const anythingForced = isTimeTravelActive || isOverridden || isTuned;
  const refetching = locationFetching || weatherFetching;

  // --- The day ------------------------------------------------------------
  const dayStartMs = startOfLocalDay(nowMs);
  /** A clock reading for minutes past midnight, in the locale's format. */
  const clock = (minutes: number) => formatClockTime(dayStartMs + minutes * 60_000, locale);
  const lat = location?.lat;
  const lon = location?.lon;

  // Everything a walk down this day needs. One object for both the strip's
  // colours and the meteor's window, so the day they draw cannot drift apart
  // with one edit — and keyed on the DAY, not the instant, so scrubbing or
  // playing the clock does not redo any of it.
  const daySample: DaySampleParams = useMemo(
    () => ({
      dayMs: dayStartMs,
      lat,
      lon,
      weather: sceneWeather,
      theme,
      overrides: sceneOverrides,
    }),
    [dayStartMs, lat, lon, sceneWeather, theme, sceneOverrides]
  );

  // The strip: 72 scenes across the day for the *current* condition, so a
  // forced Thunder greys the whole day and a clear day glows at both ends.
  const dayGradient = useMemo(() => {
    const stops = sampleDaySky(daySample).map(
      (c, i, all) => `${rgbToCss(c)} ${((i / (all.length - 1)) * 100).toFixed(1)}%`
    );
    return `linear-gradient(90deg, ${stops.join(", ")})`;
  }, [daySample]);

  /** When a meteor is possible today, for the bands under the strip. */
  const starWindows = useMemo(
    () => meteorWindows(daySceneAt(daySample)),
    [daySample]
  );

  /**
   * The window as a line of text — usually one night, so usually the two
   * intervals the strip needs rejoined. `meteorWindowSpan` owns that, next to
   * the code that split them.
   */
  const span = meteorWindowSpan(starWindows);
  const meteorWindowLabel = span
    ? `${clock(span.from)} → ${clock(span.to % DAY_MINUTES)}`
    : zh
      ? "无"
      : "none";

  // Which conditions you could see a meteor THROUGH — the weather half of the
  // window, asked of the scene each chip would actually produce, overrides and
  // all. So it answers the question somebody about to click it has: if I picked
  // this one now, could I see one? Pulling the cloud slider down lights Cloudy
  // up, and while that override stands it takes Clear with it, because a clear
  // sky under 70% forced cloud really has no meteor in it.
  //
  // Deliberately not the whole rule: the chips answer "through which weather",
  // the strip above answers "when", and a chip that went dark at noon would be
  // answering the strip's question badly. Which is also why the day is the key
  // and not the clock: `clarity` does not move over a day, so an answer keyed
  // on the instant would be six ephemerides thrown away on every frame of
  // playback.
  const meteorConditions = useMemo(() => {
    const open = new Set<WeatherCondition>();
    for (const condition of WEATHER_CONDITION_LIST) {
      const scene = deriveWeatherScene({
        nowMs: dayStartMs,
        lat,
        lon,
        theme,
        // Through `toSceneWeather`, which is the one function that knows what
        // forcing a condition MEANS: the real measurements go away, because a
        // measured cover of 10% is a fact about today's clear sky and not about
        // the overcast being previewed.
        weather: toSceneWeather(weather, { condition }, { sunriseMs, sunsetMs }),
        overrides: sceneOverrides,
      });
      if (meteorSkyIsOpen(scene)) open.add(condition);
    }
    return open;
  }, [dayStartMs, lat, lon, theme, weather, sunriseMs, sunsetMs, sceneOverrides]);

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
  const pct = (m: number) => `${((m / DAY_MINUTES) * 100).toFixed(2)}%`;

  // --- Play: the day, on a loop ---------------------------------------------
  // It runs the playhead, nothing else: from wherever the clock is, through
  // midnight, round again. It used to start by jumping to 90 minutes before
  // sunrise and stop 90 after sunset, which is a second way of choosing a time
  // on a panel whose whole top half is for choosing a time — the strip, the
  // phase names and the sun's own ticks are right there. Pick a moment, then
  // press play from it.
  /** 0 is paused; otherwise the multiple of `PLAY_DURATION_MS` being played. */
  const [playRate, setPlayRate] = useState(0);
  const playing = playRate > 0;
  /** A day, once through, at 1×. */
  const PLAY_DURATION_MS = 60_000;
  const playPosRef = useRef(0);

  useEffect(() => {
    if (!playRate) return;
    const tickMs = 100;
    const step = ((DAY_MINUTES * playRate) / PLAY_DURATION_MS) * tickMs;
    const id = window.setInterval(() => {
      playPosRef.current = (playPosRef.current + step) % DAY_MINUTES;
      setTimeScrubMinutes(Math.round(playPosRef.current) % DAY_MINUTES);
    }, tickMs);
    return () => window.clearInterval(id);
  }, [playRate, setTimeScrubMinutes]);

  /**
   * One button per speed: pressing the lit one pauses, pressing the other
   * changes speed without starting over — the playhead is where it is, and
   * only the step it moves by changes.
   */
  const play = (rate: number) => {
    if (playRate === rate) {
      setPlayRate(0);
      return;
    }
    if (!playing) {
      playPosRef.current = timeScrubMinutes ?? realMinutes;
      setTimeScrubMinutes(Math.round(playPosRef.current));
    }
    setPlayRate(rate);
  };

  const jumpTo = (minutes: number) => {
    setPlayRate(0);
    setTimeScrubMinutes(minutes);
  };

  const resetAll = () => {
    setPlayRate(0);
    resetTimeTravel();
    setDebugOverride(null);
    setSceneOverrides({});
  };

  // --- Gyroscope -----------------------------------------------------------
  // The live tilt, polled rather than subscribed: a readout is worth twice a
  // second, not sixty times — the sky itself gets every reading.
  const [tiltDeg, setTiltDeg] = useState<number | null>(null);
  useEffect(() => {
    if (gyro.readings !== "live") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync: clear a stale readout
      setTiltDeg(null);
      return;
    }
    const tick = () => setTiltDeg(Math.round(gravityTiltDegrees(readGravity())));
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [gyro.readings]);

  // Seven states, in the order they rule each other out: what the browser can
  // do, then what the visitor asked for, then what is actually arriving.
  const gyroReadout = ((): string => {
    if (!gyro.supported) return zh ? "无传感器" : "no sensor";
    if (gyro.denied) return zh ? "已拒绝" : "denied";
    if (gyro.enabled && gyro.gated) return zh ? "待授权" : "tap to allow";
    if (!gyro.enabled) return zh ? "关" : "off";
    if (gyro.readings === "live") return `${tiltDeg ?? 0}°`;
    if (gyro.readings === "waiting") return "…";
    return zh ? "无数据" : "no readings";
  })();

  // --- Tune fold -----------------------------------------------------------
  const [tuneOpen, setTuneOpen] = useState(false);
  const setTune = (patch: Partial<typeof sceneOverrides>) =>
    setSceneOverrides({ ...sceneOverrides, ...patch });
  const clearTune = (key: keyof typeof sceneOverrides) => {
    const next = { ...sceneOverrides };
    delete next[key];
    setSceneOverrides(next);
  };

  // The tweakable numbers: slider value ↔ scene value, one row each. Wind is
  // two of them on purpose — a speed with no direction is a number that can
  // look like it does nothing, because a wind along the view axis has no
  // horizontal component and never leans the rain however hard it blows.
  const percent = (v: number) => `${v}%`;
  const tune: {
    key: keyof typeof sceneOverrides;
    label: string;
    aria: string;
    value: number;
    min?: number;
    max: number;
    format: (v: number) => string;
    toScene: (v: number) => number;
  }[] = [
    { key: "cloudCover", label: zh ? "云量" : "Cloud", aria: "Cloud", value: Math.round(scene.clouds.cover * 100), max: 100, format: percent, toScene: (v) => v / 100 },
    { key: "precipitationIntensity", label: zh ? "降水" : "Precip", aria: "Precip", value: Math.round(scene.precipitation.intensity * 100), max: 100, format: percent, toScene: (v) => v / 100 },
    { key: "windSpeedKmh", label: zh ? "风速" : "Wind", aria: "Wind", value: Math.round(sceneOverrides.windSpeedKmh ?? weather?.windSpeedKmh ?? 8), max: 60, format: (v) => `${v} km/h`, toScene: (v) => v },
    { key: "windDirectionDeg", label: zh ? "风向" : "From", aria: "Wind direction", value: toWindTrack(sceneOverrides.windDirectionDeg ?? weather?.windDirectionDeg ?? 270), min: WIND_TRACK_MIN, max: WIND_TRACK_MAX, format: (v) => `${wrap360(v)}° ${compassPoint(v)} ${leanArrow(v, scene.hemisphere)}`, toScene: wrap360 },
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
      relevant={isHome || anythingForced}
      star={strongest(
        anythingForced ? "session" : null,
        !followSun || !gyro.enabled || homeWeather !== HOME_WEATHER_DEFAULT
          ? "saved"
          : null
      )}
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

        {/* How the home screen says the weather: the grid card, or one line
            of date · place · temperature over the greeting. Saved. */}
        <PanelRow
          label={zh ? "主页天气" : "Home weather"}
          star={
            homeWeather !== HOME_WEATHER_DEFAULT ? (
              <PanelStar
                source="saved"
                onReset={() => setHomeWeather(HOME_WEATHER_DEFAULT)}
              />
            ) : undefined
          }
        >
          <PanelSegmented
            value={homeWeather}
            options={[
              {
                value: "widget",
                label: zh ? "卡片" : "Widget",
                title: zh ? "网格里的天气卡片" : "The weather card in the grid",
              },
              {
                value: "line",
                label: zh ? "一行" : "Line",
                title: zh ? "问候语上方的一行" : "One line over the greeting",
              },
            ]}
            onChange={(value: HomeWeather) => setHomeWeather(value)}
          />
        </PanelRow>

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
            <span className="flex items-center gap-1">
              {PLAY_RATES.map(({ rate, label }) => {
                const live = playRate === rate;
                return (
                  <button
                    key={rate}
                    onClick={() => play(rate)}
                    className={cn(
                      PANEL_CHIP,
                      live
                        ? "border-foreground/40 bg-accent text-accent-foreground"
                        : "border-border/60 text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={live ? "Pause the day" : `Play the day at ${rate}x`}
                    aria-pressed={live}
                    title={
                      zh
                        ? `从当前时刻循环播放这一天（${rate} 倍速）`
                        : `Play the day from here, on a loop, at ${rate}×`
                    }
                  >
                    {live ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    {zh ? label.zh : label.en}
                  </button>
                );
              })}
            </span>
          </div>
          <div
            className="relative h-10 overflow-hidden rounded-lg ring-1 ring-border/50"
            style={{ backgroundImage: dayGradient }}
          >
            {[sr, ss].map((m) => (
              <span
                key={m}
                aria-hidden
                className={cn("pointer-events-none absolute inset-y-0 w-px", TIMELINE_INK)}
                style={{ left: pct(m) }}
              />
            ))}
            {/* When a meteor is possible: the same ink as the sunrise and
                sunset ticks (TIMELINE_INK), but a stretch rather than an
                instant — a bar along the foot of the strip with a tick standing
                up at each end, drawn as one element's bottom and side borders.
                A window across midnight arrives as two of these, one against
                each end of the day. */}
            {starWindows.map(({ from, to }) => (
              <span
                key={`${from}-${to}`}
                aria-hidden
                // A stable handle for the checks that drive this panel: they
                // used to select on the utility classes, which meant restyling
                // the band silently broke the test that proves it is drawn.
                data-meteor-window={`${from}-${to}`}
                className={cn(
                  "pointer-events-none absolute bottom-0 h-3 border-x border-b-4",
                  TIMELINE_INK
                )}
                style={{ left: pct(from), width: pct(to - from) }}
              />
            ))}
            {isTimeTravelActive && (
              <span
                aria-hidden
                title={zh ? "真实的现在" : "Real now"}
                className={cn(
                  "pointer-events-none absolute inset-y-0 border-l border-dashed",
                  TIMELINE_INK
                )}
                style={{ left: pct(realMinutes) }}
              />
            )}
            <input
              type="range"
              min={0}
              max={DAY_MINUTES - 1}
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
            {/* The meteor's window, read off the same bar. Two intervals mean
                one window that crosses midnight, so it is shown the way it is
                lived: the evening opening, an arrow, the morning close. */}
            <span
              className={cn(
                "inline-flex items-center gap-1",
                starWindows.length === 0 && "text-muted-foreground/40"
              )}
              title={
                zh
                  ? `流星可能出现的时段：太阳低于 ${METEOR_SUN_MAX_DEG}°（航海暮光结束），且天空不被遮住`
                  : `When a meteor is possible: the sun below ${METEOR_SUN_MAX_DEG}° (nautical twilight over) and the sky not covered`
              }
            >
              <MeteorMark />
              {meteorWindowLabel}
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
          {/* The theme rides this timeline: play the day and it flips at the
              two ticks above, because the switch reads the same clock. The
              toggle is the saved setting, not a session override — turning it
              off here turns it off for good. */}
          <PanelRow
            label={zh ? "主题跟随太阳" : "Theme follows sun"}
            star={
              followSun ? null : (
                <PanelStar
                  onReset={() => setFollowSun(true)}
                  source="saved"
                  label={zh ? "恢复跟随太阳" : "Follow the sun again"}
                />
              )
            }
          >
            <span className="flex items-center gap-2">
              {followSun && sunTheme && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                  {sunTheme === "light"
                    ? t(locale, "themeLight")
                    : t(locale, "themeDark")}
                </span>
              )}
              <PanelToggle
                on={followSun}
                onClick={() => setFollowSun(!followSun)}
                label="Theme follows the sun"
              />
            </span>
          </PanelRow>
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
              const starry = meteorConditions.has(condition);
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
                  title={[
                    selected
                      ? zh
                        ? "再点一次回到实况"
                        : "Click again for the live weather"
                      : getWeatherConditionLabel(condition, locale),
                    starry
                      ? zh
                        ? "这个天气能看见流星（夜里点一下天空）"
                        : "A meteor can be seen through this weather (click the sky at night)"
                      : zh
                        ? "这个天气挡住了天空，没有流星"
                        : "This weather covers the sky — no meteor",
                  ].join(" · ")}
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
                  {/* A corner mark for the weather you could see a meteor
                      through. Only the weather half of the rule: when it is
                      dark enough is the strip's question, a few rows up. The
                      mark is live, so forcing Cloudy darkens it and then
                      pulling the cloud slider down lights it again — which is
                      the whole mechanism, shown rather than written.
                      In `foreground` rather than white, for the same reason the
                      weather glyph below it is: these previews are pale in the
                      light theme and dark in the dark one, so the ink that
                      contrasts with both is the one that flips with them. White
                      read beautifully on the night chips and disappeared
                      completely on the day ones. */}
                  {starry && (
                    <MeteorMark className="absolute left-1 top-1 h-3.5 w-3.5 text-foreground" />
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

        {/* The gyroscope: rain and snow fall along real gravity, in the Sky.
            A saved setting (blue star), on by default, and the only place
            besides the picker where iOS's motion permission can be granted —
            so the readout says which of "off", "unanswered" and "nothing
            coming through" is the case, and shows the live tilt once it is. */}
        <div className="border-t border-border/30 pt-2">
          <PanelRow
            label={
              effectiveStyle === "sky"
                ? zh
                  ? "陀螺仪"
                  : "Gyro"
                : zh
                  ? "陀螺仪 · 仅天空"
                  : "Gyro · Sky only"
            }
            star={
              gyro.enabled ? null : (
                <PanelStar onReset={() => void setGyroEnabled(true)} source="saved" />
              )
            }
          >
            <span className="flex items-center gap-2">
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {gyroReadout}
              </span>
              <PanelToggle
                on={gyro.active}
                disabled={!gyro.supported}
                onClick={() => void setGyroEnabled(!gyro.active)}
                label="Toggle gyroscope tilt"
              />
            </span>
          </PanelRow>
        </div>

        {/* Where the real sky comes from: fetch it again. Weather refetches
            both, since the forecast is asked for at the location. */}
        <PanelRow label={zh ? "重新请求" : "Refetch"}>
          <span className={cn("flex items-center gap-1", refetching && "opacity-60")}>
            <button
              onClick={() => refreshLocation()}
              className={cn(PANEL_CHIP, "border-border/60 text-muted-foreground hover:text-foreground")}
              aria-label="Refetch location"
            >
              <RefreshCw className={cn("h-3 w-3", locationFetching && "animate-spin")} />
              {zh ? "位置" : "Location"}
            </button>
            <button
              onClick={() => refreshWeather()}
              className={cn(PANEL_CHIP, "border-border/60 text-muted-foreground hover:text-foreground")}
              aria-label="Refetch weather"
              title={zh ? "天气刷新会同时刷新位置与天气" : "Refetches both location and weather"}
            >
              <RefreshCw className={cn("h-3 w-3", weatherFetching && "animate-spin")} />
              {zh ? "天气" : "Weather"}
            </button>
          </span>
        </PanelRow>

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
                  min={row.min ?? 0}
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
  const state = music?.playerState ?? "idle";

  return (
    <DebugSection
      id="music"
      title={t(locale, "settingsMusic")}
      icon={<Music className="h-4 w-4" />}
      compact
      // A track in hand, not a player warming up (or failing to).
      relevant={mock || state === "playing" || state === "paused"}
      star={mock ? "saved" : null}
      action={
        <span className="text-[10px] font-mono text-muted-foreground">
          {mock && <span className="uppercase text-amber-500/70">mock · </span>}
          {state}
        </span>
      }
    >
      <div className="space-y-3">
        <PanelRow
          label={zh ? "模拟播放器" : "Mock player"}
          star={mock ? <PanelStar source="saved" onReset={toggleMock} /> : null}
        >
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
  const { phonePalette, setPhonePalette, canDock } = useDevtool();
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
      // The one setting here is the palette's shape on a phone.
      relevant={canDock}
      star={phonePalette !== PHONE_PALETTE_DEFAULT ? "saved" : null}
      action={
        <span className="text-[10px] font-mono text-muted-foreground">{phonePalette}</span>
      }
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
// Glow Module — the light's volume (systems/glow), saved.
// Site-wide strength multiplies every glow; the About's ring has its own
// strength and depth on top. The devtool rides over the About while it is up
// (dock.tsx), so these can be turned while the ring is on screen — `Show`
// brings it up to look at.
// =============================================================================

function GlowModule() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const tuning = useGlowTuning();
  const about = useOptionalAbout();
  // The light is judged on the About: while it is up the module unfolds
  // (`relevant`) and the panel brings it into view.
  const aboutOpen = about?.isOpen ?? false;
  const scrollTo = useContext(SectionsContext)?.scrollTo;
  useEffect(() => {
    if (!aboutOpen || !scrollTo) return;
    // After the unfold has laid out.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => scrollTo("glow")));
    return () => cancelAnimationFrame(id);
  }, [aboutOpen, scrollTo]);
  const star = (key: keyof GlowTuning) =>
    tuning[key] !== GLOW_TUNING_DEFAULTS[key] ? (
      <PanelStar source="saved" onReset={() => setGlowTuning({ [key]: GLOW_TUNING_DEFAULTS[key] })} />
    ) : undefined;
  const changed = (Object.keys(GLOW_TUNING_DEFAULTS) as (keyof GlowTuning)[]).some(
    (k) => tuning[k] !== GLOW_TUNING_DEFAULTS[k],
  );
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const slider = (key: keyof GlowTuning, label: string, ariaLabel: string, min: number, max: number) => (
    <PanelSlider
      label={label}
      ariaLabel={ariaLabel}
      value={tuning[key]}
      min={min}
      max={max}
      step={0.01}
      format={pct}
      star={star(key)}
      onChange={(v) => setGlowTuning({ [key]: v })}
    />
  );

  return (
    <DebugSection
      id="glow"
      title={zh ? "光晕" : "Glow"}
      icon={<Sparkles className="h-4 w-4" />}
      compact
      relevant={aboutOpen}
      star={changed ? "saved" : null}
      onReset={() => setGlowTuning(GLOW_TUNING_DEFAULTS)}
      action={
        about ? (
          <button
            onClick={about.isOpen ? about.close : about.open}
            className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {about.isOpen ? (zh ? "收起关于" : "Hide About") : zh ? "显示关于" : "Show About"}
          </button>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {slider("strength", zh ? "全站强度" : "Strength · all", "Glow strength, site-wide", 0, 1.5)}
        {slider("aboutStrength", zh ? "关于 · 强度" : "About · strength", "About glow strength", 0, 1.5)}
        {/* Where the ring's light ends, as a share of the narrower gutter
            between the screen's edge and the words (<EdgeGlow>'s `depth`):
            100% just touches them, past it the light's tail lies over them.
            The light stands as high off every edge. One per layout, the
            About having two (systems/glow/lib/tuning.ts has the defaults). */}
        {slider("aboutDesk", zh ? "关于 · 桌面深度" : "About · desk depth", "About glow depth, desk", 0.05, 2.5)}
        {slider("aboutPhone", zh ? "关于 · 手机深度" : "About · phone depth", "About glow depth, phone", 0.05, 2.5)}
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
  const configs = DRAGGABLE_INSTANCES.map((inst) => ({
    config: getDraggableConfig(inst.id),
    defaults: DRAGGABLE_DEFAULTS[inst.id] || { draggable: false, persist: false },
  }));
  const overridden = configs.some(
    ({ config, defaults }) =>
      config.draggable !== defaults.draggable || config.persist !== defaults.persist
  );
  const dragging = configs.filter(({ config }) => config.draggable).length;

  return (
    <DebugSection
      id="draggable"
      title={locale === "zh" ? "拖拽" : "Draggable"}
      icon={<GripVertical className="h-4 w-4" />}
      // Tooling for a handful of floating things, never what a page is about.
      relevant={false}
      star={overridden ? "saved" : null}
      action={
        <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
          {dragging}/{DRAGGABLE_INSTANCES.length}
        </span>
      }
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
                  <span className="text-[9px] font-mono text-sky-500/80 uppercase">
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
                      persistOverridden && "ring-1 ring-sky-500/40"
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
                    dragOverridden && "ring-1 ring-sky-500/40"
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
