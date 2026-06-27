"use client";

/**
 * TimelineConnector — hover-only L-shaped leader line that points from
 * a commit row to its role row, like a technical-drawing callout.
 *
 * Visual: a thin line that starts at the hovered row's right edge,
 * steps right into the gutter, runs up to the target role's row, and
 * lands at a small attribution dot on the role-side corner. It draws
 * itself in once on mount (stroke-dashoffset, eased-out) and the dot
 * fades in just as the line completes. Crossfades to the next beam
 * via AnimatePresence in the parent, so quick hover transitions feel
 * continuous rather than restarted.
 *
 *     ●──┐  ← role row (attribution dot)
 *        │
 *        │
 *     ───┘  ← hovered row (tick into the row's right edge)
 *
 * Geometry measured from row DOM ids; the SVG overlay is absolutely
 * positioned inside the TagBlock's relative container.
 */

import { motion } from "motion/react";
import { useLayoutEffect, useRef, useState } from "react";

interface TimelineConnectorProps {
  fromHash: string;
  toHash: string;
}

interface Geom {
  /** Top of SVG box, relative to container. */
  top: number;
  /** SVG box height. */
  height: number;
  /** Y of the "from" anchor inside the SVG box. */
  fromY: number;
  /** Y of the "to" anchor inside the SVG box. */
  toY: number;
}

// Anchor offset inside each row — matches the title baseline that the
// old rail bracket used, so the line ends up at the visual reading line.
const BASELINE_PX = 20;
// How far the line extends to the right past the row's right edge.
const GUTTER_PX = 8;
// SVG box height padding so the terminator ticks aren't clipped.
const SVG_PAD_PX = 6;
// Width of the SVG box: just enough room for the gutter step + tick.
const SVG_WIDTH = GUTTER_PX + 4;
// Right offset of the SVG box from the commits container's right edge.
// Row wrapper has -mx-3, so right-0 of a row sits 12px past the
// container's right edge. We align our "from" anchor with that.
const RIGHT_OFFSET_PX = -12 - GUTTER_PX;

export function TimelineConnector({
  fromHash,
  toHash,
}: TimelineConnectorProps) {
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
      const cRect = container.getBoundingClientRect();
      const fRect = from.getBoundingClientRect();
      const tRect = to.getBoundingClientRect();
      // Round so the SVG `d` attribute keeps low coordinate precision
      // (rendering-svg-precision): sub-pixel accuracy here adds nothing
      // visually but pollutes the path string and forces extra repaints.
      const fromAbs = Math.round(fRect.top - cRect.top + BASELINE_PX);
      const toAbs = Math.round(tRect.top - cRect.top + BASELINE_PX);
      // Same-row attachment is degenerate; skip.
      if (fromAbs === toAbs) {
        setGeom(null);
        return;
      }
      // Span both anchors regardless of vertical order — the source
      // commit can sit ABOVE the role too (e.g. an award given after
      // tenure ended). The L still traces commit → role; the path
      // formula is symmetric, so the only thing we need to handle
      // here is positioning the SVG box to enclose both endpoints.
      const top = Math.min(fromAbs, toAbs) - SVG_PAD_PX;
      const height = Math.abs(fromAbs - toAbs) + 2 * SVG_PAD_PX;
      setGeom({
        top,
        height,
        fromY: fromAbs - top,
        toY: toAbs - top,
      });
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
    // Wrapping the SVG box in motion.div gives us a cheap opacity-based
    // enter/exit that AnimatePresence can drive — so when the cursor
    // jumps between commits the old beam fades out as the new beam
    // fades in, instead of vanishing and restarting.
    <motion.div
      ref={selfRef}
      aria-hidden
      className="pointer-events-none absolute"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      style={
        geom
          ? {
              top: geom.top,
              right: `${RIGHT_OFFSET_PX}px`,
              width: SVG_WIDTH,
              height: geom.height,
            }
          : { top: 0, right: 0, width: 0, height: 0, visibility: "hidden" }
      }
    >
      {geom && (
        <ConnectorPath
          width={SVG_WIDTH}
          height={geom.height}
          fromY={geom.fromY}
          toY={geom.toY}
        />
      )}
    </motion.div>
  );
}

function ConnectorPath({
  width,
  height,
  fromY,
  toY,
}: {
  width: number;
  height: number;
  fromY: number;
  toY: number;
}) {
  // Path:
  //   - Start at the from row's right edge (x = 0, y = fromY)
  //   - Step right into the gutter (x = GUTTER_PX, y = fromY)
  //   - Go up to the target's row (x = GUTTER_PX, y = toY)
  //   - Step left back to the role row's right edge (x = 0, y = toY)
  //
  // Lengths sum: GUTTER_PX + |fromY - toY| + GUTTER_PX (works for
  // both upward and downward L — the path formula is the same).
  const d = `M 0 ${fromY} L ${GUTTER_PX} ${fromY} L ${GUTTER_PX} ${toY} L 0 ${toY}`;
  const totalLength = GUTTER_PX + Math.abs(fromY - toY) + GUTTER_PX;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="square"
        strokeLinejoin="miter"
        className="text-muted-foreground/50"
        style={{
          strokeDasharray: totalLength,
          strokeDashoffset: totalLength,
          animation:
            "connector-draw 240ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      />
      {/* Attribution dot at the role end — the role is what this commit
          "belongs to", so the dot anchors the relationship there, the
          same way `git log --graph` uses `*` / `●` for the owning node. */}
      <circle
        cx={0}
        cy={toY}
        r={2}
        fill="currentColor"
        className="text-muted-foreground/50"
        style={{
          opacity: 0,
          animation: "connector-dot 160ms ease-out 180ms forwards",
        }}
      />
    </svg>
  );
}
