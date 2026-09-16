// =============================================================================
// Gyroscope — where "down" is, in screen space.
//
// The sky's rain and snow fall along gravity rather than along the bottom of
// the viewport: lean the phone and the streaks lean with it, turn it on its
// side and the snow crosses the page sideways. That needs exactly one thing
// per frame — the direction of gravity as the *screen* sees it — which is all
// this module produces.
//
// `deviceorientation` reports the Euler angles (alpha, beta, gamma) that take
// the Earth frame to the device frame. Gravity is Earth-down, so its
// components in the device frame fall straight out of the last row of that
// rotation matrix:
//
//   g_device = (cos β · sin γ, −sin β, −cos β · cos γ)
//
// Alpha — the compass heading — drops out, which is right: which way you face
// cannot change which way things fall. The first two components are the part
// of gravity lying in the plane of the screen (x right, y toward the top);
// the third is how much of it points into the glass, so a phone flat on a
// table has a vanishing in-plane vector and no meaningful direction at all.
// That is what `INPLANE_*` blends away.
//
// The page's frame stops being the device's the moment the browser rotates the
// layout, so the in-plane vector is turned by `screen.orientation.angle`.
//
// Access: every browser with a sensor fires the event freely except WebKit,
// which gates it behind `DeviceOrientationEvent.requestPermission()` AND a
// user gesture. So the wish is a saved setting that defaults to on, an
// ungated browser starts tilting by itself, and only a first grant needs
// somewhere to tap (the Weather tab of the wallpaper picker, and the devtool's
// Sky module). Once granted, the grant is remembered in the ambient settings
// and re-taken silently on the next load — which is the only time
// `requestPermission()` is ever called without a gesture, precisely so a
// visitor who has never answered is never prompted out of nowhere.
// =============================================================================

/**
 * A direction in the shader's frame: x to the right, **y up**. Always a unit
 * vector; `{ x: 0, y: -1 }` is an upright screen, which is also what every
 * consumer falls back to, so nothing anywhere has to special-case a device
 * with no gyroscope.
 */
export interface GravityVector {
  x: number;
  y: number;
}

/** Down the page — a phone held upright, and the answer when we cannot know. */
export const UPRIGHT_GRAVITY: GravityVector = { x: 0, y: -1 };

/** Below this much of gravity in the screen plane, the screen is flat and the direction is noise. */
const INPLANE_MIN = 0.12;
/** Above this much, the tilt is taken at face value. */
const INPLANE_FULL = 0.45;

const DEG = Math.PI / 180;

/**
 * How this browser hands over motion readings.
 *
 *   unsupported — no `DeviceOrientationEvent` at all
 *   open        — the event fires with nothing to ask (everything but WebKit)
 *   prompt      — WebKit's gate, unanswered: one tap away
 *   granted     — WebKit's gate, already passed
 *   denied      — asked and refused; the browser's own settings can undo it
 */
export type GyroAccess = "unsupported" | "open" | "prompt" | "granted" | "denied";

/** Whether readings can flow right now, whatever the visitor's wish. */
export function isGyroReachable(access: GyroAccess): boolean {
  return access === "open" || access === "granted";
}

type GatedDeviceOrientationEvent = {
  requestPermission?: () => Promise<PermissionState | string>;
};

function gate(): GatedDeviceOrientationEvent | null {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return null;
  return window.DeviceOrientationEvent as unknown as GatedDeviceOrientationEvent;
}

export function isGyroSupported(): boolean {
  return gate() !== null;
}

/** WebKit: motion is behind `requestPermission()` and cannot start on its own. */
export function isGyroGated(): boolean {
  return typeof gate()?.requestPermission === "function";
}

/**
 * Ask WebKit for motion access. Call it **from a user gesture**: without one
 * the promise rejects, which is reported back as `"prompt"` — still one tap
 * away, and no prompt was shown.
 */
export async function requestGyroAccess(): Promise<GyroAccess> {
  const ctor = gate();
  if (!ctor) return "unsupported";
  if (typeof ctor.requestPermission !== "function") return "open";
  try {
    const state = await ctor.requestPermission();
    if (state === "granted") return "granted";
    if (state === "denied") return "denied";
    return "prompt";
  } catch {
    // No user gesture (or the gate refused to even consider it).
    return "prompt";
  }
}

/**
 * The access this browser gives *without being asked*, for the first paint.
 *
 * `retakeGranted` is the record that this visitor has granted motion here
 * before; only then is WebKit's gate re-taken silently, so the toggle keeps
 * working across reloads without anyone being prompted unprovoked.
 */
