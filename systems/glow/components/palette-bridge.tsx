"use client";

import { useWallpaper } from "@/systems/ambient";
import { useEffect } from "react";
import { setGlowSource } from "../lib/harmony";

/** Below this OKLCH chroma a picture is grey: it has no colour to harmonise with. */
const GREY = 0.03;

/**
 * Publishes the wallpaper's dominant colour to the glow (lib/harmony.ts): the
 * ambient profile's `tint` — a photograph's measured once, the Sky's read off
 * the live scene — or null for a grey picture and the plain page. Mounted
 * once, inside the ambient provider; renders nothing.
 */
export function GlowPaletteBridge() {
  const { profile, fullEnabled } = useWallpaper();
  const tint = fullEnabled && profile.tint && profile.chroma >= GREY ? profile.tint : null;
  const h = tint ? Math.round(tint.h) : null;
  const c = tint ? Math.round(tint.c * 1000) / 1000 : null;
  useEffect(() => {
    setGlowSource(h === null || c === null ? null : { h, c });
  }, [h, c]);
  return null;
}
