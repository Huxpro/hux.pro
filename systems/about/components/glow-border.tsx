"use client";

import { supportsWebGL2 } from "@/systems/ambient/lib/wallpaper/support";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { mountEdgeGlow } from "../lib/glow";

function subscribeNever() {
  return () => {};
}

/**
 * The screen-edge light. A shader when WebGL2 is available; a still conic
 * wash when it is not, so the border is never missing.
 */
export function GlowBorder({ reducedMotion }: { reducedMotion: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shader = useSyncExternalStore(
    subscribeNever,
    () => supportsWebGL2(),
    () => false,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !shader) return;
    const handle = mountEdgeGlow(canvas, reducedMotion);
    return () => handle.stop();
  }, [shader, reducedMotion]);

  if (!shader) {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "conic-gradient(from 200deg, rgba(255,96,140,0.85), rgba(150,80,255,0.8), rgba(56,140,255,0.85), rgba(40,230,210,0.8), rgba(255,150,60,0.85), rgba(255,96,140,0.85))",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, transparent 58%, black 78%, black 100%)",
          maskImage:
            "radial-gradient(ellipse at center, transparent 58%, black 78%, black 100%)",
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
