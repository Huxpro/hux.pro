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

// =============================================================================
// Widget skin — how every widget card on the site is dressed.
//
//   apple    the default. The card as a WidgetKit widget: a near-opaque
//            full-colour tile (or Liquid Glass, under Glass: Clear), 16px
//            margins, continuous corners in proportion to the cell, the
//            system font, one accent colour per widget, and the widget's
//            name under it on the home board. See docs/system-widget-skin.md.
//   classic  the card as it was: frosted glass, mono labels, the site's own
//            System UI voice. Kept whole, not approximated — every Apple rule
//            is scoped so this skin renders exactly what it always did.
//
// The skin is one attribute on <html> (`data-widget-skin`), and the styles
// read it through two Tailwind variants (`skin-apple:` / `skin-classic:`)
// plus a block in app/globals.css. Apple is written as "not classic", so the
// server and the first client render are already Apple and the page never
// flashes into it; only a visitor who chose Classic sees the swap, once.
// =============================================================================

export type WidgetSkin = "apple" | "classic";

export const WIDGET_SKINS: WidgetSkin[] = ["apple", "classic"];
export const WIDGET_SKIN_DEFAULT: WidgetSkin = "apple";

const STORAGE_KEY = "hux_widget_skin";

export function getWidgetSkinLabel(skin: WidgetSkin, locale: Locale): string {
  return t(locale, skin === "classic" ? "widgetSkinClassic" : "widgetSkinApple");
}

function readStored(): WidgetSkin {
  if (typeof window === "undefined") return WIDGET_SKIN_DEFAULT;
  try {
    return localStorage.getItem(STORAGE_KEY) === "classic" ? "classic" : "apple";
  } catch {
    return WIDGET_SKIN_DEFAULT;
  }
}

interface WidgetSkinContextType {
  skin: WidgetSkin;
  setSkin: (skin: WidgetSkin) => void;
  toggle: () => void;
}

const WidgetSkinContext = createContext<WidgetSkinContextType | undefined>(
  undefined,
);

export function useWidgetSkin(): WidgetSkinContextType {
  const context = useContext(WidgetSkinContext);
  if (!context) {
    throw new Error("useWidgetSkin must be used within WidgetSkinProvider");
  }
  return context;
}

/** The skin, or the default outside the provider (labs, MDX previews). */
export function useOptionalWidgetSkin(): WidgetSkin {
  return useContext(WidgetSkinContext)?.skin ?? WIDGET_SKIN_DEFAULT;
}

export function WidgetSkinProvider({ children }: { children: React.ReactNode }) {
  // Default on the server and the first client render, then hydrate from
  // localStorage — the same hydration-safe shape the glass setting uses.
  const [skin, setSkinState] = useState<WidgetSkin>(WIDGET_SKIN_DEFAULT);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setSkinState(readStored());
  }, []);

  // The skin is an attribute on <html>, not a prop threaded through the tree.
  useEffect(() => {
    document.documentElement.dataset.widgetSkin = skin;
  }, [skin]);

  // Whether the widget font resolves to SF itself (an Apple platform), in
  // which case the system already tracks it and the skin's SF-tracking rule
  // for the fallback font stands down (globals.css).
  useEffect(() => {
    const apple = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
    document.documentElement.toggleAttribute("data-system-font", apple);
  }, []);

  const setSkin = useCallback((next: WidgetSkin) => {
    setSkinState(next);
    try {
      if (next === WIDGET_SKIN_DEFAULT) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggle = useCallback(
    () => setSkin(skin === "classic" ? "apple" : "classic"),
    [skin, setSkin],
  );

  const value = useMemo(() => ({ skin, setSkin, toggle }), [skin, setSkin, toggle]);

  return (
    <WidgetSkinContext.Provider value={value}>{children}</WidgetSkinContext.Provider>
  );
}
