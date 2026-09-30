"use client";

import { cn } from "@/lib/utils";
import { useReducedMotion } from "framer-motion";
import {
  GLOBAL_ROTATION_MS,
  LOADING_SHAPES,
  MORPH_INTERVAL_MS,
} from "../lib/loading-shapes";

// =============================================================================
// LoadingIndicator — M3 Expressive's replacement for the spinner.
//
// One shape morphing into the next every 650ms (lib/loading-shapes.ts), each
// morph also turning it a quarter, while the whole indicator turns once every
// 4.67s — Compose's `LoadingIndicator`. The active indicator is 38/48 of its
// box; `contained` puts it on a `primary-container` disc in
// `on-primary-container`, uncontained it is `primary` (or `currentColor`
// where the caller sets one).
//
// SMIL, not script: the browser interpolates the paths and the turns on its
// own clock, nothing runs per frame in JS, and a hidden indicator (the Glass
// theme's, in a `<Themed>` slot) costs nothing. Reduced motion shows
// the first shape, still.
// =============================================================================

const STEPS = LOADING_SHAPES.length;
const CYCLE_MS = STEPS * MORPH_INTERVAL_MS;
/** Emphasized: the morph lands fast and settles long, as Compose's spring. */
const SPLINE = "0.2 0 0 1";

const keyTimes = (n: number) =>
  Array.from({ length: n + 1 }, (_, i) => f4(i / n)).join(";");
const f4 = (n: number) => (Math.round(n * 10000) / 10000).toString();

// The quarter turns: seven morphs make 630°, which does not come back round,
// so the turning runs over four cycles (28 quarters = 7 full turns) and
// loops seamlessly.
const TURNS = STEPS * 4;
const TURN_VALUES = Array.from({ length: TURNS + 1 }, (_, i) => i * 90).join(";");

export function LoadingIndicator({
  size = 48,
  contained = false,
  className,
  label,
}: {
  /** The box, in px (Compose: 48dp). */
  size?: number;
  contained?: boolean;
  className?: string;
  /** Accessible name; omit when something nearby already says "loading". */
  label?: string;
}) {
  const still = useReducedMotion() ?? false;
  return (
    <svg
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      viewBox="-24 -24 48 48"
      className={cn(
        "shrink-0",
        contained ? "text-(--md-on-primary-container)" : "text-(--md-primary)",
        className,
      )}
    >
      {contained && <circle r="24" fill="var(--md-primary-container)" />}
      <g transform="scale(15.5)">
        <g>
          {!still && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0"
              to="360"
              dur={`${GLOBAL_ROTATION_MS}ms`}
              repeatCount="indefinite"
            />
          )}
          <g>
            {!still && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                values={TURN_VALUES}
                keyTimes={keyTimes(TURNS)}
                calcMode="spline"
                keySplines={Array(TURNS).fill(SPLINE).join(";")}
                dur={`${CYCLE_MS * 4}ms`}
                repeatCount="indefinite"
              />
            )}
            <path d={LOADING_SHAPES[0]} fill="currentColor">
              {!still && (
                <animate
                  attributeName="d"
                  values={[...LOADING_SHAPES, LOADING_SHAPES[0]].join(";")}
                  keyTimes={keyTimes(STEPS)}
                  calcMode="spline"
                  keySplines={Array(STEPS).fill(SPLINE).join(";")}
                  dur={`${CYCLE_MS}ms`}
                  repeatCount="indefinite"
                />
              )}
            </path>
          </g>
        </g>
      </g>
    </svg>
  );
}
