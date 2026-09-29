"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { t, type Locale } from "@/lib/i18n";
import {
  MD_SEED_STORAGE_KEY,
  MD_STYLE_STORAGE_KEY,
  OS_THEME_STORAGE_KEY,
} from "@/systems/os/lib/boot";
import { applyRootOsTheme } from "@/systems/os/lib/root";
import {
  DEFAULT_OS_THEME,
  OS_THEMES,
  getThemeMetadata,
  isOsThemeId,
  nextOsTheme,
  type OsThemeId,
  type ThemeMetadata,
} from "@/systems/os/themes";
import {
  SCHEME_STYLES,
  type SchemeStyle,
} from "@/systems/os/android/lib/scheme";

// =============================================================================
// OS theme — which platform the site is drawn as.
//
//   hux      The site as built: Liquid Glass (Tinted / Clear is the knob
//            inside it), the mono and serif voice, iOS's gestures. Default.
//   android  Material 3 Expressive, as Android 16 draws it: opaque tonal
//            surfaces coloured from the wallpaper, Google Sans Flex, the
//            ripple, springs.
//
// Not to be confused with the *appearance* (light / dark, services/theme.tsx):
// every theme has both.
//
// The layers, outermost first (docs/system-os-theme.md):
//   1. registry   systems/os/themes — what each theme is, as metadata; code
//                 branches on metadata (`useOsTheme().meta`), never on ids
//   2. root       `data-os-theme` / `data-os-platform` on <html>, set before
//                 first paint by `OS_THEME_BOOT` and after by this provider
//   3. CSS        the Hux theme is the site's stylesheet; the Android theme
//                 is an overlay in app/themes/android/, every rule scoped to
//                 `:root[data-os-theme="android"]`, plus the `android:` /
//                 `hux:` / `m3:` variants for small per-element differences
//   4. structure  where the DOM itself differs, both forms are in the tree
//                 and `<Themed>` lets the stylesheet pick (no second render)
//
// And, for the Android theme only, its material setting — Wallpaper colors:
// the colour *style* (tonal spot, vibrant, …) and the *option* the palette
// is seeded from (one of the wallpaper's colours, or a basic colour).
// =============================================================================

export const DEFAULT_SCHEME_STYLE: SchemeStyle = "tonal-spot";

export function getOsThemeLabel(id: OsThemeId, locale: Locale): string {
  return t(locale, OS_THEMES[id].label);
}

const STYLE_LABEL: Record<SchemeStyle, Parameters<typeof t>[1]> = {
  "tonal-spot": "mdStyleTonalSpot",
  neutral: "mdStyleNeutral",
  vibrant: "mdStyleVibrant",
  expressive: "mdStyleExpressive",
  monochrome: "mdStyleMonochrome",
};

export function getSchemeStyleLabel(style: SchemeStyle, locale: Locale): string {
  return t(locale, STYLE_LABEL[style]);
}

/**
 * Which colour seeds the Android palette — Android's "Colors" tab under
 * Wallpaper & style: one of the wallpaper's options (by slot; the first is
 * the default and follows the wallpaper), or a basic colour, which does not.
 */
export type SeedChoice =
  | { kind: "wallpaper"; index: number }
  | { kind: "basic"; argb: number };

export const DEFAULT_SEED_CHOICE: SeedChoice = { kind: "wallpaper", index: 0 };

function read<T>(key: string, parse: (v: string | null) => T, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors
  }
}

const parseTheme = (v: string | null): OsThemeId =>
  isOsThemeId(v) ? v : DEFAULT_OS_THEME;

const parseStyle = (v: string | null): SchemeStyle =>
  (SCHEME_STYLES as readonly string[]).includes(v ?? "")
    ? (v as SchemeStyle)
    : DEFAULT_SCHEME_STYLE;

