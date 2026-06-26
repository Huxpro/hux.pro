"use client";

/**
 * TimelineBeam — animated ASCII particle stream that connects a commit
 * to its explicitly-attached role across the right gutter.
 *
 * Geometry: measured from the source/target row DOM ids (commit hash).
 * Each row's rail tick sits at top=20px (the title baseline), so we
 * anchor the beam endpoints there.
 *
 * Motion: a column of small `·` characters animates `top` from 100% to
 * 0% within the beam container, with opacity fade-in/fade-out. Particles
 * are staggered so the stream feels continuous.
 *
 * Hover gating: only animates when `active` is true (parent decides).
 */

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TimelineBeamProps {
  fromHash: string;
  toHash: string;
  active: boolean;
}

interface Geom {
  top: number;
  height: number;
}

const PARTICLE_COUNT = 7;
const DURATION_SEC = 1.4;
// Baseline offset inside each commit row — matches the rail's `top-5`
// anchor (20px = 1.25rem) so the beam ends align with the bracket tick.
const BASELINE_PX = 20;

export function TimelineBeam({
  fromHash,
  toHash,
  active,
}: TimelineBeamProps) {
  const selfRef = useRef<HTMLDivElement | null>(null);
  const [geom, setGeom] = useState<Geom | null>(null);

  useLayoutEffect(() => {
    const self = selfRef.current;
    const container = self?.parentElement;
    if (!container) return;
    const from = document.getElementById(fromHash);
    const to = document.getElementById(toHash);
    if (!from || !to) return;

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const fromRect = from.getBoundingClientRect();
      const toRect = to.getBoundingClientRect();
      const fromBaseline = fromRect.top - containerRect.top + BASELINE_PX;
      const toBaseline = toRect.top - containerRect.top + BASELINE_PX;
      const height = fromBaseline - toBaseline;
      if (height <= 0) {
        setGeom(null);
        return;
      }
      setGeom({ top: toBaseline, height });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(from);
    ro.observe(to);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [fromHash, toHash]);

  return (
    <div
      ref={selfRef}
      aria-hidden
      className="pointer-events-none absolute"
      style={
        geom
          ? {
              top: geom.top,
              height: geom.height,
              // Align with the right-edge rail. Row wrapper has -mx-3 so
              // the rail sits 12px past the commits-container right edge.
              right: "-12px",
              width: 8,
            }
          : { top: 0, right: 0, width: 0, height: 0, visibility: "hidden" }
      }
    >
      {geom &&
        Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "beam-particle absolute right-0 font-mono leading-none text-foreground",
              "transition-opacity duration-150",
            )}
            style={{
              top: "100%",
              fontSize: "10px",
              opacity: 0,
              animation: active
                ? `beam-particle ${DURATION_SEC}s linear ${(i / PARTICLE_COUNT) * DURATION_SEC}s infinite`
                : "none",
            }}
          >
            ·
          </span>
        ))}
    </div>
  );
}
