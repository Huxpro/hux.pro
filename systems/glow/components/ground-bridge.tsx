"use client";

import { useWallpaper } from "@/systems/ambient";
import { useEffect } from "react";
import { setGlowGround } from "../lib/ground";

/**
 * Publishes what paints under the page to the glow (lib/ground.ts): the
 * ambient system's profile of it — the wallpaper's, or the plain page's —
 * and legibility's busyness. Mounted once, inside the ambient provider;
 * renders nothing.
 */
export function GlowGroundBridge() {
  const { profile, legibility } = useWallpaper();
  const { top, mid, bottom } = profile.zones;
  const busy = legibility.busy;
  useEffect(() => {
    setGlowGround({ zones: { top, mid, bottom }, busy });
  }, [top, mid, bottom, busy]);
  return null;
}
