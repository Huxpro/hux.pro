"use client";

import { GLOW_STOPS } from "@/systems/glow/lib/palette";
import { useEffect, useRef } from "react";

const BAR_COUNT = 64;
const COLORS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const place = (i / (BAR_COUNT - 1)) * (GLOW_STOPS.length - 1);
  const a = GLOW_STOPS[Math.floor(place)];
  const b = GLOW_STOPS[Math.min(GLOW_STOPS.length - 1, Math.ceil(place))];
  const mix = place % 1;
  return `rgb(${a.map((channel, index) => Math.round((channel * (1 - mix) + b[index] * mix) * 255)).join(" ")})`;
});

/** Full-width recording meter. It shares the microphone analyser with Glow,
 * but is rendered only when this alternative visual style is selected. */
export function VoiceWaveform({
  active,
  processing,
  level,
  bands,
}: {
  active: boolean;
  processing: boolean;
  level: () => number;
  bands: () => readonly [number, number, number];
}) {
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active || !root.current) return;
    const bars = Array.from(root.current.children) as HTMLElement[];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let lastDraw = 0;
    const draw = () => {
      const now = performance.now();
      if (now - lastDraw >= 32) {
        lastDraw = now;
        const loudness = processing ? 0 : level();
        const energy = processing ? [0, 0, 0] : bands();
        const t = now / 1000;
        const beam = reducedMotion ? 0.5 : (t * 0.45) % 1;
        for (let i = 0; i < bars.length; i++) {
          const position = i / (bars.length - 1);
          const band = position < 0.33 ? energy[0] : position < 0.67 ? energy[1] : energy[2];
          const contour = 0.65 + 0.35 * Math.sin(Math.PI * position);
          const ripple = 0.7 + 0.3 * Math.sin(t * 11 + i * 0.55);
          const height = processing
            ? 0.12 + 0.62 * Math.exp(-Math.pow((position - beam) / 0.1, 2))
            : Math.min(1, 0.12 + (loudness * 0.72 + band * 0.28) * contour * ripple);
          bars[i].style.transform = `scaleY(${height})`;
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, processing, level, bands]);

  if (!active) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute inset-x-3 bottom-0 z-10 flex h-5 items-end overflow-hidden opacity-90">
      <span ref={root} className="flex h-full w-full items-end justify-between gap-px">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            className="h-full min-w-px max-w-[5px] flex-1 origin-bottom rounded-full"
            style={{
              backgroundColor: COLORS[i],
              boxShadow: `0 0 5px ${COLORS[i]}`,
              transform: "scaleY(0.12)",
            }}
          />
        ))}
      </span>
    </span>
  );
}
