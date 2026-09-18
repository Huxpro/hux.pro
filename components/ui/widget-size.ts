// =============================================================================
// Widget sizes — the home board's size families and the geometry behind them.
//
// The board is a grid of square cells (see `widget-board.tsx` and
// `.widget-board` in globals.css), and a widget occupies a *footprint* of
// cells declared by its size family, the way WidgetKit declares
// `systemSmall` / `Medium` / `Large` / `ExtraLarge`:
//
//   small    1 × 1   a square
//   medium   2 × 1   twice as wide — today's card width
//   large    2 × 2   a square again, at twice the scale
//   xl       4 × 2   two mediums side by side; only on a board wide enough
//
// Sizes are declared, not continuous: a widget supports a few of them (some
// exactly one) and carries a different design for each. The visitor picks
// among the ones it supports; the board decides what fits.
//
// This module is pure — no React, no DOM — so the placement it describes can
// be checked in isolation and mirrored exactly by CSS. The board relies on
// that mirror: `placeInFlow` is the CSS Grid dense auto-placement algorithm
// written out, and the grid itself uses `grid-auto-flow: row dense`, so the
// two agree cell for cell without the board ever positioning anything.
// =============================================================================

export type WidgetSize = "small" | "medium" | "large" | "xl";

export interface Footprint {
  /** Cells across. */
  w: number;
  /** Cells down. */
  h: number;
}

export const WIDGET_SIZES: readonly WidgetSize[] = [
  "small",
  "medium",
  "large",
  "xl",
];

export const FOOTPRINT: Record<WidgetSize, Footprint> = {
  small: { w: 1, h: 1 },
  medium: { w: 2, h: 1 },
  large: { w: 2, h: 2 },
  xl: { w: 4, h: 2 },
};

/** Cells a size occupies — what "how full is the board" is measured in. */
export function cellArea(size: WidgetSize): number {
  const f = FOOTPRINT[size];
  return f.w * f.h;
}

/**
 * The size a widget actually renders at on a board `cols` cells wide: the
 * chosen one when it fits, otherwise the largest supported size that does.
 * A phone is two cells across, so an `xl` chosen on a desktop is shown as
 * the widget's `large` (or `medium`) there — the way iPadOS-only families
 * simply do not exist on an iPhone. `supported` is in ascending order.
 */
export function fitSize(
  chosen: WidgetSize,
  supported: readonly WidgetSize[],
  cols: number,
): WidgetSize {
  if (FOOTPRINT[chosen].w <= cols) return chosen;
  for (let i = supported.length - 1; i >= 0; i--) {
    if (FOOTPRINT[supported[i]].w <= cols) return supported[i];
  }
  return supported[0] ?? chosen;
}

/** The sizes a widget can be switched to on a board `cols` wide. */
export function offeredSizes(
  supported: readonly WidgetSize[],
  cols: number,
): WidgetSize[] {
  return supported.filter((s) => FOOTPRINT[s].w <= cols);
}

/** The next size after `current` in `offered`, wrapping — what a tap on the grip does. */
export function nextSize(
  current: WidgetSize,
  offered: readonly WidgetSize[],
): WidgetSize {
  const i = offered.indexOf(current);
  if (i === -1 || offered.length < 2) return current;
  return offered[(i + 1) % offered.length];
}

/** Sort sizes small → xl regardless of how a widget listed them. */
export function sortSizes(sizes: readonly WidgetSize[]): WidgetSize[] {
  return WIDGET_SIZES.filter((s) => sizes.includes(s));
}

export function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === "string" && (WIDGET_SIZES as string[]).includes(value);
}

// =============================================================================
// Placement
// =============================================================================

export interface FlowItem {
  id: string;
  size: WidgetSize;
}

export interface Placed extends Footprint {
  id: string;
  /** Zero-based column of the top-left cell. */
  col: number;
  /** Zero-based row of the top-left cell. */
  row: number;
}

