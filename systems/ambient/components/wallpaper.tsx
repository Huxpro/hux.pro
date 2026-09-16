"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { WeatherScene } from "../lib/scene";
import {
  WallpaperRenderer,
  type WallpaperStats,
} from "../lib/wallpaper/renderer";
import { attachWindStir } from "../lib/wallpaper/stir";
import { getWallpaperQualityProfile } from "../lib/wallpaper/support";

// ---------------------------------------------------------------------------
// WeatherWallpaper — the shader-backed full-page sky.
//
// A thin React shell around `WallpaperRenderer`: it owns the <canvas>, hands
// the renderer every new scene, starts/stops it with `active`, and fades the
// canvas in once the first frame has actually been painted (a WebGL canvas is
// black until then). Everything visual lives in the renderer + shader.
//
// It also arms the easter egg only the Sky can answer: while it is raining or
// snowing, `interactive` lets a hand dragged across the page background stir up
// a gust (lib/wallpaper/stir.ts). The thunder-day strike, which both engines
// answer, is wired one level up in <WallpaperBackground /> instead.
// ---------------------------------------------------------------------------

interface WeatherWallpaperProps {
  scene: WeatherScene;
  /** Drive the frame loop; when false the last frame stays on screen. */
  active: boolean;
  /** Optional CSS mask (iOS soft-edging). */
  edgeMask?: string | null;
  /**
   * Let a drag across the page background stir up a gust — the easter egg. For
   * the full-page sky only; a preview tile is a picture of a sky, not one you
   * can put your hand into.
   */
  interactive?: boolean;
  className?: string;
  /** WebGL unavailable or lost — the parent should swap to the CSS renderer. */
  onFallback?: (reason: string) => void;
  /** Handed a getter for live renderer stats (resolution / frame time), for the devtool. */
  statsRef?: React.MutableRefObject<(() => WallpaperStats) | null>;
  /**
   * Handed the renderer's strike — one bolt at (x, y) in screen space, 0..1
   * bottom → top. The thunder-day easter egg; see lib/strike.ts.
   */
  strikeRef?: React.MutableRefObject<((x: number, y: number) => void) | null>;
  /**
   * Override the device quality profile — for a small preview (the picker's
   * CG tile) that should cost a fraction of the full-page layer.
   */
  quality?: { pixelBudget?: number; maxFps?: number };
}

export function WeatherWallpaper({
  scene,
  active,
  edgeMask,
  interactive = false,
  className,
  onFallback,
  statsRef,
  strikeRef,
  quality,
}: WeatherWallpaperProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WallpaperRenderer | null>(null);
  const [painted, setPainted] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;

  // Latest callbacks without re-creating the renderer.
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const profile = getWallpaperQualityProfile();
    const renderer = new WallpaperRenderer(canvas, {
      reducedMotion,
      pixelBudget: quality?.pixelBudget ?? profile.pixelBudget,
      maxFps: quality?.maxFps ?? profile.maxFps,
      onFallback: (reason) => onFallbackRef.current?.(reason),
      onFirstFrame: () => setPainted(true),
    });
    rendererRef.current = renderer;
    // The devtool pulls stats on its own schedule; nothing is copied until it asks.
    if (statsRef) statsRef.current = () => renderer.getStats();
    if (strikeRef) strikeRef.current = (x, y) => renderer.strike(x, y);

    return () => {
      if (statsRef) statsRef.current = null;
      if (strikeRef) strikeRef.current = null;
      renderer.destroy();
      rendererRef.current = null;
    };
    // The renderer is created once per canvas; scenes stream in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    rendererRef.current?.setScene(scene);
  }, [scene]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    if (active) renderer.start();
    else renderer.stop();
  }, [active]);

  // The easter egg exists only when there is something falling for the wind to
  // blow — and never under reduced motion, where the sky is one still frame.
  const precipitating =
    scene.precipitation.type !== "none" && scene.precipitation.intensity > 0.02;
  useEffect(() => {
    if (!interactive || !precipitating || reducedMotion) return;
    return attachWindStir({
      onStir: (vx, x, y) => rendererRef.current?.stirWind(vx, x, y),
    });
  }, [interactive, precipitating, reducedMotion]);

  const style: React.CSSProperties = {};
  if (edgeMask) {
    style.WebkitMaskImage = edgeMask;
    style.maskImage = edgeMask;
    style.WebkitMaskRepeat = "no-repeat";
    style.maskRepeat = "no-repeat";
    style.WebkitMaskSize = "100% 100%";
    style.maskSize = "100% 100%";
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        "absolute inset-0 block h-full w-full",
        "transition-opacity duration-700 ease-out",
        painted ? "opacity-100" : "opacity-0",
        className
      )}
      style={style}
    />
  );
}
