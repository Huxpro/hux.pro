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
/** Height of a lane moving between the trunk and the side, px. */
const BEND = 16;

/** A line at rest and a line lit, on the ladder's graph roles (globals.css,
 *  "The graph"): the border rung, and the tertiary rung — a chapter's track
 *  under its marker, a connector while one of its ends is pointed at. */
const tone = (lit?: boolean) =>
  cn("transition-colors duration-200", lit ? "bg-graph-lit" : "bg-graph-line");
/** A vertical stretch of line. */
const ink = (lit?: boolean) => cn("pointer-events-none absolute w-px", tone(lit));
const stroke = (lit?: boolean) =>
  cn(
    "transition-colors duration-200",
    lit ? "stroke-graph-lit" : "stroke-graph-line",
  );

/** A lane moving between the trunk and the side lane over `BEND`px: out to
 *  the side (a ref's step aside or fork), or back into the trunk (`enter`). */
function LaneBend({
  top,
  into,
  lit,
}: {
  top: number | string;
  into: "side" | "trunk";
  lit?: boolean;
}) {
  const [from, to] = into === "side" ? [LANE, 0.5] : [0.5, LANE];
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute overflow-visible"
      style={{ left: `calc(50% - ${LANE}px)`, top }}
      width={LANE + 1}
      height={BEND}
    >
      <path
        d={`M ${from} 0 C ${from} ${BEND / 2} ${to} ${BEND / 2} ${to} ${BEND}`}
        fill="none"
        strokeWidth={1}
        className={stroke(lit)}
      />
    </svg>
  );
}

/**
 * Which of a row's lines a lit path runs along. A connector (a commit and
 * the role it hangs from) follows the chapter they share through the graph —
 * the trunk where that chapter holds it, the side lane where it has stepped
 * aside, and `reach` the stroke between the side lane and a node on the
 * trunk. A straight line down the icon column would cross whatever other
 * chapter held the trunk in between.
 */
export interface RowLit {
  trunkAbove?: boolean;
  trunkBelow?: boolean;
  sideAbove?: boolean;
  sideBelow?: boolean;
  reach?: boolean;
}

/** What one commit row draws of the graph. */
export interface RowGraph {
  /** The trunk runs up to this row's top edge / down to its bottom edge. */
  trunkAbove: boolean;
  trunkBelow: boolean;
  /** The side lane at this row: passing by, reaching in to the node on the
   *  trunk (the commit is on both chapters), ending in it, or carrying the
   *  node itself (the commit is on the side chapter only). */
  side?: "pass" | "touch" | "join" | "node";
  /** `node`: whether the side lane goes on below the node (it always
   *  comes down to it). */
  sideBelow?: boolean;
  /** The trunk's chapter ended above: the side lane comes down and turns
   *  into the trunk at this row's node. */
  enter?: boolean;
}

/** A row's graph, inside its icon cell. `gap` is how far a line stops short
 *  of the node. */
export function GraphInCell({
  graph,
  gap,
  lit = {},
}: {
  graph: RowGraph;
  gap: number;
  lit?: RowLit;
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
          className={cn(ink(lit.trunkAbove), "left-1/2 -translate-x-1/2")}
          style={{ top: "-1000px", bottom: `calc(50% + ${trunkGap}px)` }}
        />
      )}
      {graph.trunkBelow && (
        <span
          aria-hidden
          className={cn(ink(lit.trunkBelow), "left-1/2 -translate-x-1/2")}
          style={{ top: `calc(50% + ${trunkGap}px)`, bottom: "-1000px" }}
        />
      )}
      {(graph.side === "pass" || graph.side === "touch") && (
        <>
          {/* In halves, so a path can light the one it runs along. */}
          <span
            aria-hidden
            className={ink(lit.sideAbove)}
            style={{ left: lane, top: "-1000px", bottom: "50%" }}
          />
          <span
            aria-hidden
            className={ink(lit.sideBelow)}
            style={{ left: lane, top: "50%", bottom: "-1000px" }}
          />
        </>
      )}
      {graph.side === "touch" && (
        <span
          aria-hidden
          className={cn("pointer-events-none absolute h-px", tone(lit.reach))}
          style={{ left: lane, top: "50%", width: LANE - gap }}
        />
      )}
      {onSide && (
        <span
          aria-hidden
          className={ink(lit.sideAbove)}
          style={{ left: lane, top: "-1000px", bottom: `calc(50% + ${gap}px)` }}
        />
      )}
      {onSide && graph.sideBelow && (
        <span
          aria-hidden
          className={ink(lit.sideBelow)}
          style={{ left: lane, top: `calc(50% + ${gap}px)`, bottom: "-1000px" }}
        />
      )}
      {graph.enter && (
        <>
          <span
            aria-hidden
            className={ink(lit.sideAbove)}
            style={{
              left: lane,
              top: "-1000px",
              bottom: `calc(50% + ${gap + BEND}px)`,
            }}
          />
          <LaneBend
            top={`calc(50% - ${gap + BEND}px)`}
            into="trunk"
            lit={lit.sideAbove}
          />
        </>
      )}
      {graph.side === "join" && (
        <>
          <span
            aria-hidden
            className={ink(lit.sideAbove)}
            style={{
              left: lane,
              top: "-1000px",
              bottom: `calc(50% + ${TURN}px)`,
            }}
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
              className={stroke(lit.sideAbove || lit.reach)}
            />
          </svg>
        </>
      )}
    </>
  );
}

