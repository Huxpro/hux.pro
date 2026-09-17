// =============================================================================
// Stirring the weather — the rain-and-snow easter egg.
//
// Drag a hand across the page's background while it is raining or snowing and
// you stir the air it passes through — whichever way it goes. A stroke that
// turns leaves a curl behind it, and the curl keeps turning after the hand has
// gone. The near heavy drops are the last to be turned and the last to give it
// up; the snow, slower again, comes round over seconds and keeps going for
// more. Stop, or let go, and it dies away and the sky settles back. The cloud
// decks feel nothing: you cannot stir a cloud by waving at it.
//
// That is the whole of it. A hand pushes air, and everything the sky does with
// moving air it already knew how to do. Nothing is held, nothing is towed
// about, and there is no second physics to keep honest — which is why the sky
// never has to be handed back at the end of a gesture.
//
// This module is only the recognizer: it decides whether a drag landed on the
// background and reports how fast the hand is going, in CSS pixels per second.
// The air itself is `field.ts` — a grid stepped once a frame, which is where
// the stroke goes and where every particle's drag is worked out — and the look
// is `shader.ts`.
//
// What counts as the background is not asked here twice: it is `isBackgroundClick`
// from `lib/strike.ts`, the same question the thunder-day strike asks, so the two
// easter eggs can never disagree about where the sky is. (It is named for a
// click, but it only ever looks at the target, and a press is the same question.
// `data-no-strike` keeps both of them off.)
//
// Two deliberate choices:
//
//   · Touch events, not pointer events. The moment a touch drag turns into a
//     page scroll the browser fires `pointercancel` and stops sending
//     `pointermove` — which would cut the gesture off exactly where it is most
//     fun, since the background is mostly what you scroll from. `touchmove`
//     keeps coming either way.
//   · Nothing here ever calls `preventDefault`, and nothing here ever changes
//     a style. Scrolling, tapping, long-pressing and selecting text behave
//     exactly as they would if the easter egg were not installed; it only ever
//     adds wind to the wallpaper behind them.
// =============================================================================

import { isBackgroundClick } from "../strike";

/** Compatibility mouse events follow a tap; ignore a mouse this soon after one. */
const AFTER_TOUCH_MS = 700;

/** How much of the newest sample the reported speed takes on each move. */
const SPEED_MIX = 0.7;

export interface WindStirListener {
  /**
   * The hand's speed in CSS pixels per second (`vy` positive DOWN, as client
   * coordinates run) and where it is. Sent on every move of a drag that began
   * on the background.
   *
   * Both axes, now that there is a field to put them in: a hand pushes the air
   * it passes through whichever way it goes, and a stroke that turns is what
   * leaves a curl behind it.
   *
   * There is no matching "stopped" call, and none is needed: a hand that has
   * stopped sends nothing, and the renderer lets an unrefreshed stir go stale
   * within a breath. A gesture can therefore end — by lifting, by being
   * cancelled, by the whole listener being detached — without anybody having
   * to put the sky back.
   */
  onStir: (vx: number, vy: number, x: number, y: number) => void;
}

function findTouch(list: TouchList, id: number): Touch | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].identifier === id) return list[i];
  }
  return null;
}

/** Listen for background drags on the whole page. Returns a detach function. */
export function attachWindStir(listener: WindStirListener): () => void {
  /** The drag in flight: a touch identifier, "mouse", or nothing. */
  let source: number | "mouse" | null = null;
  let lastX = 0;
  let lastY = 0;
  let lastAt = 0;
  let vx = 0;
  let vy = 0;
  // −∞, not 0: `performance.now()` starts near zero, and a plain 0 would make
  // the whole first second of a page's life look like it had just been tapped.
  let lastTouchAt = -Infinity;

  const begin = (from: number | "mouse", x: number, y: number) => {
    source = from;
    lastX = x;
    lastY = y;
    lastAt = performance.now();
    vx = 0;
    vy = 0;
  };

  const move = (x: number, y: number) => {
    const now = performance.now();
    const dt = (now - lastAt) / 1000;
    // Sub-millisecond gaps make the division explode; the travel they carry is
    // negligible, so fold them into the next sample instead.
    if (dt <= 0.001) return;
    vx = ((x - lastX) / dt) * SPEED_MIX + vx * (1 - SPEED_MIX);
    vy = ((y - lastY) / dt) * SPEED_MIX + vy * (1 - SPEED_MIX);
    lastX = x;
    lastY = y;
    lastAt = now;
    listener.onStir(vx, vy, x, y);
  };

  const end = () => {
    source = null;
  };

  // --- Touch ---------------------------------------------------------------

  const onTouchStart = (e: TouchEvent) => {
    lastTouchAt = performance.now();
    if (source !== null) {
      // A second finger means pinch, or a two-handed something; bow out.
      if (e.touches.length > 1) end();
      return;
    }
    if (e.touches.length !== 1) return;
    const touch = e.changedTouches[0];
    if (!touch || !isBackgroundClick(e.target)) return;
    begin(touch.identifier, touch.clientX, touch.clientY);
  };

  const onTouchMove = (e: TouchEvent) => {
    lastTouchAt = performance.now();
    if (typeof source !== "number") return;
    const touch = findTouch(e.changedTouches, source) ?? findTouch(e.touches, source);
    if (touch) move(touch.clientX, touch.clientY);
  };

  const onTouchEnd = (e: TouchEvent) => {
    lastTouchAt = performance.now();
    if (typeof source !== "number") return;
    if (findTouch(e.changedTouches, source)) end();
  };

  // --- Mouse ---------------------------------------------------------------

  const onMouseDown = (e: MouseEvent) => {
    if (source !== null || e.button !== 0) return;
    if (performance.now() - lastTouchAt < AFTER_TOUCH_MS) return;
    if (!isBackgroundClick(e.target)) return;
    begin("mouse", e.clientX, e.clientY);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (source === "mouse") move(e.clientX, e.clientY);
  };

  // --- Wiring --------------------------------------------------------------
  //
  // On the window, in the capture phase, so a drag is still seen through a
  // `stopPropagation` on the way up — and passive, because none of this ever
  // cancels anything. The move handlers are live the whole time rather than
  // subscribed per gesture: Chrome decides whether a touch sequence needs the
  // main thread at all when the first finger lands, and a listener added after
  // that can miss the moves it was added for.

  const listeners: Array<[string, EventListener]> = [
    ["touchstart", onTouchStart as EventListener],
    ["touchmove", onTouchMove as EventListener],
    ["touchend", onTouchEnd as EventListener],
    ["touchcancel", onTouchEnd as EventListener],
    ["mousedown", onMouseDown as EventListener],
    ["mousemove", onMouseMove as EventListener],
    ["mouseup", end as EventListener],
    // A mouse that leaves for another window, or a tab that goes away mid-drag,
    // never sends its mouseup.
    ["blur", end as EventListener],
  ];

  for (const [type, fn] of listeners) {
    window.addEventListener(type, fn, { passive: true, capture: true });
  }

  return () => {
    for (const [type, fn] of listeners) {
      window.removeEventListener(type, fn, { capture: true });
    }
    end();
  };
}
