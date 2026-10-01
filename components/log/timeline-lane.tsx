/**
 * The graph in the icon column — the trunk, and a side lane where two
 * chapters overlap.
 *
 * The line through the icon column is the trunk: one chapter's history,
 * from its ref (the chapter marker) to its last commit, drawn once, in one
 * ink. When a chapter's ref lands while the chapter on the trunk is still
 * running (PL starts while React goes on), the new chapter takes the trunk
 * and the running one steps aside into a lane beside it:
 *
 *   │   ● React without memo
 *   ╰╮ (PL)                 the running chapter steps aside at the ref
 *    ├─● Forget             on both: the lane reaches in to the node
 *    ● │ Hermes             on the side chapter only: the node moves to it
 *    │ ● WasmCert           on the trunk only
 *    ╰─● ReasonML           the side chapter's last commit
 *      ● M.S.
 *
 * Everything is drawn in the row's icon cell (`data-rail-icon`) the way the
 * rail always was — lines run ±1000px and the row's clip-path trims them to
 * the row — so each stretch of line exists exactly once and nothing stacks:
 * translucent ink laid twice reads as a second, darker line. The lane hangs
 * in the gap between the hash and the icon.
 */

import { cn } from "@/lib/utils";

/** How far left of the trunk the side lane runs, px. */
export const LANE = 14;
/** How far a row whose node sits on the side lane nudges its hash left, so
 *  the node has room beside it, px. Visual only — the grid does not move. */
export const HASH_NUDGE = 8;
/** Radius of the lanes' turns, px. */
const TURN = 5;

const INK = "pointer-events-none absolute w-px bg-muted-foreground/10";
const STROKE = "stroke-muted-foreground/10";

/** What one commit row draws of the graph. */
export interface RowGraph {
  /** The trunk runs up to this row's top edge / down to its bottom edge. */
  trunkAbove: boolean;
  trunkBelow: boolean;
  /** The side lane at this row: passing by, reaching in to the node on the
   *  trunk (the commit is on both chapters), ending in it, or carrying the
   *  node itself (the commit is on the side chapter only). */
  side?: "pass" | "touch" | "join" | "node";
  /** `node`: whether the side lane goes on above / below the node. */
  sideAbove?: boolean;
  sideBelow?: boolean;
}

/** A row's graph, inside its icon cell. `gap` is how far a line stops short
 *  of the node; `cluster` hooks the trunk into the tenure highlight. */
export function GraphInCell({
  graph,
  gap,
  cluster,
}: {
  graph: RowGraph;
  gap: number;
  cluster: { above: boolean; below: boolean };
}) {
  const lane = `calc(50% - ${LANE}px)`;
  const onSide = graph.side === "node";
  // A node on the side lane leaves the trunk nothing to stop for.
  const trunkGap = onSide ? 0 : gap;
  return (
    <>
      {graph.trunkAbove && (
        <span
          aria-hidden
          data-rail-above={cluster.above && !onSide ? "" : undefined}
          className={cn(INK, "left-1/2 -translate-x-1/2 transition-colors duration-200")}
          style={{ top: "-1000px", bottom: `calc(50% + ${trunkGap}px)` }}
        />
      )}
      {graph.trunkBelow && (
        <span
          aria-hidden
          data-rail-below={cluster.below && !onSide ? "" : undefined}
          className={cn(INK, "left-1/2 -translate-x-1/2 transition-colors duration-200")}
          style={{ top: `calc(50% + ${trunkGap}px)`, bottom: "-1000px" }}
        />
      )}
      {(graph.side === "pass" || graph.side === "touch") && (
        <span
          aria-hidden
          className={INK}
          style={{ left: lane, top: "-1000px", bottom: "-1000px" }}
        />
      )}
      {graph.side === "touch" && (
        <span
          aria-hidden
          className="pointer-events-none absolute h-px bg-muted-foreground/10"
          style={{ left: lane, top: "50%", width: LANE - gap }}
        />
      )}
      {onSide && graph.sideAbove && (
        <span
          aria-hidden
          className={INK}
          style={{ left: lane, top: "-1000px", bottom: `calc(50% + ${gap}px)` }}
        />
      )}
      {onSide && graph.sideBelow && (
        <span
          aria-hidden
          className={INK}
          style={{ left: lane, top: `calc(50% + ${gap}px)`, bottom: "-1000px" }}
        />
      )}
      {graph.side === "join" && (
        <>
          <span
            aria-hidden
            className={INK}
            style={{ left: lane, top: "-1000px", bottom: `calc(50% + ${TURN}px)` }}
          />
          <svg
            aria-hidden
            className="pointer-events-none absolute overflow-visible"
            style={{ left: lane, top: `calc(50% - ${TURN}px)` }}
            width={LANE - gap}
            height={TURN}
          >
            <path
              d={`M 0.5 0 Q 0.5 ${TURN + 0.5} ${TURN} ${TURN + 0.5} H ${LANE - gap}`}
              fill="none"
              strokeWidth={1}
              className={STROKE}
            />
          </svg>
        </>
      )}
    </>
  );
}

