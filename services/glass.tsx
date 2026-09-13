"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
// The choice is one class on <html>; the fills themselves are CSS variables in
// app/globals.css. Nothing re-renders to change material, and any surface that
// paints with `bg-glass*` follows along for free.
// =============================================================================

export type GlassMaterial = "tinted" | "clear";

export const GLASS_MATERIALS: GlassMaterial[] = ["tinted", "clear"];

const STORAGE_KEY = "hux_glass";
const CLEAR_CLASS = "glass-clear";

export function getGlassLabel(material: GlassMaterial, locale: "en" | "zh"): string {
  // Apple's own names, in both languages: Settings → Display & Brightness.
  if (locale === "zh") return material === "clear" ? "透明" : "色调";
  return material === "clear" ? "Clear" : "Tinted";
}

function readStored(): GlassMaterial {
  if (typeof window === "undefined") return "tinted";
  try {
    return localStorage.getItem(STORAGE_KEY) === "clear" ? "clear" : "tinted";
  } catch {
    return "tinted";
  }
}

interface GlassContextType {
  material: GlassMaterial;
  setMaterial: (material: GlassMaterial) => void;
  toggle: () => void;
}

const GlassContext = createContext<GlassContextType | undefined>(undefined);

export function useGlass() {
  const context = useContext(GlassContext);
  if (!context) throw new Error("useGlass must be used within GlassProvider");
  return context;
}

export function useOptionalGlass() {
  return useContext(GlassContext);
}

export function GlassProvider({ children }: { children: React.ReactNode }) {
  // Default on the server and the first client render, then hydrate from
  // localStorage — the same hydration-safe shape the ambient settings use.
  const [material, setMaterialState] = useState<GlassMaterial>("tinted");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setMaterialState(readStored());
  }, []);

  // The material is a class on <html>, not a prop threaded through the tree.
  useEffect(() => {
    document.documentElement.classList.toggle(CLEAR_CLASS, material === "clear");
  }, [material]);

  const setMaterial = useCallback((next: GlassMaterial) => {
    setMaterialState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
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
    () => ({ material, setMaterial, toggle }),
    [material, setMaterial, toggle]
  );

  return <GlassContext.Provider value={value}>{children}</GlassContext.Provider>;
}
