"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { sceneGradient, type SkyScene } from "../lib/atmosphere/scene";
import { AtmosphereEngine } from "../lib/atmosphere/engine";
import { subscribeGravity } from "../lib/gyroscope";
import type { PokeKind } from "../lib/poke";
import type { WipeHandle } from "../lib/wipe";
import type { WallpaperStats } from "../lib/wallpaper/renderer";
import { attachWindStir } from "../lib/wallpaper/stir";
import { getWallpaperQualityProfile } from "../lib/wallpaper/support";

/**
 * The raymarch costs more per pixel than the Sky's decks, so it takes a share
 * of the Sky's budget for the device; the adaptive loop spends less from there.
 */
const BUDGET_SHARE = 0.65;

/** Below this much rain or snow there is nothing for a hand to stir. */
const STIR_MIN_PRECIP = 0.02;

/**
 * A thin React shell around `AtmosphereEngine` (lib/atmosphere/engine.ts): it
 * owns the two canvases, streams the scene and the switches in, and hands the
 * engine's egg calls up through the same refs <WeatherWallpaper /> fills, so
 * the page arms them for either engine alike.
 */
export function AtmosphereWallpaper({
  scene,
  className = "",
  paused = false,
  active = true,
  lightningKey = 0,
  pixelBudget,
  maxFps,
  gyro = false,
  interactive = false,
  statsRef,
  pokeRef,
  wipeRef,
}: {
  scene: SkyScene;
  className?: string;
  /** Hold the clock (the studio's pause); the scene still redraws on change. */
  paused?: boolean;
  /** Drive the frame loop; when false the last frame stays on screen. */
  active?: boolean;
  /** Bump to bring the storm's next stroke forward (the studio's replay). */
  lightningKey?: number;
  /** Cloud pixels per frame; defaults to the device's share. */
  pixelBudget?: number;
  /** The loop's cap; defaults to the device's. Fixed at mount. */
  maxFps?: number;
  /** Fall along the phone's gravity, with the camera sliding for parallax. */
  gyro?: boolean;
  /** A drag across the page background stirs a gust (full page only). */
  interactive?: boolean;
  statsRef?: React.MutableRefObject<(() => WallpaperStats) | null>;
  pokeRef?: React.MutableRefObject<((kind: PokeKind, x: number, y: number) => void) | null>;
  wipeRef?: React.MutableRefObject<WipeHandle | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detailsRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AtmosphereEngine | null>(null);
  const [renderer, setRenderer] = useState<"pending" | "webgl" | "fallback">("pending");
  const reducedMotion = useReducedMotion() ?? false;
  const budget = pixelBudget ?? Math.round(getWallpaperQualityProfile().pixelBudget * BUDGET_SHARE);
  const budgetRef = useRef(budget);
  budgetRef.current = budget;

  useEffect(() => {
    const canvas = canvasRef.current, details = detailsRef.current;
    if (!canvas || !details) return;
    const engine = new AtmosphereEngine(canvas, details, {
      pixelBudget: budgetRef.current,
      maxFps: maxFps ?? getWallpaperQualityProfile().maxFps,
      onRenderer: setRenderer,
    });
    engineRef.current = engine;
    if (statsRef) statsRef.current = () => engine.getStats();
    if (pokeRef) pokeRef.current = (kind, x, y) => engine.poke(kind, x, y);
    if (wipeRef) wipeRef.current = { wipe: (x, y) => engine.wipe(x, y), wipeEnd: () => engine.wipeEnd() };
    return () => {
      if (statsRef) statsRef.current = null;
      if (pokeRef) pokeRef.current = null;
      if (wipeRef) wipeRef.current = null;
      engine.destroy();
      engineRef.current = null;
    };
    // The engine is created once per canvas; everything else streams in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { engineRef.current?.setPixelBudget(budget); }, [budget]);
  useEffect(() => { engineRef.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);
  useEffect(() => { engineRef.current?.setPaused(paused); }, [paused]);
  useEffect(() => { engineRef.current?.setActive(active); }, [active]);
  useEffect(() => { engineRef.current?.setScene(scene); }, [scene]);

  const replayed = useRef(lightningKey);
  useEffect(() => {
    if (replayed.current === lightningKey) return;
    replayed.current = lightningKey;
    engineRef.current?.replayLightning();
  }, [lightningKey]);

  // The tilt: readings go from the sensor to the engine without passing
  // through React. Under reduced motion the sky is one still frame.
  const tilt = gyro && !reducedMotion;
  useEffect(() => {
    if (!tilt) return;
    const stop = subscribeGravity((gravity) => engineRef.current?.setGravity(gravity));
    return () => {
      stop();
      engineRef.current?.setGravity(null);
    };
  }, [tilt]);

  // The gust exists only when there is something falling for it to blow.
  const precipitating = scene.rain > STIR_MIN_PRECIP || scene.snow > STIR_MIN_PRECIP;
  useEffect(() => {
    if (!interactive || !precipitating || reducedMotion) return;
    return attachWindStir({ onStir: (vx) => engineRef.current?.stirWind(vx) });
  }, [interactive, precipitating, reducedMotion]);

  return (
    <div aria-hidden="true" className={`absolute inset-0 overflow-hidden ${className}`} style={{ backgroundImage: sceneGradient(scene) }}>
      <canvas
        ref={canvasRef}
        data-atmosphere-wallpaper
        data-renderer={renderer}
        className="absolute inset-0 h-full w-full transition-opacity duration-[1500ms] motion-reduce:transition-none"
        style={{ opacity: renderer === "webgl" ? 1 : 0 }}
      />
      <canvas ref={detailsRef} data-atmosphere-details className="absolute inset-0 h-full w-full" />
    </div>
  );
}