/**
 * Lay items out in order on a board `cols` wide, the way CSS Grid's
 * `grid-auto-flow: row dense` does: every item goes into the first spot,
 * scanning row by row from the top-left, where its whole footprint fits. So
 * a widget that cannot finish its row starts the next one, and a smaller
 * widget later in the order slides up into the gap that leaves behind — the
 * board never holds a hole a later widget could fill.
 *
 * Mirrors the CSS exactly on purpose: this is how the board knows, without
 * measuring anything, which widget sits under a cell.
 */
export function placeInFlow(items: readonly FlowItem[], cols: number): Placed[] {
  const width = Math.max(1, cols);
  const taken: boolean[][] = [];
  const isFree = (col: number, row: number, w: number, h: number) => {
    for (let r = row; r < row + h; r++) {
      const line = taken[r];
      if (!line) continue;
      for (let c = col; c < col + w; c++) if (line[c]) return false;
    }
    return true;
  };
  const take = (col: number, row: number, w: number, h: number) => {
    for (let r = row; r < row + h; r++) {
      taken[r] ??= [];
      for (let c = col; c < col + w; c++) taken[r][c] = true;
    }
  };

  const placed: Placed[] = [];
  for (const item of items) {
    const f = FOOTPRINT[item.size];
    const w = Math.min(f.w, width);
    const h = f.h;
    let row = 0;
    let col = 0;
    for (;;) {
      if (col + w > width) {
        col = 0;
        row++;
        continue;
      }
      if (isFree(col, row, w, h)) break;
      col++;
    }
    take(col, row, w, h);
    placed.push({ id: item.id, col, row, w, h });
  }
  return placed;
}

/** Rows the placed board spans. */
export function boardRows(placed: readonly Placed[]): number {
  let rows = 0;
  for (const p of placed) rows = Math.max(rows, p.row + p.h);
  return rows;
}

function intersects(a: Footprint & { col: number; row: number }, b: Placed) {
  return (
    a.col < b.col + b.w &&
    a.col + a.w > b.col &&
    a.row < b.row + b.h &&
    a.row + a.h > b.row
  );
}

/**
 * Where a lifted widget goes when its footprint is held over `target`
 * (top-left cell + size), among the *other* widgets laid out without it:
 *
 *   - over a widget → it takes that widget's place in the order, and that
 *     widget and everything after it flows on behind;
 *   - over empty cells → it goes after the last widget that reads before
 *     that spot, i.e. exactly where the eye expects the sequence to continue.
 *
 * `rest` is the order without the lifted widget; the answer is an index into
 * it. Resolving against the rest layout rather than the live one is what
 * keeps the preview steady: the answer depends only on where the hand is,
 * never on where the last answer moved things to.
 */
export function resolveDropIndex(
  rest: readonly Placed[],
  target: Footprint & { col: number; row: number },
): number {
  for (let i = 0; i < rest.length; i++) {
    if (intersects(target, rest[i])) return i;
  }
  let after = -1;
  for (let i = 0; i < rest.length; i++) {
    const p = rest[i];
    const before =
      p.row < target.row || (p.row === target.row && p.col < target.col);
    if (before) after = i;
  }
  return after + 1;
}

/**
 * Snap a point (in cell units, fractional) to the top-left cell of a
 * footprint that stays on the board.
 */
export function snapToCell(
  x: number,
  y: number,
  footprint: Footprint,
  cols: number,
): { col: number; row: number } {
  const w = Math.min(footprint.w, cols);
  return {
    col: Math.max(0, Math.min(cols - w, Math.round(x))),
    row: Math.max(0, Math.round(y)),
  };
}

/**
 * Which of `offered` a resize grip dragged to (`w`, `h` cells, fractional,
 * measured from the widget's top-left) is asking for: the size whose
 * footprint is nearest, the current one winning ties so a small wobble
 * changes nothing.
 */
export function resolveResize(
  w: number,
  h: number,
  current: WidgetSize,
  offered: readonly WidgetSize[],
): WidgetSize {
  let best = current;
  let bestDist = Infinity;
  for (const size of offered) {
    const f = FOOTPRINT[size];
    const dist = Math.abs(f.w - w) + Math.abs(f.h - h);
    if (dist < bestDist || (dist === bestDist && size === current)) {
      best = size;
      bestDist = dist;
    }
  }
  return best;
}
