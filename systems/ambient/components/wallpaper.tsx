"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { subscribeGravity } from "../lib/gyroscope";
import type { WeatherScene } from "../lib/scene";
import {
  WallpaperRenderer,
  type WallpaperStats,
} from "../lib/wallpaper/renderer";
import { getWallpaperQualityProfile } from "../lib/wallpaper/support";

// ---------------------------------------------------------------------------
// WeatherWallpaper — the shader-backed full-page sky.
//
// A thin React shell around `WallpaperRenderer`: it owns the <canvas>, hands
// the renderer every new scene, starts/stops it with `active`, and fades the
// canvas in once the first frame has actually been painted (a WebGL canvas is
// black until then). Everything visual lives in the renderer + shader.
// ---------------------------------------------------------------------------

interface WeatherWallpaperProps {
  scene: WeatherScene;
  /** Drive the frame loop; when false the last frame stays on screen. */
  active: boolean;
  /**
   * Follow the gyroscope: the sky keeps its place on the page and gains a
   * second gravity, so the rain and snow fall along the real one instead of
   * down the viewport. The readings go from the sensor to the renderer without
   * passing through React — they arrive sixty times a second, and none of them
   * is state anything renders from. The provider owns whether this is on
   * (`gyro.active`); reduced motion turns it off here regardless.
   */
  gyro?: boolean;
  /** Optional CSS mask (iOS soft-edging). */
  edgeMask?: string | null;
  className?: string;
  /** WebGL unavailable or lost — the parent should swap to the CSS renderer. */
  onFallback?: (reason: string) => void;
  /** Handed a getter for live renderer stats (resolution / frame time), for the devtool. */
  statsRef?: React.MutableRefObject<(() => WallpaperStats) | null>;
  /**
   * Override the device quality profile — for a small preview (the picker's
   * CG tile) that should cost a fraction of the full-page layer.
   */
  quality?: { pixelBudget?: number; maxFps?: number };
}

export function WeatherWallpaper({
  scene,
  active,
  gyro = false,
  edgeMask,
  className,
  onFallback,
  statsRef,
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

    return () => {
      if (statsRef) statsRef.current = null;
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

  // Under reduced motion the wallpaper is one still frame; a sky that answered
  // every wobble of the hand would be the opposite of what that asks for.
  useEffect(() => {
    if (!gyro || reducedMotion) {
      rendererRef.current?.setGravity(null);
      return;
    }
    const stop = subscribeGravity((gravity) => rendererRef.current?.setGravity(gravity));
    return () => {
      stop();
      rendererRef.current?.setGravity(null);
    };
  }, [gyro, reducedMotion]);

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
