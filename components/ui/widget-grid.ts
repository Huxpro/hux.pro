// =============================================================================
// Widget grid — the cell model behind the home screen.
//
// The home screen is an Android-shaped launcher grid: a lattice of cells, and
// every widget occupies a *footprint* of whole cells that the visitor can
// change. This module is the pure half of that — no React, no DOM — so the
// grid component, the resize gesture and the docs all reason about the same
// numbers:
//
//   - A cell is one grid column wide (≈330px, the width a widget has always
//     had here) and `CELL_ROW_PX` tall. The row unit is chosen so a 1×1 holds
//     a glanceable widget (weather, now playing, a prompt) and a 1×2 is the
//     near-square a list widget needs. Widths are coarse on purpose: a size is
//     only worth offering when the widget says something different at it, and
//     a finer lattice would multiply sizes without multiplying meaning.
//   - A widget declares a range (`WidgetSizeSpec`), Android's `minResize…` /
//     `maxResize…` / `targetCell…`: the smallest and largest footprint it has a
//     representation for, and the footprint it takes when first placed.
//   - Placement is derived, never stored. The persisted state is the order
//     (an array of ids, unchanged from the masonry) plus each widget's chosen
//     footprint; `packGrid` turns those into cells for a given column count
//     by dense, row-major first fit. Deriving it is what lets one saved layout
//     survive every viewport: a phone packs the same order into one column
//     and clamps every width to it, and nothing the visitor chose is lost.
// =============================================================================

export interface Size {
  /** Width in cells (grid columns). */
  w: number;
  /** Height in cells (rows of `CELL_ROW_PX`). */
  h: number;
}

/** The range a widget supports, plus the footprint it takes when placed. */
export interface WidgetSizeSpec {
  min: Size;
  max: Size;
  default: Size;
}

/** Height of one cell row. See the header comment for why this number. */
export const CELL_ROW_PX = 176;
/** Gutter between cells, both axes (Tailwind `gap-4`). */
export const CELL_GAP_PX = 16;

/** A widget with exactly one size — Android's `resizeMode="none"`. */
export function fixedSize(w: number, h: number): WidgetSizeSpec {
  const s = { w, h };
  return { min: s, max: s, default: s };
}

export function sizeSpec(
  min: [number, number],
  max: [number, number],
  def: [number, number] = min,
): WidgetSizeSpec {
  return {
    min: { w: min[0], h: min[1] },
    max: { w: max[0], h: max[1] },
    default: { w: def[0], h: def[1] },
  };
}

export const DEFAULT_SIZE_SPEC: WidgetSizeSpec = fixedSize(1, 1);

