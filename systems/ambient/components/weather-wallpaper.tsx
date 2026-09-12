"use client";

import { useTheme } from "@/services";
import { useDevtool } from "@/systems/devtool";
import { useEffect, useMemo, useRef } from "react";
import { createAtmosphereRenderer } from "../lib/atmosphere";
import { isIOSBrowser } from "../lib/platform";
import {
  approachAtmosphere,
  createAtmosphereState,
  isDayPhase,
  resolveAtmosphere,
  type AtmosphereParams,
  type WallpaperSceneInput,
} from "../lib/wallpaper";
import { createParticleRenderer } from "../lib/weather-particles";
import { useAmbientTime, useWeather } from "../provider";

// =============================================================================
// WeatherWallpaper — full-page cinematic sky (shader + particles).
//
// Morphs atmosphere uniforms toward the current weather/phase instead of
// swapping canvases, so rain at sunset and clear mornings feel continuous.
// Falls back silently: the CSS gradient stack remains underneath.
// =============================================================================

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isCompactViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches || isIOSBrowser();
}

function resolveDpr(compact: boolean): number {
  const raw = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return Math.min(raw, compact ? 1.25 : 1.75);
}

function useWallpaperInput(): WallpaperSceneInput | null {
  const { theme } = useTheme();
  const { isEnabled: isDevtoolEnabled } = useDevtool();
  const { weather, isOverrideEnabled, debugOverride, isFetching } = useWeather();
  const { phase } = useAmbientTime();

  const override = isDevtoolEnabled && isOverrideEnabled ? debugOverride : null;
  const condition = override?.condition ?? weather?.condition ?? null;
  const isDay = override?.isDay ?? weather?.isDay ?? isDayPhase(phase);
  const waiting = isFetching && !weather && !override;

  return useMemo(() => {
    if (waiting || !condition) return null;
    return { condition, phase, theme, isDay };
  }, [waiting, condition, phase, theme, isDay]);
}

interface WeatherWallpaperProps {
  enabled: boolean;
  onReady?: (ready: boolean) => void;
}

export function WeatherWallpaper({ enabled, onReady }: WeatherWallpaperProps) {
  const input = useWallpaperInput();
  const inputRef = useRef<WallpaperSceneInput | null>(null);
  const onReadyRef = useRef(onReady);
  const skyRef = useRef<HTMLCanvasElement | null>(null);
  const fxRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const hasScene = !!input;

  useEffect(() => {
    const skyEl = skyRef.current;
    const fxEl = fxRef.current;
    if (!skyEl || !fxEl || !enabled || !hasScene) return;

    const sky = createAtmosphereRenderer(skyEl);
    if (!sky) {
      onReadyRef.current?.(false);
      return;
    }

    const compact = isCompactViewport();
    const fx = createParticleRenderer(fxEl, { mobile: compact });
    if (!fx) {
      sky.destroy();
      onReadyRef.current?.(false);
      return;
    }

    const initial = inputRef.current
      ? resolveAtmosphere(inputRef.current)
      : null;
    if (!initial) {
      sky.destroy();
      fx.destroy();
      return;
    }

    let target = initial;
    let sceneKey = inputRef.current
      ? `${inputRef.current.condition}:${inputRef.current.phase}:${inputRef.current.theme}:${inputRef.current.isDay}`
      : "";
    let current: AtmosphereParams = createAtmosphereState(initial);
    let lastMs = 0;
    let raf = 0;
    let running = true;
    let reduced = prefersReducedMotion();

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      reduced = motionQuery.matches;
      sky.setTimeScale(reduced ? 0 : 1);
    };
    onMotion();
    motionQuery.addEventListener("change", onMotion);

    const resize = () => {
      const parent = skyEl.parentElement;
      const w = parent?.clientWidth || window.innerWidth;
      const h = parent?.clientHeight || window.innerHeight;
      const dpr = resolveDpr(compact);
      sky.resize(w, h, dpr);
      fx.resize(w, h, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (skyEl.parentElement) ro.observe(skyEl.parentElement);
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      if (!running) return;
      if (document.visibilityState !== "hidden") {
        const dt = lastMs ? Math.min((now - lastMs) / 1000, 0.05) : 0.016;
        lastMs = now;
        const next = inputRef.current;
        if (next) {
          const key = `${next.condition}:${next.phase}:${next.theme}:${next.isDay}`;
          if (key !== sceneKey) {
            sceneKey = key;
            target = resolveAtmosphere(next);
          }
        }
        current = approachAtmosphere(current, target, reduced ? 1 : dt);
        sky.setParams(current);
        fx.setParams(current);
        sky.setLightning(fx.frame(now, reduced));
        sky.frame(now);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    onReadyRef.current?.(true);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      motionQuery.removeEventListener("change", onMotion);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      sky.destroy();
      fx.destroy();
      onReadyRef.current?.(false);
    };
  }, [enabled, hasScene]);

  if (!enabled || !input) return null;

  return (
    <div aria-hidden className="absolute inset-0">
      <canvas
        ref={skyRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        data-scene={`${input.condition}:${input.phase}:${input.theme}`}
      />
      <canvas
        ref={fxRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
