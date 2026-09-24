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
      <div
        aria-hidden
        className="about-glow pointer-events-none absolute inset-0 z-[1] blur-md"
        style={{
          padding: "64px",
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
        }}
      />
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
