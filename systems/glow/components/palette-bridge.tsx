"use client";

import { useSiteStyle, useTheme } from "@/services";
import { useWallpaper } from "@/systems/ambient";
import { useEffect, useState } from "react";
import { setGlowSource } from "../lib/harmony";

/** Below this OKLCH chroma a picture is grey: it has no colour to harmonise with. */
const GREY = 0.03;

const OKLCH = /oklch\(\s*[\d.]+%?\s+([\d.]+)\s+([\d.]+)/;

/**
 * A Style's signature colour, read off its own token (`--style-tint`, see
 * STYLES in app/globals.css), so the glow takes the colour a Style already
 * chose instead of a second copy of it. Read a frame after the Style or the
 * theme changes: the attribute that switches the token lands in an effect.
 */
function useStyleTint(): { h: number; c: number } | null {
  const style = useSiteStyle();
  const { theme } = useTheme();
  const [tint, setTint] = useState<{ h: number; c: number } | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--style-tint");
      const m = style === "default" ? null : OKLCH.exec(raw);
      setTint(m ? { c: Number(m[1]), h: Number(m[2]) } : null);
    });
    return () => cancelAnimationFrame(frame);
  }, [style, theme]);
  return tint;
}

/**
 * Publishes the colour the glow harmonises with (lib/harmony.ts): the
 * wallpaper's dominant colour, from the ambient profile's `tint` (a
 * photograph's measured once, the Sky's read off the live scene), or under a
 * Style, which paints no wallpaper, the Style's own tint. Null for a grey
 * picture and the plain page. Mounted once, inside the ambient provider;
 * renders nothing.
 */
export function GlowPaletteBridge() {
  const { profile, fullEnabled } = useWallpaper();
  const styleTint = useStyleTint();
  const tint =
    styleTint ?? (fullEnabled && profile.tint && profile.chroma >= GREY ? profile.tint : null);
  const h = tint ? Math.round(tint.h) : null;
  const c = tint ? Math.round(tint.c * 1000) / 1000 : null;
  useEffect(() => {
    setGlowSource(h === null || c === null ? null : { h, c });
  }, [h, c]);
  return null;
}
