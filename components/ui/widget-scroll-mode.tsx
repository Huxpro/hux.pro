"use client";

import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale, type TranslationKey } from "@/services";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_WIDGET_SCROLL_MODE,
  WIDGET_SCROLL_MODES,
  WIDGET_SCROLL_QUERY_KEY,
  WIDGET_SCROLL_STORAGE_KEY,
  parseWidgetScrollMode,
  type WidgetScrollMode,
} from "./widget-scroll";

// =============================================================================
// Session switcher for the widget-scroll prototypes.
//
// The URL (`?widgetScroll=pages`) wins so a mode can be shared. Otherwise the
// last pick lives in sessionStorage. Nested is the default — today's nested
// vertical list — so the prototypes never silently replace production.
// =============================================================================

const MODE_LABEL: Record<WidgetScrollMode, TranslationKey> = {
  nested: "widgetScrollNested",
  peek: "widgetScrollPeek",
  expand: "widgetScrollExpand",
  lock: "widgetScrollLock",
  rail: "widgetScrollRail",
  pages: "widgetScrollPages",
  sheet: "widgetScrollSheet",
};

const MODE_HINT: Record<WidgetScrollMode, TranslationKey> = {
  nested: "widgetScrollNestedHint",
  peek: "widgetScrollPeekHint",
  expand: "widgetScrollExpandHint",
  lock: "widgetScrollLockHint",
  rail: "widgetScrollRailHint",
  pages: "widgetScrollPagesHint",
  sheet: "widgetScrollSheetHint",
};

function readQueryMode(): WidgetScrollMode | undefined {
  if (typeof window === "undefined") return undefined;
  return parseWidgetScrollMode(
    new URLSearchParams(window.location.search).get(WIDGET_SCROLL_QUERY_KEY),
  );
}

function readStoredMode(): WidgetScrollMode | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return parseWidgetScrollMode(
      sessionStorage.getItem(WIDGET_SCROLL_STORAGE_KEY),
    );
  } catch {
    return undefined;
  }
}

function writeStoredMode(mode: WidgetScrollMode) {
  try {
    sessionStorage.setItem(WIDGET_SCROLL_STORAGE_KEY, mode);
  } catch {
    // Private mode can throw; the in-memory value still works for the session.
  }
}

function writeQueryMode(mode: WidgetScrollMode) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (mode === DEFAULT_WIDGET_SCROLL_MODE) {
    url.searchParams.delete(WIDGET_SCROLL_QUERY_KEY);
  } else {
    url.searchParams.set(WIDGET_SCROLL_QUERY_KEY, mode);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next !== current) window.history.replaceState(null, "", next);
}

interface WidgetScrollModeContextValue {
  mode: WidgetScrollMode;
  setMode: (mode: WidgetScrollMode) => void;
}

const WidgetScrollModeContext =
  createContext<WidgetScrollModeContextValue | null>(null);

export function WidgetScrollModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<WidgetScrollMode>(
    DEFAULT_WIDGET_SCROLL_MODE,
  );

  useEffect(() => {
    const next =
      readQueryMode() ?? readStoredMode() ?? DEFAULT_WIDGET_SCROLL_MODE;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only: URL / sessionStorage
    setModeState(next);
    writeStoredMode(next);
    writeQueryMode(next);
  }, []);

  const setMode = useCallback((next: WidgetScrollMode) => {
    setModeState(next);
    writeStoredMode(next);
    writeQueryMode(next);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <WidgetScrollModeContext.Provider value={value}>
      {children}
    </WidgetScrollModeContext.Provider>
  );
}

export function useWidgetScrollMode(): WidgetScrollModeContextValue {
  return (
    useContext(WidgetScrollModeContext) ?? {
      mode: DEFAULT_WIDGET_SCROLL_MODE,
      setMode: () => {},
    }
  );
}

function ModeChips({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale } = useLocale();
  const { mode, setMode } = useWidgetScrollMode();

  return (
    <div
      role="group"
      aria-label={t(locale, "widgetScrollLab")}
      className={cn(
        "no-scrollbar flex flex-wrap gap-1 overflow-visible",
        className,
      )}
    >
      {WIDGET_SCROLL_MODES.map((m) => {
        const selected = mode === m;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={selected}
            data-widget-scroll-chip={m}
            onClick={() => setMode(m)}
            className={cn(
              "pressable shrink-0 font-mono uppercase tracking-wider transition-colors",
              compact
                ? "rounded-md px-2 py-1 text-[10px]"
                : "rounded-full px-2.5 py-1 text-[10px]",
              selected
                ? compact
                  ? "bg-accent text-accent-foreground"
                  : "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground active:bg-muted/50",
            )}
          >
            {t(locale, MODE_LABEL[m])}
          </button>
        );
      })}
    </div>
  );
}

/** Sticky lab bar above the home widget grid — the thing you flip while trying. */
export function WidgetScrollPicker() {
  const { locale } = useLocale();
  const { mode } = useWidgetScrollMode();

  return (
    <div className="sticky top-2 z-30 mb-3">
      <div className="rounded-2xl border border-border/50 bg-glass-sheet/90 shadow-raised backdrop-blur-xl">
        <div className="flex items-center gap-2 px-3 pt-2">
          <span className={TYPE.label}>{t(locale, "widgetScrollLab")}</span>
          <span className={TYPE.pill}>lab</span>
        </div>
        <ModeChips className="px-2 pt-1" />
        <p className="px-3 pt-1.5 pb-2 text-[11px] leading-snug text-tertiary-foreground">
          {t(locale, MODE_HINT[mode])}
        </p>
      </div>
    </div>
  );
}

/** Compact chip row + hint, for the DevTool module. */
export function WidgetScrollModeControls() {
  const { locale } = useLocale();
  const { mode } = useWidgetScrollMode();

  return (
    <div className="space-y-2">
      <ModeChips compact className="flex-wrap overflow-x-visible touch-auto" />
      <p className="text-[11px] leading-snug text-tertiary-foreground">
        {t(locale, MODE_HINT[mode])}
      </p>
    </div>
  );
}

export { MODE_HINT, MODE_LABEL };
