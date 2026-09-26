"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

// =============================================================================
// useRangeDrag
//
// Press anywhere on a slider, then drag — and keep dragging wherever the
// pointer goes until it lets go. The platform's range input does not do this
// on a phone: iOS Safari moves the value only from a touch that lands on the
// thumb, and the devtool's playhead has a 3px thumb. So the input keeps
// everything it is good at (the look, the keyboard, the value it reports to
// assistive tech) and gives up the pointer: it is `pointer-events: none`
// inside a wrapper that wears these props, and the wrapper does the
// pointing.
//
//   mouse / pen   the press moves the value at once and the drag follows, the
//                 way the platform's slider behaves on a desktop.
//   touch         a finger that lands on a slider may be a scroll that merely
//                 started there, so nothing moves until the gesture declares
//                 itself: a sideways drag takes the value, a tap sets it, and
//                 an upright drag is left to the page (`touch-action: pan-y`).
//
// Once a drag has the pointer it holds it (pointer capture), so leaving the
// track, the row or the sheet does not drop it. On touch that takes one more
// thing: `pan-y` only tells the browser which way the page MAY pan, and a
// finger that drifts upward mid-drag would still hand the gesture to the
// page (a pointercancel, and the drag is dropped). So an engaged drag also
// cancels the gesture's touchmoves until it ends. A press that lands on the
// thumb picks it up where it is instead of jumping it under the pointer.
//
// The wrapper is also `data-base-ui-swipe-ignore`: inside a sheet, a finger
// on a slider must never start the sheet's own swipe. Base UI exempts a range
// input by itself, but the event's target is now the wrapper, not the input.
// =============================================================================

/** Finger travel (px) before a touch counts as a drag in either direction. */
const TOUCH_SLOP = 4;

/** Past this, the pointer is on the thumb: pick it up, don't jump it. */
const GRAB_RADIUS = 12;

export interface RangeDragOptions {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /**
   * The thumb's width in px. The platform travels the thumb's centre from
   * half a thumb in from each end, so a press maps onto the value the same
   * way the thumb is drawn.
   */
  thumb: number;
}

export interface RangeDrag {
  /** The range input itself: measured for the track and focused on press. */
  inputRef: React.RefObject<HTMLInputElement | null>;
  /** Spread onto the element that wraps the input and takes the pointer. */
  wrapperProps: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
    onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => void;
    "data-base-ui-swipe-ignore": "";
    style: React.CSSProperties;
  };
}

/** Keeps the page from panning under an engaged touch drag. */
function holdTouch(e: TouchEvent) {
  if (e.cancelable) e.preventDefault();
}

interface Gesture {
  id: number;
  touch: boolean;
  startX: number;
  startY: number;
  /** Set once the gesture owns the value: the drag is relative to it. */
  anchor: { x: number; value: number } | null;
  /** The press landed on the thumb, so a tap leaves the value alone. */
  onThumb: boolean;
}

function decimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function useRangeDrag(options: RangeDragOptions): RangeDrag {
  const inputRef = useRef<HTMLInputElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  // Handlers read the latest props, not the ones from the render that bound
  // them: a drag spans many renders.
  const optsRef = useRef(options);
  useLayoutEffect(() => {
    optsRef.current = options;
  });

  /** Pixels of travel for the full range, and where it starts. */
  const track = () => {
    const input = inputRef.current;
    if (!input) return null;
    const rect = input.getBoundingClientRect();
    const { thumb } = optsRef.current;
    const span = Math.max(1, rect.width - thumb);
    return { left: rect.left + thumb / 2, span };
  };

  const snap = (raw: number) => {
    const { min, max, step } = optsRef.current;
    const clamped = Math.min(max, Math.max(min, raw));
    const stepped = step > 0 ? min + Math.round((clamped - min) / step) * step : clamped;
    return Number(Math.min(max, stepped).toFixed(decimals(step)));
  };

  const valueAt = (x: number) => {
    const t = track();
    const { min, max, value } = optsRef.current;
    if (!t) return value;
    return min + ((x - t.left) / t.span) * (max - min);
  };

  const thumbX = () => {
    const t = track();
    const { min, max, value } = optsRef.current;
    if (!t || max <= min) return null;
    return t.left + ((value - min) / (max - min)) * t.span;
  };

  const commit = (next: number) => {
    const { value, onChange } = optsRef.current;
    if (next !== value) onChange(next);
  };

  /** Take the value: from the thumb if it was pressed, else from the press. */
  const engage = (g: Gesture, e: React.PointerEvent<HTMLElement>) => {
    const { value } = optsRef.current;
    const start = g.onThumb ? value : snap(valueAt(g.startX));
    g.anchor = { x: g.startX, value: start };
    if (g.touch) {
      document.addEventListener("touchmove", holdTouch, { passive: false, capture: true });
    }
    try {
      e.currentTarget.setPointerCapture(g.id);
    } catch {
      // The pointer is already gone; the next up/cancel ends the gesture.
    }
    follow(g, e.clientX);
  };

  const follow = (g: Gesture, x: number) => {
    const t = track();
    if (!g.anchor || !t) return;
    const { min, max } = optsRef.current;
    commit(snap(g.anchor.value + ((x - g.anchor.x) / t.span) * (max - min)));
  };

  const end = () => {
    if (gestureRef.current?.anchor && gestureRef.current.touch) {
      document.removeEventListener("touchmove", holdTouch, { capture: true });
    }
    gestureRef.current = null;
  };

  // Unmounted mid-drag (the sheet closed under the finger): let the page go.
  useEffect(
    () => () => {
      const g = gestureRef.current;
      if (g?.anchor && g.touch) {
        document.removeEventListener("touchmove", holdTouch, { capture: true });
      }
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!e.isPrimary || gestureRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const input = inputRef.current;
    if (!input || input.disabled) return;
    const at = thumbX();
    const g: Gesture = {
      id: e.pointerId,
      touch: e.pointerType === "touch",
      startX: e.clientX,
      startY: e.clientY,
      anchor: null,
      onThumb: at !== null && Math.abs(e.clientX - at) <= Math.max(GRAB_RADIUS, optsRef.current.thumb / 2),
    };
    gestureRef.current = g;
    if (g.touch) return;
    // A mouse press is a press on the slider: focus it as the platform
    // would, and keep the drag from selecting the text around it.
    e.preventDefault();
    input.focus({ preventScroll: true });
    engage(g, e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.id) return;
    if (g.anchor) {
      follow(g, e.clientX);
      return;
    }
    const dx = Math.abs(e.clientX - g.startX);
    const dy = Math.abs(e.clientY - g.startY);
    if (dx >= TOUCH_SLOP && dx > dy) engage(g, e);
    // Upright: a scroll. The browser takes it (and sends a cancel); if
    // nothing there scrolls it may not, so stand down here as well.
    else if (dy >= TOUCH_SLOP * 2 && dy > dx) end();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.id) return;
    // A tap: the value goes where the finger was, unless it held the thumb.
    if (!g.anchor && !g.onThumb) commit(snap(valueAt(g.startX)));
    end();
  };

  const onPointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    const g = gestureRef.current;
    if (g && e.pointerId === g.id) end();
  };

  return {
    inputRef,
    wrapperProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture: onPointerCancel,
      "data-base-ui-swipe-ignore": "",
      style: { touchAction: "pan-y" },
    },
  };
}
