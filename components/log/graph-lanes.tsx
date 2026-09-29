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
 *   - each project's lane, from its head (the project, lib/log-graph.ts
 *     `headFirst`) down through the work on it, and on until the lanes
 *     that grew out of it have come back;
 *   - the fork, a curve from the bottom of a lane back into the lane it
 *     grew from: the branch growing up out of its base.
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


export function GraphLanes({
  containerRef,
  rows,
  lanes,
  activeLane,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  rows: readonly GraphRow[];
  lanes: readonly GraphLane[];
  /** The lane being hovered, drawn a rung brighter. */
  activeLane?: string | null;
}) {
  const [paths, setPaths] = useState<Path[]>([]);

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
      const main = marks.filter((m) => m.col === 0);
      if (main.length > 1) next.push({ d: through(main) });

      const mainX = main[0]?.x;
      // Each lane: its marks, where it is drawn, and where it ends. A lane
      // runs on past its last mark until every lane that grew out of it has
      // come back into it, then curves back into the lane it grew from.
      // Children are settled first, so a parent knows where they land.
      const drawn = lanes
        .map((lane) => ({
          lane,
          own: marks.filter(
            (m) =>
              m.col === lane.col && m.index >= lane.top && m.index <= lane.bottom,
          ),
        }))
        .filter((l) => l.own.length > 0);
      const landsOn = new Map<string, number>(); // parent id → lowest landing
      const ends = new Map<string, { end: number; land: number }>();
      for (const { lane, own } of [...drawn].reverse()) {
        const last = own[own.length - 1];
        const end = Math.max(last.y + last.gap, landsOn.get(lane.id) ?? 0);
        // The curve takes the room under the lane's end, short of the next
        // mark down.
        const below = marks.find((m) => m.y - m.gap > end);
        const room = below ? below.y - below.gap - end : 28;
        const land = end + Math.max(6, Math.min(20, room - 2));
        ends.set(lane.id, { end, land });
        if (lane.parent) {
          landsOn.set(lane.parent, Math.max(landsOn.get(lane.parent) ?? 0, land));
        }
      }
      const xOfLane = new Map(drawn.map((l) => [l.lane.id, l.own[0].x]));
      for (const { lane, own } of drawn) {
        const x = own[0].x;
        const last = own[own.length - 1];
        const { end, land } = ends.get(lane.id)!;
        let d = through(own);
        if (end > last.y + last.gap) d += `M${x} ${last.y + last.gap}V${end}`;
        const toX = lane.parent ? xOfLane.get(lane.parent) : mainX;
        if (toX !== undefined) {
          d += `M${x} ${end}C${x} ${land} ${toX} ${end} ${toX} ${land}`;
        }
        next.push({ d, lane: lane.id });
      }
      setPaths(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [containerRef, rows, lanes]);

  if (paths.length === 0) return null;
  return (
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
  );
}
