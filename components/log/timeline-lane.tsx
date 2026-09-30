/**
 * The side lane — a second rail beside the trunk, where two chapters overlap.
 *
 * The rail through the icon column is the trunk, and a chapter marker is the
 * ref where a branch starts. When a chapter begins while the one above it is
 * still running (PL starts while React goes on), the trunk goes on as the new
 * chapter and the older one steps aside: it bends out of the trunk at the new
 * chapter's marker, runs down a lane of its own beside it, reaches in to each
 * commit it shares, and turns into the trunk at its last commit.
 *
 *   │        React
 *   ╰╮ ○ PL  the older chapter steps aside; the new one starts on the trunk
 *    │ ●     a commit on the trunk only
 *    ├─●     a commit on both
 *    ╰─●     the older chapter's last commit
 *      ●
 *
 * Every piece is drawn in the icon cell (`data-rail-icon`) the way the rail
 * itself is: lines run ±1000px and the row's clip-path trims them to the
 * row, so a lane stays continuous across rows of any height, and it is the
 * rail's own ink. The lane hangs in the gap between the hash and the icon.
 */

import { cn } from "@/lib/utils";

/** How far left of the trunk the lane runs, px. */
const LANE = 14;
/** Radius of the lane's turns, px. */
const TURN = 5;

const INK = "pointer-events-none absolute w-px bg-muted-foreground/10";
const STROKE = "stroke-muted-foreground/10";

/** What one row draws of the lanes, besides its own rail. */
export interface LaneMark {
  /** The side lane at this row: passing by, reaching in to the row's node
   *  (the commit is on both chapters), or ending in it. */
  side?: "through" | "touch" | "join";
  /** Carry the trunk from the node up / down to the row's edge where the
   *  row's own rail doesn't — the stretch that meets a branch marker. */
  trunkAbove?: boolean;
  trunkBelow?: boolean;
}

/** A row's lanes, inside its icon cell. `gap` is how far the rail stops
 *  short of the node (the row's own `iconGapPx`). */
export function LaneInCell({ mark, gap }: { mark: LaneMark; gap: number }) {
  const lane = `calc(50% - ${LANE}px)`;
  return (
    <>
      {mark.trunkAbove && (
        <span
          aria-hidden
          className={cn(INK, "left-1/2 -translate-x-1/2")}
          style={{ top: "-1000px", bottom: `calc(50% + ${gap}px)` }}
        />
      )}
      {mark.trunkBelow && (
        <span
          aria-hidden
          className={cn(INK, "left-1/2 -translate-x-1/2")}
          style={{ top: `calc(50% + ${gap}px)`, bottom: "-1000px" }}
        />
      )}
      {mark.side === "through" || mark.side === "touch" ? (
        <span
          aria-hidden
          className={INK}
          style={{ left: lane, top: "-1000px", bottom: "-1000px" }}
        />
      ) : null}
      {mark.side === "touch" && (
        <span
          aria-hidden
          className="pointer-events-none absolute h-px bg-muted-foreground/10"
          style={{ left: lane, top: "50%", width: LANE - gap }}
        />
      )}
      {mark.side === "join" && (
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
 * A branch marker's rail cell: the chapter above bends out of the trunk into
 * the side lane, and the new chapter starts on the trunk at a ring — the ref
 * its marker names. `steps` is false when nothing of the chapter above runs
 * past this marker; then the trunk just passes through.
 */
export function BranchInCell({ steps }: { steps: boolean }) {
  const lane = `calc(50% - ${LANE}px)`;
  // The bend: from the trunk well above the ring to the lane just above
  // the ring's centre, so the two never touch.
  const top = 22;
  const bottom = 4;
  const h = top - bottom;
  return (
    <>
      <span
        aria-hidden
        className={cn(INK, "left-1/2 -translate-x-1/2")}
        style={{
          top: "-1000px",
          bottom: steps ? `calc(50% + ${top}px)` : "calc(50% + 4px)",
        }}
      />
      {steps && (
        <>
          <svg
            aria-hidden
            className="pointer-events-none absolute overflow-visible"
            style={{ left: lane, top: `calc(50% - ${top}px)` }}
            width={LANE + 1}
            height={h}
          >
            <path
              d={`M ${LANE} 0 C ${LANE} ${h / 2} 0.5 ${h / 2} 0.5 ${h}`}
              fill="none"
              strokeWidth={1}
              className={STROKE}
            />
          </svg>
          <span
            aria-hidden
            className={INK}
            style={{ left: lane, top: `calc(50% - ${bottom}px)`, bottom: "-1000px" }}
          />
        </>
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-muted-foreground/30"
      />
      <span
        aria-hidden
        className={cn(INK, "left-1/2 -translate-x-1/2")}
        style={{ top: "calc(50% + 4px)", bottom: "-1000px" }}
      />
    </>
  );
}
