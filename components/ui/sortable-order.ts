// =============================================================================
// Sortable order persistence — shared by every draggable home-screen surface
// (the widget masonry and the app shelf). An order is an array of item IDs in
// localStorage, so each visitor keeps their own layout.
// =============================================================================

// Mouse / trackpad: start dragging once the pointer travels 8px while pressed.
// A plain click (no travel) still navigates links.
export const MOUSE_ACTIVATION = { distance: 8 };

// Touch: a plain swipe scrolls the page; only a 200ms long-press picks an item
// up. `tolerance` lets the finger drift a little during the hold without
// cancelling (and a larger drift before the hold completes reverts to scroll).
export const TOUCH_ACTIVATION = { delay: 200, tolerance: 8 };

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
