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
    canvas.hidden = !handle.live;
    return () => handle.stop();
  }, [shader, reducedMotion]);

  return (
    <>
      <div className="about-glow absolute inset-0 z-[1]" aria-hidden>
        <div className="about-glow-bloom" />
        <div className="about-glow-stroke" />
        <div className="about-glow-beam" />
      </div>
      {shader ? (
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        />
      ) : null}
    </>
  );
}
