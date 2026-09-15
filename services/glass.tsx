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
// Glass — the material every floating System UI surface is made of.
//
// iOS 26 offers exactly two Liquid Glass materials, and so do we:
//
//   tinted (色调)  the default. Fills carry enough of the card colour to read
//                  as a surface in their own right.
//   clear  (透明)  a vibrancy-style wash. Whatever is behind the surface — a
//                  wallpaper, the page — comes through as the colour.
//
// And, orthogonal to the material, a tint:
//
//   neutral        the baseline. Glass is the card colour; hover and selection
//                  are ink washes. Grey, by construction.
//   wallpaper      glass and the accent wash borrow the wallpaper's dominant
//                  colour — the one the profiler measured, clamped by the
//                  legibility policy so it colours without shouting. What the
//                  Lock Screen clock and iOS 18's tinted icons do.
//
// Each choice is one class or attribute on <html>; the fills themselves are
// CSS variables in app/globals.css. Nothing re-renders to change material or
// tint, and any surface that paints with `bg-glass*` follows along for free.
// =============================================================================

export type GlassMaterial = "tinted" | "clear";
export type GlassTint = "neutral" | "wallpaper";

export const GLASS_MATERIALS: GlassMaterial[] = ["tinted", "clear"];
export const GLASS_TINTS: GlassTint[] = ["neutral", "wallpaper"];

const STORAGE_KEY = "hux_glass";
const TINT_STORAGE_KEY = "hux_glass_tint";
const CLEAR_CLASS = "glass-clear";

/** Apple's own names, in both languages: Settings → Display & Brightness. */
export function getGlassLabel(material: GlassMaterial, locale: Locale): string {
  return t(locale, material === "clear" ? "glassClear" : "glassTinted");
}

export function getTintLabel(tint: GlassTint, locale: Locale): string {
  return t(locale, tint === "wallpaper" ? "tintWallpaper" : "tintNeutral");
}

function readStored(): GlassMaterial {
  if (typeof window === "undefined") return "tinted";
  try {
    return localStorage.getItem(STORAGE_KEY) === "clear" ? "clear" : "tinted";
  } catch {
    return "tinted";
  }
}

function readStoredTint(): GlassTint {
  if (typeof window === "undefined") return "neutral";
  try {
    return localStorage.getItem(TINT_STORAGE_KEY) === "wallpaper" ? "wallpaper" : "neutral";
  } catch {
    return "neutral";
  }
}

interface GlassContextType {
  material: GlassMaterial;
  setMaterial: (material: GlassMaterial) => void;
  toggle: () => void;
  tint: GlassTint;
  setTint: (tint: GlassTint) => void;
}

const GlassContext = createContext<GlassContextType | undefined>(undefined);

export function useGlass() {
  const context = useContext(GlassContext);
  if (!context) throw new Error("useGlass must be used within GlassProvider");
  return context;
}

export function GlassProvider({ children }: { children: React.ReactNode }) {
  // Default on the server and the first client render, then hydrate from
  // localStorage — the same hydration-safe shape the ambient settings use.
  const [material, setMaterialState] = useState<GlassMaterial>("tinted");
  const [tint, setTintState] = useState<GlassTint>("neutral");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setMaterialState(readStored());
    setTintState(readStoredTint());
  }, []);

  // The material is a class on <html>, not a prop threaded through the tree.
  useEffect(() => {
    document.documentElement.classList.toggle(CLEAR_CLASS, material === "clear");
  }, [material]);

  // The tint is an attribute, read by the same stylesheet.
  useEffect(() => {
    if (tint === "wallpaper") document.documentElement.dataset.tint = "wallpaper";
    else delete document.documentElement.dataset.tint;
  }, [tint]);

  const setMaterial = useCallback((next: GlassMaterial) => {
    setMaterialState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setTint = useCallback((next: GlassTint) => {
    setTintState(next);
    try {
      localStorage.setItem(TINT_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // One write path to the stored key, so persistence can only be wrong once.
  const toggle = useCallback(
    () => setMaterial(material === "clear" ? "tinted" : "clear"),
    [material, setMaterial]
  );

  const value = useMemo(
    () => ({ material, setMaterial, toggle, tint, setTint }),
    [material, setMaterial, toggle, tint, setTint]
  );

  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}