export async function resolveGyroAccess(options?: {
  retakeGranted?: boolean;
}): Promise<GyroAccess> {
  if (!isGyroSupported()) return "unsupported";
  if (!isGyroGated()) return "open";
  if (!options?.retakeGranted) return "prompt";
  return requestGyroAccess();
}

// -----------------------------------------------------------------------------
// Geometry
// -----------------------------------------------------------------------------

/**
 * Screen-space gravity from a `deviceorientation` reading.
 *
 * `screenAngle` is `screen.orientation.angle` — how far the layout has been
 * turned out of the device's natural orientation — and the in-plane vector is
 * turned by the same angle to land in the page's frame. (That is the
 * transform three.js's DeviceOrientationControls applies, and it checks out
 * by hand in both landscapes: gravity comes back down the page.) A screen too
 * flat to have a direction blends to upright rather than snapping around on
 * sensor noise.
 */
export function gravityFromOrientation(
  beta: number | null,
  gamma: number | null,
  screenAngle = 0
): GravityVector {
  if (beta === null || gamma === null || !Number.isFinite(beta) || !Number.isFinite(gamma)) {
    return UPRIGHT_GRAVITY;
  }

  const b = beta * DEG;
  const g = gamma * DEG;
  // The screen-plane part of Earth-down, in the device's own frame.
  const dx = Math.cos(b) * Math.sin(g);
  const dy = -Math.sin(b);

  // Into the page's frame: the layout may be rotated out of the device's.
  const a = screenAngle * DEG;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const x = dx * cos - dy * sin;
  const y = dx * sin + dy * cos;

  const inPlane = Math.hypot(x, y);
  if (inPlane < 1e-4) return UPRIGHT_GRAVITY;

  // Flat on a table → upright; held at any readable angle → the real thing.
  const weight = smoothstep(INPLANE_MIN, INPLANE_FULL, inPlane);
  const mx = (x / inPlane) * weight;
  const my = (y / inPlane) * weight + UPRIGHT_GRAVITY.y * (1 - weight);
  const len = Math.hypot(mx, my);
  return len < 1e-4 ? UPRIGHT_GRAVITY : { x: mx / len, y: my / len };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** The tilt as an angle, clockwise from upright, in degrees. For readouts. */
export function gravityTiltDegrees(g: GravityVector): number {
  return Math.atan2(g.x, -g.y) / DEG;
}

function readScreenAngle(): number {
  if (typeof window === "undefined") return 0;
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === "number" && Number.isFinite(angle)) return angle;
  // iOS before 16.4 has no ScreenOrientation; `window.orientation` is the same
  // number in the same direction, just signed.
  const legacy = (window as { orientation?: unknown }).orientation;
  return typeof legacy === "number" && Number.isFinite(legacy) ? (legacy + 360) % 360 : 0;
}

// -----------------------------------------------------------------------------
// The shared source
//
// One `deviceorientation` listener for the whole page, however many surfaces
// want the readings — the full-page sky and the picker's Sky tile both do, and
// a second listener would cost a second stream of events for the same number.
// -----------------------------------------------------------------------------

type GravityListener = (gravity: GravityVector) => void;

const listeners = new Set<GravityListener>();
let latest: GravityVector = UPRIGHT_GRAVITY;
let attached = false;

function onDeviceOrientation(event: DeviceOrientationEvent) {
  // A browser with no sensor still fires an event or two, every angle null, to
  // say exactly that — Chromium does it on any secure origin. There is nothing
  // to read in one and nothing to pass on: dropping it here is what leaves the
  // provider's `readings` on "silent" for a device that cannot tilt.
  if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
  latest = gravityFromOrientation(event.beta, event.gamma, readScreenAngle());
  for (const listener of listeners) listener(latest);
}

/**
 * Stream screen-space gravity until the returned function is called.
 *
 * Nothing is validated here: a caller subscribing where access was never
 * granted simply never hears anything, which is also what a desktop browser
 * with no sensor does (the event type exists in every one of them and fires in
 * none) — see the provider's `gyro.readings`.
 */
export function subscribeGravity(listener: GravityListener): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  if (!attached) {
    window.addEventListener("deviceorientation", onDeviceOrientation, { passive: true });
    attached = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && attached) {
      window.removeEventListener("deviceorientation", onDeviceOrientation);
      attached = false;
      latest = UPRIGHT_GRAVITY;
    }
  };
}

/** The last reading, for a readout that polls instead of subscribing. */
export function readGravity(): GravityVector {
  return latest;
}
