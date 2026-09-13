// =============================================================================
// Sortable order persistence — shared by every draggable home-screen surface
// (the widget masonry and the app shelf). An order is an array of item IDs in
// localStorage, so each visitor keeps their own layout.
// =============================================================================

// Mouse / trackpad: start dragging once the pointer travels 8px while pressed.
// A plain click (no travel) still navigates links.
export const MOUSE_ACTIVATION = { distance: 8 };

// Touch: a plain swipe scrolls the page; only a long-press picks an item up.
// 400ms sits between a tap and iOS's own ~500ms home-screen hold — long enough
// that a slow tap or the start of a scroll never lifts anything, short enough
// to still feel like a response to the press. The held item grows for the
// whole delay (see `usePressHold`) so the pickup is foreshadowed rather than
// sudden. `tolerance` lets the finger drift a little during the hold without
// cancelling; a larger drift before the hold completes reverts to scroll.
export const TOUCH_ACTIVATION = { delay: 400, tolerance: 10 };

/**
 * Wrap dnd-kit's press activators (`onMouseDown`, `onTouchStart`) so a press
 * the caller wants to keep for itself never reaches the sensor. `intercept`
 * runs first with the event; return true to swallow the press. Pointer-down
 * is left alone: both sortable surfaces re-wire it inline, because the
 * press-and-hold grow has to see the same event.
 */
export function guardActivators<L extends Record<string, unknown> | undefined>(
  listeners: L,
  intercept: (event: React.SyntheticEvent) => boolean,
): L {
  if (!listeners) return listeners;
  const guarded = { ...listeners } as Record<string, unknown>;
  for (const key of ["onMouseDown", "onTouchStart"]) {
    const original = guarded[key];
    if (typeof original !== "function") continue;
    guarded[key] = (event: React.SyntheticEvent) => {
      if (intercept(event)) return;
      original(event);
    };
  }
  return guarded as L;
}

export function loadOrder(key: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((v) => typeof v === "string");
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveOrder(key: string, order: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // ignore
  }
}

export function clearOrder(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Merge a stored order with the current set of item IDs: keep the stored
 * order for IDs that still exist, drop ones that vanished, and append any new
 * items at the end. Keeps a saved layout stable as items come and go.
 */
export function reconcile(stored: string[], all: string[]): string[] {
  const allSet = new Set(all);
  const kept = stored.filter((id) => allSet.has(id));
  const keptSet = new Set(kept);
  const added = all.filter((id) => !keptSet.has(id));
  return [...kept, ...added];
}

// =============================================================================
// Column layouts — for surfaces (the widget masonry) where the visitor places
// items into a *specific* column rather than into one flat sequence. A layout
// is `string[][]`: one array of item IDs per column, top to bottom.
//
// Layouts are stored per column count (1 / 2 / 3), because the same placement
// cannot mean the same thing at every width: what the visitor arranged on a
// wide screen should survive a trip through a narrow one.
// =============================================================================

export type ColumnLayout = string[][];

interface StoredLayout {
  v: 2;
  /** Column layouts keyed by column count, e.g. `{ "3": [[...], [...], [...]] }`. */
  cols: Record<string, ColumnLayout>;
}

function isIdArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Read the stored layouts. Also understands the legacy v1 payload (a flat
 * array of IDs) and hands it back as `flat`, so a visitor who arranged the
 * grid before columns were placeable keeps their sequence.
 */
export function loadLayouts(key: string): {
  byCount: Record<number, ColumnLayout>;
  flat: string[] | null;
} {
  const empty = { byCount: {} as Record<number, ColumnLayout>, flat: null };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    if (isIdArray(parsed)) return { byCount: {}, flat: parsed };
    if (parsed && typeof parsed === "object" && (parsed as StoredLayout).v === 2) {
      const cols = (parsed as StoredLayout).cols ?? {};
      const byCount: Record<number, ColumnLayout> = {};
      for (const [count, layout] of Object.entries(cols)) {
        const n = Number(count);
        if (!Number.isInteger(n) || n < 1) continue;
        if (Array.isArray(layout) && layout.every(isIdArray)) byCount[n] = layout;
      }
      return { byCount, flat: null };
    }
  } catch {
    // ignore
  }
  return empty;
}

export function saveLayouts(
  key: string,
  byCount: Record<number, ColumnLayout>,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredLayout = { v: 2, cols: {} };
    for (const [count, layout] of Object.entries(byCount)) {
      payload.cols[count] = layout;
    }
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

/** Column-major read-out: column 1 top-to-bottom, then column 2, and so on. */
export function flattenColumns(layout: ColumnLayout): string[] {
  return layout.flat();
}

/**
 * The default placement for a sequence: contiguous, column-major chunks, so
 * the grid still reads down-then-across (the same order CSS multi-column
 * gives) before anyone has moved anything.
 */
export function chunkIntoColumns(ids: string[], count: number): ColumnLayout {
  const cols: ColumnLayout = Array.from({ length: count }, () => []);
  if (count <= 0) return cols;
  const base = Math.floor(ids.length / count);
  const extra = ids.length % count;
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const size = base + (i < extra ? 1 : 0);
    cols[i] = ids.slice(cursor, cursor + size);
    cursor += size;
  }
  return cols;
}

/**
 * Merge a stored layout with the current item set at a given column count:
 * keep placements for IDs that still exist (dropping duplicates), fold any
 * surplus columns into the last one, and drop new items into the column that
 * currently holds the fewest — never silently reflowing what the visitor
 * arranged.
 */
export function reconcileLayout(
  layout: ColumnLayout,
  all: string[],
  count: number,
): ColumnLayout {
  const allSet = new Set(all);
  const seen = new Set<string>();
  const cols: ColumnLayout = Array.from({ length: count }, () => []);

  layout.forEach((col, i) => {
    const target = cols[Math.min(i, count - 1)];
    for (const id of col) {
      if (!allSet.has(id) || seen.has(id)) continue;
      seen.add(id);
      target.push(id);
    }
  });

  for (const id of all) {
    if (seen.has(id)) continue;
    let shortest = 0;
    for (let i = 1; i < count; i++) {
      if (cols[i].length < cols[shortest].length) shortest = i;
    }
    cols[shortest].push(id);
    seen.add(id);
  }

  return cols;
}

/** Structural equality for two layouts (column by column). */
export function layoutsEqual(a: ColumnLayout, b: ColumnLayout): boolean {
  if (a.length !== b.length) return false;
  return a.every((col, i) => col.join("|") === b[i].join("|"));
}
