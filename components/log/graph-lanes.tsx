"use client";

/**
 * GraphLanes — the lines of the graph view, drawn over one chapter.
 *
 * The rows place their own marks: each row's gutter is as wide as the
 * chapter's lanes, and its icon sits in its lane's column (see `graph` in
 * TimelineCommit). This draws what connects them, measured off those marks
 * so it can never disagree with where they are:
 *
 *   - the main line, through every mark in column 0, top to bottom;
 *   - each project's lane, through its marks, from its newest to its oldest;
 *   - the fork, a curve from the bottom of a lane back into the lane it
 *     branched from, under the project's own row, where it started.
 *
 * Lines stop short of each mark, the way the tenure rail does, so a mark is
 * a node on the line rather than something the line runs through.
 */

import { useEffect, useState, type RefObject } from "react";
import type { GraphLane } from "@/lib/log-graph";
import { cn } from "@/lib/utils";

/** A printed row, in page order: its index in the chapter, its hash (the
 *  row's element id) and the column its mark sits in. */
export interface GraphRow {
  index: number;
  hash: string;
  col: number;
}

interface Mark {
  index: number;
  col: number;
  x: number;
  y: number;
  /** Distance from the centre to where a line should stop. */
  gap: number;
}

interface Path {
  d: string;
  /** The project a lane belongs to; absent for the main line. */
  lane?: string;
}

/** Where a lane's name goes: just above and left of its newest mark. */
interface Label {
  lane: string;
  x: number;
  y: number;
}

export function GraphLanes({
  containerRef,
  rows,
  lanes,
  names,
  activeLane,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  rows: readonly GraphRow[];
  lanes: readonly GraphLane[];
  /** Each lane's project, by name, printed at the lane's top. */
  names: ReadonlyMap<string, string>;
  /** The lane being hovered, drawn a rung brighter. */
  activeLane?: string | null;
}) {
  const [paths, setPaths] = useState<Path[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);

  // A passive effect, not a layout one: this sits inside the container it
  // measures, and a child's layout effect runs before its parent's ref is
  // attached, so the container would not exist yet.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const box = container.getBoundingClientRect();
      const marks: Mark[] = [];
      for (const row of rows) {
        const dot = container.querySelector<HTMLElement>(
          `[id="${row.hash}"] [data-graph-dot]`,
        );
        if (!dot) continue;
        const r = dot.getBoundingClientRect();
        marks.push({
          index: row.index,
          col: row.col,
          x: r.left + r.width / 2 - box.left,
          y: r.top + r.height / 2 - box.top,
          // An icon is 12px; a quiet row's dot is 3px.
          gap: dot.querySelector("svg") ? 8 : 4,
        });
      }

      const through = (list: Mark[]) => {
        let d = "";
        for (let k = 0; k + 1 < list.length; k++) {
          const a = list[k];
          const b = list[k + 1];
          const y1 = a.y + a.gap;
          const y2 = b.y - b.gap;
          if (y2 > y1) d += `M${a.x} ${y1}V${y2}`;
        }
        return d;
      };

      const next: Path[] = [];
      const nextLabels: Label[] = [];
      const main = marks.filter((m) => m.col === 0);
      if (main.length > 1) next.push({ d: through(main) });

      const xOf = new Map<number, number>();
      if (main[0]) xOf.set(0, main[0].x);
      // Lanes come parents first (lib/log-graph.ts), so the lane a fork
      // returns to has already been measured.
      for (const lane of lanes) {
        const own = marks.filter(
          (m) =>
            m.col === lane.col && m.index >= lane.top && m.index <= lane.bottom,
        );
        if (own.length === 0) continue;
        xOf.set(lane.col, own[0].x);
        nextLabels.push({ lane: lane.id, x: own[0].x, y: own[0].y - own[0].gap });
        let d = through(own);

        const bottom = own[own.length - 1];
        const toX = xOf.get(lane.from);
        if (toX !== undefined) {
          // Down and back into the lane it came from, within the space
          // under this row, so the fork reads as this row's.
          const below = marks.find((m) => m.index > lane.bottom);
          const room = below ? below.y - bottom.y : 28;
          const y1 = bottom.y + bottom.gap;
          const y2 = bottom.y + Math.max(bottom.gap + 6, Math.min(24, room - 6));
          d += `M${bottom.x} ${y1}C${bottom.x} ${y2} ${toX} ${y1} ${toX} ${y2}`;
        }
        next.push({ d, lane: lane.id });
      }
      setPaths(next);
      setLabels(nextLabels);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [containerRef, rows, lanes]);

  if (paths.length === 0) return null;
  return (
    <>
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      fill="none"
    >
      {paths.map((p, k) => (
        <path
          key={p.lane ?? `main-${k}`}
          d={p.d}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className={cn(
            "transition-[stroke] duration-200",
            !p.lane
              ? "stroke-muted-foreground/20"
              : activeLane === p.lane
                ? "stroke-muted-foreground/80"
                : "stroke-muted-foreground/40",
          )}
        />
      ))}
    </svg>
    {/* A lane's name, where the lane begins at the top, the way git
        decorates the tip of a branch. Only where the gutter hangs in the
        page margin (`lg`): below that the name would sit on the text. */}
    {labels.map((l) => (
      <span
        key={l.lane}
        aria-hidden
        className={cn(
          "pointer-events-none absolute hidden lg:block whitespace-nowrap",
          "-translate-x-full -translate-y-full pr-1.5 pb-0.5",
          "font-mono text-[10px] leading-none transition-colors duration-200",
          activeLane === l.lane
            ? "text-muted-foreground"
            : "text-quaternary-foreground",
        )}
        style={{ left: l.x, top: l.y }}
      >
        {names.get(l.lane)}
      </span>
    ))}
    </>
  );
}