/** How a chapter's ref meets the trunk (the DevTool's Works › Ref):
 *  `stub` — the marker sits right of the gutter and the trunk turns out to
 *  it; `ring` — a node on the trunk, like a commit's; `under` — the marker
 *  sits on the trunk and the line runs beneath it. */
export type RefLook = "stub" | "ring" | "under";

/**
 * What of a ref a lit path or track runs along: the chapter stepping aside
 * here (`aside`), the trunk running straight through (`through`), or — the
 * ref's own chapter — its trunk starting here (`start`) or its lane forking
 * off here (`fork`).
 */
export type RefLit = "aside" | "through" | "start" | "fork";

/**
 * A chapter's ref on the graph: the trunk starts at its marker, drawn as
 * its `look` has it. `take`: the chapter on the trunk above is still
 * running — it comes down, bends into the side lane above the marker, and
 * goes on there. `fork`: this chapter leaves the trunk for the side lane.
 * `y` is the marker's centre from the top of the cell, px.
 */
export function RefInCell({
  y,
  mode = "plain",
  first = false,
  look = "stub",
  lit,
}: {
  y: number;
  look?: RefLook;
  /** What of this ref a lit path runs along (see `RefLit`). */
  lit?: RefLit;
  /** `plain`: the trunk passes to this chapter. `take`: this chapter takes
   *  the trunk and the running one steps aside. `fork`: the running one
   *  keeps the trunk and this chapter forks off beside it. */
  mode?: "plain" | "take" | "fork";
  /** The block's own header: nothing above to continue. */
  first?: boolean;
}) {
  const lane = `calc(50% - ${LANE}px)`;
  const stepAside = mode === "take";
  // The trunk from the marker down: this chapter's own, or the one running
  // straight through it.
  const startsLit = lit === "start" || lit === "through";
  // The step aside: from the trunk to the lane, clear of the marker.
  const bendTop = y - 30;
  // How far the marker reaches up and down the trunk from its centre.
  const clear = look === "ring" ? 5 : look === "under" ? 11 : 0;
  // From `lg` the marker's left edge is this far right of the trunk: the
  // gutter's half-icon and its gap (see GUTTER_PULL).
  const reach = 18;
  return (
    <>
      {stepAside && (
        <>
          <span
            aria-hidden
            className={cn(ink(lit === "aside"), "left-1/2 -translate-x-1/2")}
            style={{ top: "-1000px", height: 1000 + bendTop }}
          />
          <LaneBend top={bendTop} into="side" lit={lit === "aside"} />
          <span
            aria-hidden
            className={ink(lit === "aside")}
            style={{ left: lane, top: bendTop + BEND, bottom: "-1000px" }}
          />
        </>
      )}
      {/* The fork: the trunk goes straight on, and this chapter leaves it
          just under its marker for the side lane. */}
      {mode === "fork" && (
        <>
          <LaneBend top={y + 8} into="side" lit={lit === "fork"} />
          <span
            aria-hidden
            className={ink(lit === "fork")}
            style={{ left: lane, top: y + 8 + BEND, bottom: "-1000px" }}
          />
        </>
      )}
      {/* A chapter that ended just above hands the trunk straight on. */}
      {!stepAside && !first && (
        <span
          aria-hidden
          className={cn(ink(lit === "through"), "left-1/2 -translate-x-1/2")}
          style={{
            top: "-1000px",
            height: 1000 + y - clear,
          }}
        />
      )}
      {look !== "stub" && (
        <>
          {look === "ring" && (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute left-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border transition-colors duration-200",
                startsLit ? "border-graph-lit" : "border-graph-node",
              )}
              style={{ top: y }}
            />
          )}
          <span
            aria-hidden
            className={cn(ink(startsLit), "left-1/2 -translate-x-1/2")}
            style={{ top: y + clear, bottom: "-1000px" }}
          />
        </>
      )}
      {look === "stub" && (
        <>
          {/* The trunk starts at the marker: out from under it below `lg`… */}
          <span
            aria-hidden
            className={cn(
              ink(startsLit),
              "left-1/2 -translate-x-1/2 lg:hidden",
            )}
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
              className={stroke(startsLit)}
            />
          </svg>
          <span
            aria-hidden
            className={cn(
              ink(startsLit),
              "left-1/2 -translate-x-1/2 hidden lg:block",
            )}
            style={{ top: y + TURN, bottom: "-1000px" }}
          />
        </>
      )}
    </>
  );
}
