"use client";

import { useEffect, useRef } from "react";
import { sceneGradient, type SkyScene } from "../lib/atmosphere/scene";
import { lightningAt } from "../lib/atmosphere/lightning";

/** Adaptive cloud volume + independent display-resolution precipitation. Both
 * layers share one simulation clock, visibility policy and weather transition. */
export function AtmosphereWallpaper({ scene, className = "", paused = false, active = true, lightningKey = 0, pixelBudget: budgetOverride }: {
  scene: SkyScene;
  className?: string;
  paused?: boolean;
  active?: boolean;
  lightningKey?: number;
  pixelBudget?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detailsRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(scene);
  const activeRef = useRef(active);
  const pausedRef = useRef(paused);
  const invalidateRef = useRef<(() => void) | null>(null);
  const resetLightningRef = useRef<(() => void) | null>(null);
  useEffect(() => { pausedRef.current = paused; invalidateRef.current?.(); }, [paused]);
  useEffect(() => { activeRef.current = active; invalidateRef.current?.(); }, [active]);
  useEffect(() => { targetRef.current = scene; invalidateRef.current?.(); }, [scene]);
  useEffect(() => { resetLightningRef.current?.(); }, [lightningKey]);

  useEffect(() => {
    const canvas = canvasRef.current, detailCanvas = detailsRef.current;
    if (!canvas || !detailCanvas) return;
    let disposed = false, lost = false;
    let frame = 0;
    let renderer: ReturnType<typeof import("../lib/atmosphere/renderer").createSkyRenderer> = null;
    let details: ReturnType<typeof import("../lib/atmosphere/details").createWeatherDetails> = null;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const small = matchMedia("(max-width: 640px)");
    let current = structuredClone(targetRef.current);
    let last = 0, lastSky = 0, lastFlash = 0;
    let elapsed = 137, stormTime = 0;
    let previousStorm = false, detailsVisible = false;
    const drift: [number, number] = [0.8, 0.4];
    let pixelBudget = budgetOverride ?? (small.matches ? 320_000 : 720_000);
    let slowFrames = 0, draws = 0;
    let intersecting = true;
    const motionAllowed = () => !pausedRef.current && !reduced.matches;
    const visible = () => activeRef.current && !document.hidden && intersecting;
    const resize = (schedule = true) => {
      pixelBudget = Math.min(pixelBudget, small.matches ? 320_000 : 720_000);
      const { width, height } = canvas.getBoundingClientRect();
      if (width && height) {
        renderer?.resize(width, height, pixelBudget);
        details?.resize(width, height);
      }
      lastSky = 0;
      if (schedule) invalidate();
    };
    const render = (now: number) => {
      frame = 0;
      if ((!renderer && !details) || disposed || !visible()) return;
      const delta = last ? now - last : 16.67;
      const moving = motionAllowed();
      if (moving && delta < 1000 / 60 - 1) { frame = requestAnimationFrame(render); return; }
      const dt = moving ? Math.min(delta / 1000, 0.08) : 0;
      last = now;
      elapsed += dt;
      const blend = moving ? 1 - Math.exp(-dt / 1.1) : 1;
      current = Object.fromEntries(Object.entries(targetRef.current).map(([key, value]) => {
        const before = current[key as keyof SkyScene];
        return [key, typeof value === "number"
          ? (before as number) + (value - (before as number)) * blend
          : (value as number[]).map((v, i) => (before as number[])[i] + (v - (before as number[])[i]) * blend)];
      })) as unknown as SkyScene;
      drift[0] += current.wind[0] * dt * 0.012;
      drift[1] += current.wind[1] * dt * 0.012;
      const storm = targetRef.current.storm > 0.1;
      if (storm && !previousStorm) stormTime = 0;
      previousStorm = storm;
      if (storm) stormTime += dt;
      const lightning = lightningAt(stormTime, storm && moving);
      // Cloud lighting catches every lightning pulse; normal skies stay capped.
      if (renderer && (!moving || !lastSky || now - lastSky >= 1000 / 24 || Math.abs(lightning.strength - lastFlash) > 0.06)) {
        renderer.draw(current, elapsed, drift, lightning);
        lastSky = now; lastFlash = lightning.strength;
        canvas.dataset.renderer = "webgl";
        canvas.dataset.frames = String(++draws);
        canvas.style.opacity = "1";
      }
      const needsDetails = current.rain > 0.001 || current.snow > 0.001 || lightning.bolt > 0.001;
      if (needsDetails) details?.draw(current, elapsed, dt, lightning);
      else if (detailsVisible) details?.clear();
      detailsVisible = needsDetails;
      if (moving) {
        slowFrames = delta > 80 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
        if (slowFrames > 20 && pixelBudget > 180_000) {
          pixelBudget = Math.round(pixelBudget * 0.7); slowFrames = 0;
          // Only cloud resolution changes. Particle backing pixels stay sharp.
          const { width, height } = canvas.getBoundingClientRect();
          renderer?.resize(width, height, pixelBudget); lastSky = 0;
        }
        frame = requestAnimationFrame(render);
      }
    };
    function invalidate() {
      lastSky = 0;
      if (!frame && (renderer || details) && visible() && !disposed) frame = requestAnimationFrame(render);
    }
    const visibility = () => {
      cancelAnimationFrame(frame); frame = 0; last = 0; invalidate();
    };
    const restoreSky = async () => {
      const { createSkyRenderer } = await import("../lib/atmosphere/renderer");
      if (disposed || lost) return;
      renderer = createSkyRenderer(canvas);
      if (!renderer) canvas.dataset.renderer = "fallback";
      resize();
    };
    const init = async () => {
      const { createWeatherDetails } = await import("../lib/atmosphere/details");
      if (disposed) return;
      details = createWeatherDetails(detailCanvas);
      resize();
      await restoreSky();
    };
    const contextLost = (event: Event) => {
      event.preventDefault(); lost = true;
      canvas.style.opacity = "0"; canvas.dataset.renderer = "fallback";
      renderer?.dispose(); renderer = null;
    };
    const contextRestored = () => {
      lost = false; last = 0;
      void restoreSky().catch(() => { canvas.dataset.renderer = "fallback"; });
    };
    invalidateRef.current = invalidate;
    resetLightningRef.current = () => { stormTime = 0; invalidate(); };
    const observer = new ResizeObserver(() => resize()); observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; visibility(); });
    intersection.observe(canvas);
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", visibility);
    void init().catch(() => { canvas.dataset.renderer = "fallback"; });
    return () => {
      disposed = true; invalidateRef.current = null; resetLightningRef.current = null;
      cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", visibility);
      renderer?.dispose(); details?.clear();
    };
  }, [budgetOverride]);

  return (
    <div aria-hidden="true" className={`absolute inset-0 overflow-hidden ${className}`} style={{ backgroundImage: sceneGradient(scene) }}>
      <canvas ref={canvasRef} data-atmosphere-wallpaper data-renderer="pending" className="absolute inset-0 h-full w-full transition-opacity duration-[1500ms] motion-reduce:transition-none" style={{ opacity: 0 }} />
      <canvas ref={detailsRef} data-atmosphere-details className="absolute inset-0 h-full w-full" />
    </div>
  );
}
