// =============================================================================
// armPointer — one pointer-down, three outcomes: tap · long-press · drag
//
// A press on the window chrome (the dots pill, or the top-edge drag band) can
// mean any of three things. We disambiguate the way native controls do:
//   • move past a small threshold  → it's a DRAG (promote to the window gesture)
//   • held still past ~450ms       → it's a LONG-PRESS (open the menu)
//   • quick release, no move       → it's a TAP (open the menu)
// so a tap never jerks the window and a drag never pops the menu.
// =============================================================================

/**
 * How far a finger may wander and still be called a tap. One number for the
 * window's gestures, wherever they are read — the desktop pill arms a pointer
 * with it, and the phone grip, which cannot use `armPointer` at all (see the
 * note at the top of window-grip.tsx), measures its own release against it.
 */
export const TAP_SLOP = 6;

export interface ArmPointerOpts {
  threshold?: number;
  longPressMs?: number;
  /** Promote to a window drag, seeded from the ORIGINAL down point (no jump). */
  onDragStart: (clientX: number, clientY: number) => void;
  /** Fired on a clean tap; receives the original event target. */
  onTap?: (target: EventTarget | null) => void;
  /** Fired when the press is held still long enough. */
  onLongPress?: () => void;
}

export function armPointer(
  e: { clientX: number; clientY: number; target: EventTarget | null },
  opts: ArmPointerOpts,
): void {
  const { threshold = TAP_SLOP, longPressMs = 450, onDragStart, onTap, onLongPress } = opts;
  const startX = e.clientX;
  const startY = e.clientY;
  const target = e.target;
  let promoted = false;
  let longFired = false;

  const timer = window.setTimeout(() => {
    if (!promoted) {
      longFired = true;
      onLongPress?.();
    }
  }, longPressMs);

  const cleanup = () => {
    window.clearTimeout(timer);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };

  const onMove = (ev: PointerEvent) => {
    if (promoted) return;
    if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > threshold) {
      promoted = true;
      cleanup();
      onDragStart(startX, startY);
    }
  };

  const onUp = () => {
    cleanup();
    if (!promoted && !longFired) onTap?.(target);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
