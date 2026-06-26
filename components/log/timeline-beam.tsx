"use client";

/**
 * TimelineBeam — ASCII "comet" stream that climbs the right-gutter rail
 * to connect a commit with its attached role.
 *
 * A comet is a vertical stack of 4 characters: a bright head (`╿`) plus
 * three trailing `·` dots with descending static opacity. That gives a
 * fixed spatial gradient. Each comet then animates as a unit from
 * below the source row up past the target role, with a temporal fade
 * in/out so it never abruptly appears or vanishes.
 *
 * Multiple comets stagger their animation so the stream reads as
 * continuous, like Matrix rain in reverse. The static `┐│┘` bracket
 * remains underneath as the at-rest track; the comet flies along it
 * only when the segment is active (hover or expand).
 */

import { useLayoutEffect, useRef, useState } from "react";

interface TimelineBeamProps {
  fromHash: string;
  toHash: string;
  active: boolean;
}

interface Geom {
  top: number;
  height: number;
}

const COMET_COUNT = 3;
const DURATION_SEC = 1.2;
// Anchor the comet endpoints at the title baseline (matches the rail's
// `top-5` corner tick, 20px = 1.25rem).
const BASELINE_PX = 20;

// Each comet = head + vertical-bar tail. Thin glyphs (▴, ┃, │, ·) keep
// the comet a single-pixel-wide column of light rather than a chunky
// stack of dominoes. The small up-pointing triangle reads as direction
// without adding visual weight.
const COMET_CHARS: { char: string; opacity: number; fontSize: string }[] = [
  { char: "▴", opacity: 1.0, fontSize: "9px" },
  { char: "┃", opacity: 0.7, fontSize: "11px" },
  { char: "│", opacity: 0.4, fontSize: "11px" },
  { char: "·", opacity: 0.18, fontSize: "10px" },
];
const COMET_PX_HEIGHT = 44;

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
      className="pointer-events-none absolute overflow-hidden"
      style={
        geom
          ? {
              top: geom.top - COMET_PX_HEIGHT / 4,
              // Extend container slightly past both endpoints so the comet
              // enters/exits with breathing room before its opacity fade.
              height: geom.height + COMET_PX_HEIGHT / 2,
              right: "-14px",
              width: 18,
            }
          : { top: 0, right: 0, width: 0, height: 0, visibility: "hidden" }
      }
    >
      {geom &&
        Array.from({ length: COMET_COUNT }).map((_, cometIndex) => (
          <div
            key={cometIndex}
            className="beam-comet absolute right-0 flex flex-col items-end font-mono leading-none text-foreground"
            style={{
              top: "100%",
              opacity: 0,
              animation: active
                ? `beam-comet ${DURATION_SEC}s linear ${(cometIndex / COMET_COUNT) * DURATION_SEC}s infinite`
                : "none",
            }}
          >
            {COMET_CHARS.map((c, i) => (
              <span
                key={i}
                style={{
                  fontSize: c.fontSize,
                  opacity: c.opacity,
                  lineHeight: 1,
                  marginTop: i === 0 ? 0 : 1,
                }}
              >
                {c.char}
              </span>
            ))}
          </div>
        ))}
    </div>
  );
}
