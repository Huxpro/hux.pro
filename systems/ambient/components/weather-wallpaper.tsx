"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import {
  scenesRoughlyEqual,
  type WallpaperScene,
} from "../lib/atmosphere";
import { createWallpaperEngine, type WallpaperEngine } from "../wallpaper/engine";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WeatherWallpaper({
  scene,
  enabled,
  edgeMask,
}: {
  scene: WallpaperScene | null;
  enabled: boolean;
  edgeMask: string | null;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WallpaperEngine | null>(null);
  const lastSceneRef = useRef<WallpaperScene | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !enabled) return;

    const engine = createWallpaperEngine(host);
    if (!engine) return;
    engineRef.current = engine;
    engine.setReducedMotion(prefersReducedMotion());

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => engine.setReducedMotion(media.matches);
    media.addEventListener("change", onMotion);

    return () => {
      media.removeEventListener("change", onMotion);
      engine.destroy();
      engineRef.current = null;
      lastSceneRef.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !scene) return;
    const prev = lastSceneRef.current;
    if (prev && scenesRoughlyEqual(prev, scene)) return;
    lastSceneRef.current = scene;
    engine.setTarget(scene);
  }, [scene]);

  if (!enabled) return null;

  const maskStyle: CSSProperties | undefined = edgeMask
    ? {
        WebkitMaskImage: edgeMask,
        maskImage: edgeMask,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
      }
    : undefined;

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="absolute inset-0"
      style={maskStyle}
    />
  );
}