function parseSeed(raw: string | null): SeedChoice {
  const v = JSON.parse(raw ?? "null");
  if (v?.kind === "wallpaper" && Number.isInteger(v.index) && v.index >= 0 && v.index < 4)
    return { kind: "wallpaper", index: v.index };
  if (v?.kind === "basic" && Number.isInteger(v.argb)) return { kind: "basic", argb: v.argb };
  return DEFAULT_SEED_CHOICE;
}

/**
 * Commit a theme change as one crossfade of the whole page where the browser
 * can (the same way the appearance changes, solar-theme.tsx): the attribute
 * flips inside the transition's callback, so the old theme's snapshot fades
 * into the new one's instead of every surface restyling on its own clock.
 */
function commitThemeChange(apply: () => void) {
  if (
    typeof document.startViewTransition !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    apply();
    return;
  }
  document.startViewTransition(() => flushSync(apply));
}

interface OsThemeContextType {
  theme: OsThemeId;
  /** The theme's metadata — branch on this, not on the id. */
  meta: ThemeMetadata;
  setTheme: (theme: OsThemeId) => void;
  /** To the next theme in the registry. */
  toggle: () => void;
  /** Android theme: the colour style. */
  schemeStyle: SchemeStyle;
  setSchemeStyle: (style: SchemeStyle) => void;
  /** Android theme: the colour option the palette is seeded from. */
  seed: SeedChoice;
  setSeed: (seed: SeedChoice) => void;
}

const OsThemeContext = createContext<OsThemeContextType | undefined>(undefined);

export function useOsTheme() {
  const context = useContext(OsThemeContext);
  if (!context) throw new Error("useOsTheme must be used within OsThemeProvider");
  return context;
}

/** Null outside the provider — for components that also render in labs. */
export function useOptionalOsTheme() {
  return useContext(OsThemeContext) ?? null;
}

export function OsThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<OsThemeId>(DEFAULT_OS_THEME);
  const [schemeStyle, setStyleState] = useState<SchemeStyle>(DEFAULT_SCHEME_STYLE);
  const [seed, setSeedState] = useState<SeedChoice>(DEFAULT_SEED_CHOICE);

  useEffect(() => {
    // Hydration-safe: the boot script has already put the stored theme on
    // <html>; React catches up to it here.
    /* eslint-disable react-hooks/set-state-in-effect -- localStorage read */
    setThemeState(read(OS_THEME_STORAGE_KEY, parseTheme, DEFAULT_OS_THEME));
    setStyleState(read(MD_STYLE_STORAGE_KEY, parseStyle, DEFAULT_SCHEME_STYLE));
    setSeedState(read(MD_SEED_STORAGE_KEY, parseSeed, DEFAULT_SEED_CHOICE));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    applyRootOsTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.mdStyle = schemeStyle;
  }, [schemeStyle]);

  const setTheme = useCallback((next: OsThemeId) => {
    write(OS_THEME_STORAGE_KEY, next);
    commitThemeChange(() => {
      // The attribute first, synchronously, so the transition's new
      // snapshot is the new theme even before React's effect runs.
      applyRootOsTheme(next);
      setThemeState(next);
    });
  }, []);

  const toggle = useCallback(() => setTheme(nextOsTheme(theme)), [theme, setTheme]);

  const setSchemeStyle = useCallback((next: SchemeStyle) => {
    setStyleState(next);
    write(MD_STYLE_STORAGE_KEY, next);
  }, []);

  const setSeed = useCallback((next: SeedChoice) => {
    setSeedState(next);
    write(MD_SEED_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const value = useMemo(
    () => ({
      theme,
      meta: getThemeMetadata(theme),
      setTheme,
      toggle,
      schemeStyle,
      setSchemeStyle,
      seed,
      setSeed,
    }),
    [theme, setTheme, toggle, schemeStyle, setSchemeStyle, seed, setSeed],
  );

  return <OsThemeContext.Provider value={value}>{children}</OsThemeContext.Provider>;
}
