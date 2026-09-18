// =============================================================================
// Widget spans — the Android home-screen model, in TypeScript
//
// A widget occupies a rectangle of cells. The rectangle is a continuum:
// any (w, h) between the widget's min and max, in whole cells. There are no
// size families and no second design per size — the same card reflows into
// the box. Holes are legal. `packFirstFit` is only how a board that has never
// been touched is built; after that the visitor's rectangles are the layout.
//
// The board's CSS is the source of truth for how many columns there are
// (`--board-cols`). These helpers answer the questions the drag system asks
// without measuring a widget.
// =============================================================================

export type CellSpan = {
  col: number;
  row: number;
  w: number;
  h: number;
};

export type WidgetSpec = {
  id: string;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  defaultW: number;
  defaultH: number;
};

/** Fallback for `group-*` and anything not named below. */
const STACK: Omit<WidgetSpec, "id"> = {
  minW: 2,
  minH: 2,
  maxW: 4,
  maxH: 4,
  defaultW: 4,
  defaultH: 3,
};

export const WIDGET_SPECS: Record<string, Omit<WidgetSpec, "id">> = {
  apps: { minW: 2, minH: 2, maxW: 4, maxH: 4, defaultW: 4, defaultH: 2 },
  weather: { minW: 2, minH: 1, maxW: 4, maxH: 2, defaultW: 2, defaultH: 2 },
  music: { minW: 2, minH: 1, maxW: 4, maxH: 2, defaultW: 2, defaultH: 2 },
  blog: { minW: 2, minH: 2, maxW: 4, maxH: 4, defaultW: 4, defaultH: 3 },
  status: { minW: 2, minH: 2, maxW: 4, maxH: 4, defaultW: 4, defaultH: 3 },
  "featured-talks": {
    minW: 2,
    minH: 2,
    maxW: 4,
    maxH: 4,
    defaultW: 4,
    defaultH: 3,
  },
  prompt: { minW: 2, minH: 1, maxW: 4, maxH: 2, defaultW: 4, defaultH: 2 },
};

export function specFor(id: string): WidgetSpec {
  const named = WIDGET_SPECS[id] ?? STACK;
  return { id, ...named };
}

export function overlaps(a: CellSpan, b: CellSpan): boolean {
  return (
    a.col < b.col + b.w &&
    a.col + a.w > b.col &&
    a.row < b.row + b.h &&
    a.row + a.h > b.row
  );
}

export function boardRows(spans: Iterable<CellSpan>): number {
  let max = 0;
  for (const s of spans) max = Math.max(max, s.row + s.h);
  return max;
}

export function clampSpan(
  spec: WidgetSpec,
  span: Pick<CellSpan, "w" | "h">,
  cols: number,
): { w: number; h: number } {
  const maxW = Math.min(spec.maxW, cols);
  const minW = Math.min(spec.minW, maxW);
  return {
    w: Math.max(minW, Math.min(maxW, Math.round(span.w))),
    h: Math.max(spec.minH, Math.min(spec.maxH, Math.round(span.h))),
  };
}

export function canPlace(
  span: CellSpan,
  others: Iterable<CellSpan>,
  cols: number,
): boolean {
  if (span.col < 0 || span.row < 0) return false;
  if (span.w < 1 || span.h < 1) return false;
  if (span.col + span.w > cols) return false;
  for (const other of others) {
    if (overlaps(span, other)) return false;
  }
  return true;
}

/**
 * First-fit, row-major: each widget into the first cell where its whole
 * rectangle fits. Used for the untouched board and for rematching when the
 * column count changes. Not used while the visitor is arranging — holes stay.
 */
export function packFirstFit(
  items: { id: string; w: number; h: number }[],
  cols: number,
): Record<string, CellSpan> {
  const placed: CellSpan[] = [];
  const out: Record<string, CellSpan> = {};
  for (const item of items) {
    const w = Math.max(1, Math.min(item.w, cols));
    const h = Math.max(1, item.h);
    let found: CellSpan | null = null;
    for (let row = 0; !found; row++) {
      for (let col = 0; col <= cols - w; col++) {
        const next = { col, row, w, h };
        if (canPlace(next, placed, cols)) {
          found = next;
          break;
        }
      }
    }
    placed.push(found);
    out[item.id] = found;
  }
  return out;
}

export function defaultLayout(
  ids: string[],
  cols: number,
): Record<string, CellSpan> {
  return packFirstFit(
    ids.map((id) => {
      const spec = specFor(id);
      const size = clampSpan(spec, { w: spec.defaultW, h: spec.defaultH }, cols);
      return { id, ...size };
    }),
    cols,
  );
}

