// =============================================================================
// Theater System: trackFling
//
// One pointer-down on the PiP tile, two outcomes: a TAP (released before it
// moved past the slop) or a DRAG that ends in a throw. The throw's velocity
// is what decides where the tile lands (`pipSettle`), so it is measured over
// the last few frames before release rather than over the whole drag: a slow
// drag that ends in a flick is a flick, and a hard drag that stops and is
// then let go is not.
//
// Window listeners rather than pointer capture, like `armPointer` in the
// windows system: the tile moves under the finger, and capture on an element
// that is being re-rendered at a new position is one more thing to go wrong.
// =============================================================================

/** How far a pointer may wander and still be a tap (the windows' TAP_SLOP). */
const TAP_SLOP = 6;
/** The window the release velocity is measured over. */
const VELOCITY_WINDOW_MS = 80;

export interface FlingHandlers {
  /** The press has moved past the slop: it is a drag from here on. */
  onDragStart?: () => void;
  /** Movement since the press, in px. */
  onDrag: (dx: number, dy: number) => void;
  /** Released after a drag: total movement and the release velocity (px/ms). */
  onRelease: (dx: number, dy: number, velocity: { x: number; y: number }) => void;
  /**
   * Released without moving: a tap, with the pointer type that made it and
   * when it was released (the event's own time, so a double-tap is judged by
   * when the finger lifted, not by when a busy main thread got to it).
   */
  onTap?: (pointerType: string, at: number) => void;
}

interface Sample {
  x: number;
  y: number;
  t: number;
}

export function trackFling(
  e: { clientX: number; clientY: number; pointerType: string; timeStamp: number },
  handlers: FlingHandlers,
): void {
  const startX = e.clientX;
  const startY = e.clientY;
  const pointerType = e.pointerType;
  let dragging = false;
  const samples: Sample[] = [{ x: startX, y: startY, t: e.timeStamp }];

  const cleanup = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
  };

  const onMove = (ev: PointerEvent) => {
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!dragging) {
      if (Math.hypot(dx, dy) <= TAP_SLOP) return;
      dragging = true;
      handlers.onDragStart?.();
    }
    samples.push({ x: ev.clientX, y: ev.clientY, t: ev.timeStamp });
    while (samples.length > 2 && ev.timeStamp - samples[0].t > VELOCITY_WINDOW_MS) {
      samples.shift();
    }
    handlers.onDrag(dx, dy);
  };

  const release = (ev: PointerEvent, cancelled: boolean) => {
    cleanup();
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (!dragging) {
      if (!cancelled) handlers.onTap?.(pointerType, ev.timeStamp);
      return;
    }
    const last = samples[samples.length - 1];
    const first = samples[0];
    const span = last.t - first.t;
    // A pointer held still before letting go has no throw left in it.
    const stale = ev.timeStamp - last.t > VELOCITY_WINDOW_MS;
    const velocity =
      stale || span <= 0 || cancelled
        ? { x: 0, y: 0 }
        : { x: (last.x - first.x) / span, y: (last.y - first.y) / span };
    handlers.onRelease(dx, dy, velocity);
  };

  const onUp = (ev: PointerEvent) => release(ev, false);
  const onCancel = (ev: PointerEvent) => release(ev, true);

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