/**
 * A chapter's ref on the graph: the trunk starts at its marker. From `lg`
 * up the marker sits right of the gutter, and the trunk reaches out to it
 * with a short turn; below `lg` the marker sits over the trunk and the line
 * comes out from under it.
 *
 * `stepAside`: the chapter on the trunk above is still running — it comes
 * down, bends into the side lane above the marker, and goes on there.
 * `y` is the marker's centre from the top of the cell, px.
 */
export function RefInCell({
  y,
  stepAside = false,
  first = false,
}: {
  y: number;
  stepAside?: boolean;
  /** The block's own header: nothing above to continue. */
  first?: boolean;
}) {
  const lane = `calc(50% - ${LANE}px)`;
  // The step aside: from the trunk to the lane, clear of the marker.
  const bendTop = y - 30;
  const bendH = 16;
  // From `lg` the marker's left edge is this far right of the trunk: the
  // gutter's half-icon and its gap (see GUTTER_PULL).
  const reach = 18;
  return (
    <>
      {stepAside && (
        <>
          <span
            aria-hidden
            className={cn(INK, "left-1/2 -translate-x-1/2")}
            style={{ top: "-1000px", height: 1000 + bendTop }}
          />
          <svg
            aria-hidden
            className="pointer-events-none absolute overflow-visible"
            style={{ left: lane, top: bendTop }}
            width={LANE + 1}
            height={bendH}
          >
            <path
              d={`M ${LANE} 0 C ${LANE} ${bendH / 2} 0.5 ${bendH / 2} 0.5 ${bendH}`}
              fill="none"
              strokeWidth={1}
              className={STROKE}
            />
          </svg>
          <span
            aria-hidden
            className={INK}
            style={{ left: lane, top: bendTop + bendH, bottom: "-1000px" }}
          />
        </>
      )}
      {/* A chapter that ended just above hands the trunk straight on. */}
      {!stepAside && !first && (
        <span
          aria-hidden
          className={cn(INK, "left-1/2 -translate-x-1/2")}
          style={{ top: "-1000px", height: 1000 + y }}
        />
      )}
      {/* The trunk starts at the marker: out from under it below `lg`… */}
      <span
        aria-hidden
        className={cn(INK, "left-1/2 -translate-x-1/2 lg:hidden")}
        style={{ top: y, bottom: "-1000px" }}
      />
      {/* …and from `lg`, out to its left edge and down. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute overflow-visible hidden lg:block"
        style={{ left: "calc(50% - 0.5px)", top: y - 0.5 }}
        width={reach}
        height={TURN + 1}
      >
        <path
          d={`M ${reach} 0.5 H ${TURN + 0.5} Q 0.5 0.5 0.5 ${TURN + 0.5}`}
          fill="none"
          strokeWidth={1}
          className={STROKE}
        />
      </svg>
      <span
        aria-hidden
        className={cn(INK, "left-1/2 -translate-x-1/2 hidden lg:block")}
        style={{ top: y + TURN, bottom: "-1000px" }}
      />
    </>
  );
}
