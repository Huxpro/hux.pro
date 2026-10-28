// =============================================================================
// JSON in localStorage, for Ask's per-viewer conveniences (the history, the
// settings' overrides, the places chosen by hand). Storage can be missing,
// full or blocked (a private window, cleared site data): a read then gives
// the fallback and a write is dropped, and the caller keeps its value for
// the page.
// =============================================================================

export function readJSON(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Unavailable or full: the value lasts the page.
  }
}
