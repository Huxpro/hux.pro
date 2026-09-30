"use client";

import type { TranslationKey } from "@/lib/i18n";
import { useCallback, useSyncExternalStore } from "react";

// =============================================================================
// Home widgets — which cards the home grid may show, and which it shows before
// a visitor says otherwise.
//
// A widget is a feature's card on the home screen, not the feature itself: a
// module can be public (a route, a palette entry) and still keep its card off
// the home screen until a visitor asks for it. That is one flag here,
// `defaultEnabled`, and nothing else — no layout, no sizes. The grid's order
// stays the masonry's business (sortable-order.ts).
//
//   HOME_WIDGETS   every widget the grid knows by id, with its default
//   group-*        a curated group from log.json: enabled by default (the
//                  author's `hidden` already says "never")
//
// A visitor's choices are overrides, stored per id (`hux_widget_prefs`), so a
// widget that changes its default later moves for everyone who never touched
// it. The home grid's edit mode lists them (WidgetPicker); a feature can offer
// its own switch (the /lab index does) through `useHomeWidget`.
//
// Presence is separate from choice: a widget with nothing to show (no
// projects, the weather placed as a line instead) is simply absent, and the
// picker does not offer it.
// =============================================================================

export interface HomeWidgetSpec {
  id: string;
  /** Its name in the picker. */
  title: TranslationKey;
  /** On the home screen until a visitor turns it off. */
  defaultEnabled: boolean;
}

export const HOME_WIDGETS = [
  { id: "apps", title: "appsGroup", defaultEnabled: true },
  { id: "weather", title: "widgetWeather", defaultEnabled: true },
  { id: "blog", title: "widgetBlog", defaultEnabled: true },
  { id: "music", title: "widgetMusicIdle", defaultEnabled: true },
  // The projects widget keeps its legacy "status" id (visitors' saved order).
  { id: "status", title: "widgetStatus", defaultEnabled: true },
  { id: "featured-talks", title: "widgetFeaturedTalks", defaultEnabled: true },
  { id: "prompt", title: "widgetPrompt", defaultEnabled: true },
  // Labs is public — /lab, the palette — but a study of the site's insides,
  // not something a visitor came for. Its card waits to be asked for.
  { id: "lab", title: "widgetLab", defaultEnabled: false },
] as const satisfies readonly HomeWidgetSpec[];

export type HomeWidgetId = (typeof HOME_WIDGETS)[number]["id"];

const DEFAULTS = new Map<string, boolean>(HOME_WIDGETS.map((w) => [w.id, w.defaultEnabled]));

/** The default for any grid id: a declared widget's flag, or on (log groups). */
export function isEnabledByDefault(id: string): boolean {
  return DEFAULTS.get(id) ?? true;
}

// -----------------------------------------------------------------------------
// Visitor overrides — a module store, so the grid, its picker and a feature's
// own switch (on another page) read the same bit, across tabs too.
// -----------------------------------------------------------------------------

const STORAGE_KEY = "hux_widget_prefs";
type Prefs = Readonly<Record<string, boolean>>;
const EMPTY: Prefs = Object.freeze({});

let prefs: Prefs | null = null;
const listeners = new Set<() => void>();

function read(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const clean: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(parsed)) if (typeof v === "boolean") clean[k] = v;
      return clean;
    }
  } catch {
    // Storage blocked or corrupt: every widget at its default.
  }
  return EMPTY;
}

function write(next: Prefs) {
  prefs = next;
  try {
    if (Object.keys(next).length === 0) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the choice lasts the session */
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    prefs = read();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getSnapshot = () => (prefs ??= read());
// The server — and the first client render — show every widget at its
// default; a visitor's overrides apply right after hydration.
const getServerSnapshot = () => EMPTY;

/** Turn a widget on or off for this visitor. Back at its default, the override is dropped. */
export function setWidgetEnabled(id: string, enabled: boolean) {
  const current = getSnapshot();
  const next = { ...current };
  if (enabled === isEnabledByDefault(id)) delete next[id];
  else next[id] = enabled;
  write(next);
}

/** Every widget back at its default. */
export function resetWidgetPrefs() {
  write(EMPTY);
}

/** The visitor's overrides, and whether a grid id is on. */
export function useWidgetPrefs() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isEnabled = useCallback(
    (id: string) => current[id] ?? isEnabledByDefault(id),
    [current],
  );
  return { isEnabled, customized: Object.keys(current).length > 0 };
}

/** One widget's switch, for a feature that offers its own (the /lab index). */
export function useHomeWidget(id: HomeWidgetId) {
  const { isEnabled } = useWidgetPrefs();
  const enabled = isEnabled(id);
  const setEnabled = useCallback((next: boolean) => setWidgetEnabled(id, next), [id]);
  return { enabled, setEnabled };
}