export function sameSize(a: Size, b: Size): boolean {
  return a.w === b.w && a.h === b.h;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/**
 * Bring a size into a widget's range. With `columns` given, the width is also
 * capped by the grid: a 2-wide widget on a one-column phone is 1 wide there,
 * and becomes 2 wide again the moment the grid has two columns.
 */
export function clampSize(
  size: Size,
  spec: WidgetSizeSpec,
  columns?: number,
): Size {
  const maxW = columns ? Math.max(1, Math.min(spec.max.w, columns)) : spec.max.w;
  return {
    w: clampInt(size.w, Math.min(spec.min.w, maxW), maxW),
    h: clampInt(size.h, spec.min.h, spec.max.h),
  };
}

/** True when the widget offers more than one footprint. */
export function isResizable(spec: WidgetSizeSpec): boolean {
  return !sameSize(spec.min, spec.max);
}

// =============================================================================
// Packing
// =============================================================================

export interface Placement extends Size {
  /** Column index, 0-based. */
  x: number;
  /** Row index, 0-based. */
  y: number;
}

export interface GridLayout {
  cells: Map<string, Placement>;
  /** Number of rows the layout occupies. */
  rows: number;
}

/**
 * Dense, row-major first fit — the same rule as CSS `grid-auto-flow: row
 * dense`, spelled out so the pointer math and the SSR placement agree with
 * each other bit for bit.
 *
 * Every widget, in order, goes into the first free spot (scanning rows top to
 * bottom, columns left to right) that fits its whole footprint. Widths are
 * clamped to the column count first. The rule the visitor can rely on: a
 * widget's cell depends only on the widgets *before* it in the order, so
 * moving or resizing one never disturbs anything ahead of it.
 */
export function packGrid(
  order: readonly string[],
  sizeOf: (id: string) => Size,
  columns: number,
): GridLayout {
  const cols = Math.max(1, Math.floor(columns));
  const occupied = new Set<number>();
  const key = (x: number, y: number) => y * cols + x;
  const cells = new Map<string, Placement>();
  let rows = 0;

  for (const id of order) {
    const size = sizeOf(id);
    const w = Math.max(1, Math.min(size.w, cols));
    const h = Math.max(1, size.h);
    let placed = false;
    for (let y = 0; !placed; y++) {
      for (let x = 0; x + w <= cols; x++) {
        let free = true;
        for (let dy = 0; dy < h && free; dy++) {
          for (let dx = 0; dx < w; dx++) {
            if (occupied.has(key(x + dx, y + dy))) {
              free = false;
              break;
            }
          }
        }
        if (!free) continue;
        for (let dy = 0; dy < h; dy++) {
          for (let dx = 0; dx < w; dx++) occupied.add(key(x + dx, y + dy));
        }
        cells.set(id, { x, y, w, h });
        rows = Math.max(rows, y + h);
        placed = true;
        break;
      }
    }
  }
  return { cells, rows };
}

/** The widget whose footprint covers cell (x, y), if any. */
export function widgetAtCell(
  layout: GridLayout,
  x: number,
  y: number,
): string | null {
  for (const [id, p] of layout.cells) {
    if (x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h) return id;
  }
  return null;
}

// =============================================================================
// Pointer geometry
// =============================================================================

export interface CellGeometry {
  /** Grid container's left edge, viewport px. */
  left: number;
  /** Grid container's top edge, viewport px. */
  top: number;
  /** Width of one column, px. */
  colPx: number;
  /** Height of one row, px. */
  rowPx: number;
  gapPx: number;
  columns: number;
}

export function cellGeometry(
  rect: { left: number; top: number; width: number },
  columns: number,
  rowPx = CELL_ROW_PX,
  gapPx = CELL_GAP_PX,
): CellGeometry {
  const cols = Math.max(1, columns);
  return {
    left: rect.left,
    top: rect.top,
    colPx: (rect.width - gapPx * (cols - 1)) / cols,
    rowPx,
    gapPx,
    columns: cols,
  };
}

/** Pixel size of a footprint (gutters between its cells included). */
export function footprintPx(size: Size, geo: CellGeometry): { w: number; h: number } {
  return {
    w: size.w * geo.colPx + (size.w - 1) * geo.gapPx,
    h: size.h * geo.rowPx + (size.h - 1) * geo.gapPx,
  };
}

/** The footprint a stretched box snaps to: nearest whole cells. */
export function snapPxToCells(
  px: { w: number; h: number },
  geo: CellGeometry,
): Size {
  return {
    w: Math.round((px.w + geo.gapPx) / (geo.colPx + geo.gapPx)),
    h: Math.round((px.h + geo.gapPx) / (geo.rowPx + geo.gapPx)),
  };
}

/**
 * Where a lifted widget lands if released at (px, py), as an index into
 * `order` — which must NOT contain the lifted widget itself.
 *
 * The rule is the one the visitor sees: the widget goes where the pointer is.
 * Over another widget, it takes that widget's place (the pointer in its
 * leading half) or the spot right after it (trailing half); in a
 * single-column grid "leading" is the top half, otherwise the left half. Over
 * an empty cell it goes after the last widget that starts before that cell in
 * reading order, and past the bottom it goes last.
 *
 * Pure in (pointer, order-without-active): a still pointer always yields the
 * same answer, so live reordering can't oscillate.
 */
export function landingIndex(
  order: readonly string[],
  layout: GridLayout,
  geo: CellGeometry,
  px: number,
  py: number,
): number {
  if (order.length === 0) return 0;
  const stride = { x: geo.colPx + geo.gapPx, y: geo.rowPx + geo.gapPx };
  const relX = px - geo.left;
  const relY = py - geo.top;
  if (relY < 0) return 0;
  const cx = Math.max(0, Math.min(geo.columns - 1, Math.floor(relX / stride.x)));
  const cy = Math.floor(relY / stride.y);
  if (cy >= layout.rows) return order.length;

  const hit = widgetAtCell(layout, cx, cy);
  if (hit) {
    const p = layout.cells.get(hit)!;
    const index = order.indexOf(hit);
    const leading =
      geo.columns === 1
        ? relY < p.y * stride.y + (p.h * geo.rowPx + (p.h - 1) * geo.gapPx) / 2
        : relX < p.x * stride.x + (p.w * geo.colPx + (p.w - 1) * geo.gapPx) / 2;
    return leading ? index : index + 1;
  }

  // An empty cell: after the last widget that starts before it, reading order.
  let index = 0;
  order.forEach((id, i) => {
    const p = layout.cells.get(id);
    if (p && (p.y < cy || (p.y === cy && p.x < cx))) index = i + 1;
  });
  return index;
}

// =============================================================================
// Persistence — `{ [id]: [w, h] }` beside the order array.
// =============================================================================

export type StoredSizes = Record<string, Size>;

export function loadSizes(key: string): StoredSizes | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const out: StoredSizes = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (
        Array.isArray(v) &&
        v.length === 2 &&
        Number.isFinite(v[0]) &&
        Number.isFinite(v[1])
      ) {
        out[id] = { w: Number(v[0]), h: Number(v[1]) };
      }
    }
    return out;
  } catch {
    return null;
  }
}

export function saveSizes(key: string, sizes: StoredSizes): void {
  if (typeof window === "undefined") return;
  try {
    const raw: Record<string, [number, number]> = {};
    for (const [id, s] of Object.entries(sizes)) raw[id] = [s.w, s.h];
    localStorage.setItem(key, JSON.stringify(raw));
  } catch {
    // ignore
  }
}

export function clearSizes(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Merge stored sizes with the current widget set: every widget gets its
 * stored footprint brought into its (possibly changed) range, or its default.
 * Sizes for widgets that no longer exist are dropped.
 */
export function reconcileSizes(
  stored: StoredSizes | null,
  specs: ReadonlyMap<string, WidgetSizeSpec>,
): StoredSizes {
  const out: StoredSizes = {};
  for (const [id, spec] of specs) {
    const s = stored?.[id];
    out[id] = s ? clampSize(s, spec) : spec.default;
  }
  return out;
}
