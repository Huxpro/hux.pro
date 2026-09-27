// =============================================================================
// Where the sun and the moon are through the sky window, frame by frame — the
// channel from the renderer to the edge hints (<SkyBodyHints />).
//
// Sixty times a second and nothing renders from it in React: the hints move
// their own elements. So it is a bare listener set, like the gravity's and the
// view's, and a null when the window closes.
// =============================================================================

import type { WindowBodies } from "./wallpaper/renderer";

export type { WindowBodies };

type Listener = (bodies: WindowBodies | null) => void;

const listeners = new Set<Listener>();

export function publishWindowBodies(bodies: WindowBodies | null) {
  for (const listener of listeners) listener(bodies);
}

export function subscribeWindowBodies(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