/** Visual order: top-to-bottom, then left-to-right. */
export function visualOrder(
  ids: string[],
  spans: Record<string, CellSpan>,
): string[] {
  return [...ids].sort((a, b) => {
    const sa = spans[a];
    const sb = spans[b];
    if (!sa || !sb) return 0;
    return sa.row - sb.row || sa.col - sb.col;
  });
}

/**
 * Re-pack saved sizes into the current column count, keeping each widget's
 * span and the visitor's visual order. Used when the board grows or shrinks
 * so a 4-wide widget still fits a 4-column phone after a desktop session.
 */
export function rematchLayout(
  ids: string[],
  spans: Record<string, CellSpan>,
  cols: number,
): Record<string, CellSpan> {
  const ordered = visualOrder(ids, spans);
  return packFirstFit(
    ordered.map((id) => {
      const spec = specFor(id);
      const prev = spans[id];
      const size = clampSpan(
        spec,
        prev ?? { w: spec.defaultW, h: spec.defaultH },
        cols,
      );
      return { id, ...size };
    }),
    cols,
  );
}

export type LayoutFile = {
  cols: number;
  spans: Record<string, CellSpan>;
};

const LAYOUT_KEY = "hux_widget_layout";

export function loadLayout(): LayoutFile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LayoutFile;
    if (
      typeof parsed?.cols !== "number" ||
      !parsed.spans ||
      typeof parsed.spans !== "object"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveLayout(file: LayoutFile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(file));
  } catch {
    // ignore
  }
}

export function clearLayout(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAYOUT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Merge stored rectangles with the current widget set. Unknown ids drop;
 * new ids append, packed after the ones we kept.
 */
export function reconcileLayout(
  stored: LayoutFile | null,
  ids: string[],
  cols: number,
): Record<string, CellSpan> {
  if (!stored) return defaultLayout(ids, cols);
  const known = ids.filter((id) => stored.spans[id]);
  const fresh = ids.filter((id) => !stored.spans[id]);
  const base =
    stored.cols === cols
      ? Object.fromEntries(known.map((id) => [id, stored.spans[id]]))
      : rematchLayout(known, stored.spans, cols);
  if (fresh.length === 0) return base;
  const extras = defaultLayout(fresh, cols);
  // Place newcomers after the existing board so they don't land in a hole
  // the visitor left on purpose.
  const originRow = boardRows(Object.values(base));
  const shifted: Record<string, CellSpan> = { ...base };
  for (const id of fresh) {
    const span = extras[id];
    shifted[id] = { ...span, row: span.row + originRow };
  }
  return shifted;
}

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

/** New span from dragging a corner, in cell units (may be fractional). */
export function spanFromCorner(
  start: CellSpan,
  corner: ResizeCorner,
  dCol: number,
  dRow: number,
): CellSpan {
  let { col, row, w, h } = start;
  if (corner.includes("e")) w = start.w + dCol;
  if (corner.includes("s")) h = start.h + dRow;
  if (corner.includes("w")) {
    col = start.col + dCol;
    w = start.w - dCol;
  }
  if (corner.includes("n")) {
    row = start.row + dRow;
    h = start.h - dRow;
  }
  return { col, row, w, h };
}

/**
 * Snap a proposed span onto the board: clamp to the spec, keep it on the
 * grid, and if it overlaps, walk back toward `from` one cell at a time.
 */
export function resolveSpan(
  spec: WidgetSpec,
  proposed: CellSpan,
  others: Iterable<CellSpan>,
  cols: number,
  from: CellSpan,
): CellSpan {
  const size = clampSpan(spec, proposed, cols);
  let col = Math.round(proposed.col);
  let row = Math.round(proposed.row);
  col = Math.max(0, Math.min(cols - size.w, col));
  row = Math.max(0, row);
  const next = { col, row, ...size };
  if (canPlace(next, others, cols)) return next;

  const steps = Math.max(
    Math.abs(next.col - from.col) + Math.abs(next.w - from.w),
    Math.abs(next.row - from.row) + Math.abs(next.h - from.h),
    1,
  );
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const trial = {
      col: Math.round(from.col + (next.col - from.col) * t),
      row: Math.round(from.row + (next.row - from.row) * t),
      w: Math.round(from.w + (next.w - from.w) * t),
      h: Math.round(from.h + (next.h - from.h) * t),
    };
    const clamped = { ...trial, ...clampSpan(spec, trial, cols) };
    clamped.col = Math.max(0, Math.min(cols - clamped.w, clamped.col));
    clamped.row = Math.max(0, clamped.row);
    if (canPlace(clamped, others, cols)) return clamped;
  }
  return from;
}
