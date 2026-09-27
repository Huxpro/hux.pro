// =============================================================================
// Settling — whether the sky is between two states it was not easing between.
//
// Most of what the ambient system does is routine: the clock ticks the sun a
// thousandth of a screen, a poll comes back with the same city, the compass
// wanders a degree. None of that should announce itself. But some of it is not
// routine — a location fix that moves you a hundred kilometres, a forecast that
// turns clear into rain, a compass that corrects itself by thirty degrees, a
// clock that jumps — and then the sky spends a second or two getting from one
// state to the other. For that second, a very small spinner in the corner says
// "this is moving on purpose, and it will stop" (<SettleSpinner />).
//
// Each source names its own reason, so they cannot clear each other: the
// renderer while a body or the camera glides, the compass while it calibrates,
// the provider while a relocated forecast is fetched and rolled in. A reason is
// either held (until released) or timed (until it expires), and the spinner
// shows while any reason stands.
//
// Plain module state with a subscribe, not React: the renderer and the sensor
// source report from outside React, sixty times a second if they like — only a
// CHANGE of the answer reaches a listener.
// =============================================================================

export type SettleReason = "sky" | "compass" | "location" | "weather";

/** Reason → when it lapses (ms, performance clock); Infinity while held. */
const reasons = new Map<SettleReason, number>();
const listeners = new Set<() => void>();
let settling = false;
let timer = 0;

function now(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function recompute() {
  const t = now();
  let next = Infinity;
  for (const [key, until] of reasons) {
    if (until <= t) reasons.delete(key);
    else if (until < next) next = until;
  }
  const on = reasons.size > 0;
  if (typeof window !== "undefined") {
    window.clearTimeout(timer);
    if (Number.isFinite(next)) timer = window.setTimeout(recompute, next - t + 5);
  }
  if (on === settling) return;
  settling = on;
  for (const listener of listeners) listener();
}

/** Hold a reason (`true`) until it is released (`false`). */
export function holdSettle(reason: SettleReason, on: boolean) {
  const has = reasons.get(reason) === Infinity;
  if (on === has) return;
  if (on) reasons.set(reason, Infinity);
  else reasons.delete(reason);
  recompute();
}

/**
 * Stand a reason for `ms` from now — for a change whose settling is an easing
 * of known length rather than something that reports its own end. Extends, never
 * shortens, and never overrides a hold.
 */
export function settleFor(reason: SettleReason, ms: number) {
  const until = now() + ms;
  const current = reasons.get(reason) ?? 0;
  if (current >= until) return;
  reasons.set(reason, until);
  recompute();
}

export function isSettling(): boolean {
  return settling;
}

/** Which reasons stand right now — for the devtool. */
export function settleReasons(): SettleReason[] {
  const t = now();
  return [...reasons].filter(([, until]) => until > t).map(([key]) => key);
}

export function subscribeSettle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// -----------------------------------------------------------------------------
// What counts as "not routine", for the provider
// -----------------------------------------------------------------------------

/**
 * A fix this far from the last one is a change of place, not a correction:
 * an IP guess refined into a GPS fix across town moves the sun by nothing
 * anyone can see, one a city away changes the forecast.
 */
export const SETTLE_MOVE_KM = 30;

/**
 * How long the sky takes to roll into a new scene: the cloud decks' and the
 * precipitation's easing (≈2.5 s time constants in the renderer) to where the
 * change has stopped reading as motion.
 */
export const SETTLE_EASE_MS = 2600;

/** Great-circle distance between two places, km. */
export function distanceKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLon = (b.lon - a.lon) * r;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
