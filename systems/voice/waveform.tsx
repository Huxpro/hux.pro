"use client";

import { GLOW_CSS_STOPS } from "@/systems/glow/lib/palette";
import { useEffect, useRef } from "react";

const BAR_COUNT = 13;
const COLORS = GLOW_CSS_STOPS.split(", ");

/** A small audio meter on the same edge as the voice glow. The analyser is
 * already shared with Glow; this reads it without adding a capture stream. */
export function VoiceWaveform({
  active,
  level,
  bands,
}: {
  active: boolean;
  level: () => number;
  bands: () => readonly [number, number, number];
}) {
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!active || !root.current) return;
    const bars = Array.from(root.current.children) as HTMLElement[];
    let frame = 0;
    const draw = () => {
      const loudness = level();
      const energy = bands();
      const t = performance.now() / 1000;
      for (let i = 0; i < bars.length; i++) {
        const position = i / (bars.length - 1);
        const band = position < 0.33 ? energy[0] : position < 0.67 ? energy[1] : energy[2];
        const contour = 0.45 + 0.55 * Math.sin(Math.PI * position);
        const ripple = 0.7 + 0.3 * Math.sin(t * 11 + i * 0.85);
        const height = Math.min(1, 0.13 + (loudness * 0.7 + band * 0.3) * contour * ripple);
        bars[i].style.transform = `scaleY(${height})`;
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [active, level, bands]);

  if (!active) return null;
  return (
    <span aria-hidden className="pointer-events-none absolute bottom-0 right-14 z-10 flex h-5 items-end gap-[2px] opacity-90">
      <span ref={root} className="flex h-full items-end gap-[2px]">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            className="h-full w-[2px] origin-bottom rounded-full"
            style={{
              backgroundColor: COLORS[Math.round((i / (BAR_COUNT - 1)) * (COLORS.length - 2))],
              boxShadow: `0 0 6px ${COLORS[Math.round((i / (BAR_COUNT - 1)) * (COLORS.length - 2))]}`,
              transform: "scaleY(0.13)",
            }}
          />
        ))}
      </span>
    </span>
  );
}
