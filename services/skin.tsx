"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { t, type Locale } from "@/lib/i18n";
import {
  SCHEME_STYLE_STORAGE_KEY,
  SKIN_STORAGE_KEY,
} from "@/systems/skin/lib/boot";
import {
  SCHEME_STYLES,
  type SchemeStyle,
} from "@/systems/skin/lib/scheme";

// =============================================================================
// Skin — which platform the home screen's widgets are drawn in.
//
//   material  Android, Material 3 Expressive. Opaque tonal containers on a
//             28dp system radius, colour generated from the wallpaper
//             (dynamic color), Google Sans Flex, state layers. The default.
//   glass     Apple, Liquid Glass. The translucent cards the site was built
//             with; the glass *material* setting (Tinted / Clear) is the
//             knob inside this skin.
//
// And, for Material only, the colour *style* — the "Wallpaper colors" row in
// Android's Wallpaper & style: how the one source colour is spread across
// the palettes (tonal spot, neutral, vibrant, expressive, monochrome).
//
// Both are attributes on <html> (`data-skin`, `data-md-style`) set before
// first paint by `SKIN_BOOT` (systems/skin/lib/boot.ts) in the root layout, so a returning visitor never
// sees the other skin flash. Nothing re-renders to change skin: the widget
// stylesheet reads the attribute (app/globals.css, "Skin — Material"). The
// palette itself is written by `DynamicColorBridge` (systems/skin).
// =============================================================================

export type Skin = "material" | "glass";

export const SKINS: Skin[] = ["material", "glass"];
export const DEFAULT_SKIN: Skin = "material";
export const DEFAULT_SCHEME_STYLE: SchemeStyle = "tonal-spot";

export function getSkinLabel(skin: Skin, locale: Locale): string {
  return t(locale, skin === "glass" ? "skinGlass" : "skinMaterial");
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

function readStoredSkin(): Skin {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  try {
    return localStorage.getItem(SKIN_STORAGE_KEY) === "glass" ? "glass" : "material";
  } catch {
    return DEFAULT_SKIN;
  }
}

function readStoredStyle(): SchemeStyle {
  if (typeof window === "undefined") return DEFAULT_SCHEME_STYLE;
  try {
    const v = localStorage.getItem(SCHEME_STYLE_STORAGE_KEY);
    return (SCHEME_STYLES as readonly string[]).includes(v ?? "")
      ? (v as SchemeStyle)
      : DEFAULT_SCHEME_STYLE;
  } catch {
    return DEFAULT_SCHEME_STYLE;
  }
}

interface SkinContextType {
  skin: Skin;
  setSkin: (skin: Skin) => void;
  toggle: () => void;
  schemeStyle: SchemeStyle;
  setSchemeStyle: (style: SchemeStyle) => void;
}

const SkinContext = createContext<SkinContextType | undefined>(undefined);

export function useSkin() {
  const context = useContext(SkinContext);
  if (!context) throw new Error("useSkin must be used within SkinProvider");
  return context;
}

/** Null outside the provider — for components that also render in labs. */
export function useOptionalSkin() {
  return useContext(SkinContext) ?? null;
}

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const [skin, setSkinState] = useState<Skin>(DEFAULT_SKIN);
  const [schemeStyle, setStyleState] = useState<SchemeStyle>(DEFAULT_SCHEME_STYLE);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setSkinState(readStoredSkin());
    setStyleState(readStoredStyle());
  }, []);

  useEffect(() => {
    document.documentElement.dataset.skin = skin;
  }, [skin]);

  useEffect(() => {
    document.documentElement.dataset.mdStyle = schemeStyle;
  }, [schemeStyle]);

  const setSkin = useCallback((next: Skin) => {
    setSkinState(next);
    try {
      localStorage.setItem(SKIN_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setSchemeStyle = useCallback((next: SchemeStyle) => {
    setStyleState(next);
    try {
      localStorage.setItem(SCHEME_STYLE_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggle = useCallback(
    () => setSkin(skin === "material" ? "glass" : "material"),
    [skin, setSkin],
  );

  const value = useMemo(
    () => ({ skin, setSkin, toggle, schemeStyle, setSchemeStyle }),
    [skin, setSkin, toggle, schemeStyle, setSchemeStyle],
  );

  return <SkinContext.Provider value={value}>{children}</SkinContext.Provider>;
}
