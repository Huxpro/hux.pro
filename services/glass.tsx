"use client";

import { t, type Locale } from "@/lib/i18n";
import { makeStore } from "@/lib/persisted-setting";
import { useCallback, useEffect, useMemo } from "react";

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
//
// Persistence is `makeStore`, the same factory the reading settings use: it
// owns the localStorage read and write, the change event, and cross-tab sync.
// What is particular to the material — the class on <html> — is what lives
// here, in GlassRootSync.
// =============================================================================

export type GlassMaterial = "tinted" | "clear";

export const GLASS_MATERIALS: GlassMaterial[] = ["tinted", "clear"];

const CLEAR_CLASS = "glass-clear";

const store = makeStore<GlassMaterial>(
  "hux_glass",
  "hux:glass",
  "tinted",
  (raw) => (raw === "clear" ? "clear" : "tinted"),
);

export const getGlassMaterial = store.get;
export const setGlassMaterial = store.set;

/** Apple's own names, in both languages: Settings → Display & Brightness. */
export function getGlassLabel(material: GlassMaterial, locale: Locale): string {
  return t(locale, material === "clear" ? "glassClear" : "glassTinted");
}

/**
 * The material, and the two ways to change it. `tinted` on the server and on
 * the first client render — `makeStore`'s server snapshot is the fallback — so
 * hydration matches; the stored choice arrives immediately after.
 */
export function useGlass() {
  const material = store.use();

  const toggle = useCallback(
    () => store.set(material === "clear" ? "tinted" : "clear"),
    [material],
  );

  return useMemo(
    () => ({ material, setMaterial: store.set, toggle }),
    [material, toggle],
  );
}

/**
 * Reflects the material onto <html>, where the CSS variables hang off it.
 * Renders nothing; mount it once at the app root, like ReadingRootSync.
 */
export function GlassRootSync() {
  const { material } = useGlass();

  useEffect(() => {
    document.documentElement.classList.toggle(CLEAR_CLASS, material === "clear");
  }, [material]);

  return null;
}
