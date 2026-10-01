"use client";

import type { TranslationKey } from "@/lib/i18n";
import {
  GalleryHorizontal,
  GitCommitHorizontal,
  Map as MapIcon,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";

// =============================================================================
// Home widgets — which cards the home grid may show, and which it shows before
// a visitor says otherwise.
//
// A widget is a feature's card on the home screen, not the feature itself: a
// module can be public (a route, a palette entry) and still keep its card off
// the home screen until a visitor asks for it. That is one flag here,
// `defaultEnabled`. The grid's order stays the masonry's business
// (sortable-order.ts).
//
// A widget can also come in **forms** — WidgetKit's sizes, generalised: the
// same feature drawn another way, which the visitor picks the way they pick
// a widget's size on iOS / iPadOS / macOS (widget-frame.tsx: the right-click
// menu, and a strip on the card in edit mode). The first form is the default.
// Not sizes: the grid's columns are one width, so a form is a different
// *reading* of the feature, not a bigger box of the same one.
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

export interface WidgetFormSpec {
  id: string;
  /** Its name in the menu and the strip's tooltip. */
  title: TranslationKey;
  /** Its glyph in the edit-mode strip and the menu. */
  icon: LucideIcon;
}

export interface HomeWidgetSpec {
  id: string;
  /** Its name in the picker. */
  title: TranslationKey;
  /** On the home screen until a visitor turns it off. */
  defaultEnabled: boolean;
  /** The ways it can be drawn, the default first. Absent: one way. */
  forms?: readonly WidgetFormSpec[];
}

export const HOME_WIDGETS = [
  { id: "apps", title: "appsGroup", defaultEnabled: true },
  { id: "weather", title: "widgetWeather", defaultEnabled: true },
  { id: "blog", title: "widgetBlog", defaultEnabled: true },
  { id: "music", title: "widgetMusicIdle", defaultEnabled: true },
  // The projects widget keeps its legacy "status" id (visitors' saved order).
  { id: "status", title: "widgetStatus", defaultEnabled: true },
  {
    id: "featured-talks",
    title: "widgetFeaturedTalks",
    defaultEnabled: true,
    // The theater's library, read three ways (components/home/theater).
    forms: [
      { id: "reel", title: "widgetFormReel", icon: GalleryHorizontal },
      { id: "timeline", title: "widgetFormTimeline", icon: GitCommitHorizontal },
      { id: "tour", title: "widgetFormTour", icon: MapIcon },
    ],
  },
  { id: "prompt", title: "widgetPrompt", defaultEnabled: true },
  // Labs is public — /lab, the palette — but a study of the site's insides,
  // not something a visitor came for. Its card waits to be asked for.
  { id: "lab", title: "widgetLab", defaultEnabled: false },
] as const satisfies readonly HomeWidgetSpec[];

export type HomeWidgetId = (typeof HOME_WIDGETS)[number]["id"];

const SPECS = new Map<string, HomeWidgetSpec>(HOME_WIDGETS.map((w) => [w.id, w]));

/** A widget's forms, the default first; empty for a widget drawn one way. */
export function formsOf(id: string): readonly WidgetFormSpec[] {
  return SPECS.get(id)?.forms ?? [];
}

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

// -----------------------------------------------------------------------------
// Forms — which way each widget is drawn, the same kind of override: per id
// (`hux_widget_forms`), dropped when it is back at the default, and the
// default on the server and in the hydrating render.
// -----------------------------------------------------------------------------

const FORMS_KEY = "hux_widget_forms";
type Forms = Readonly<Record<string, string>>;
const NO_FORMS: Forms = Object.freeze({});

let forms: Forms | null = null;
const formListeners = new Set<() => void>();

/**
 * The last form a visitor chose, and when: the frame morphs only for a
 * choice made just now, never for a saved one arriving after hydration.
 */
let lastChoice: { id: string; at: number } | null = null;
export function wasJustChosen(id: string): boolean {
  return !!lastChoice && lastChoice.id === id && Date.now() - lastChoice.at < 1000;
}

function readForms(): Forms {
  try {
    const raw = localStorage.getItem(FORMS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        // A form the widget no longer has is no choice at all.
        if (typeof v === "string" && formsOf(k).some((f) => f.id === v)) clean[k] = v;
      }
      return clean;
    }
  } catch {
    // Storage blocked or corrupt: every widget in its default form.
  }
  return NO_FORMS;
}

function writeForms(next: Forms) {
  forms = next;
  try {
    if (Object.keys(next).length === 0) localStorage.removeItem(FORMS_KEY);
    else localStorage.setItem(FORMS_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the choice lasts the session */
  }
  for (const l of formListeners) l();
}

function subscribeForms(listener: () => void) {
  formListeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== FORMS_KEY) return;
    forms = readForms();
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    formListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const getForms = () => (forms ??= readForms());
const getServerForms = () => NO_FORMS;

/** Draw a widget another way. Back at its default, the override is dropped. */
export function setWidgetForm(id: string, form: string) {
  const all = formsOf(id);
  if (!all.some((f) => f.id === form)) return;
  lastChoice = { id, at: Date.now() };
  const next = { ...getForms() };
  if (form === all[0].id) delete next[id];
  else next[id] = form;
  writeForms(next);
}

/** Every widget back in its default form. */
export function resetWidgetForms() {
  writeForms(NO_FORMS);
}

/** Whether any widget is drawn other than by default. */
export function useWidgetFormsCustomized(): boolean {
  const current = useSyncExternalStore(subscribeForms, getForms, getServerForms);
  return Object.keys(current).length > 0;
}

/** One widget's forms, the one it is drawn in, and the way to change it. */
export function useWidgetForm(id: string) {
  const current = useSyncExternalStore(subscribeForms, getForms, getServerForms);
  const all = formsOf(id);
  const form = current[id] ?? all[0]?.id ?? null;
  const setForm = useCallback((next: string) => setWidgetForm(id, next), [id]);
  return { forms: all, form, setForm };
}
