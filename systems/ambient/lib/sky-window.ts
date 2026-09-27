// =============================================================================
// The sky window — the phone as a window onto the real sky.
//
// Everywhere else the Sky is a STAGE: the page looks south (north in the
// southern hemisphere), the horizon is the bottom of the viewport, and the sun
// and moon are placed across it by their azimuth. The gyroscope, there, is a
// second gravity and never a camera (see "Gyroscope Tilt" in the docs).
//
// This is the other reading, and it is a different feature on purpose: hold the
// phone up and the screen becomes a window. Its compass heading says which way
// you face, its pitch how far up you look, its roll which way is level. The sun
// and the moon are where the ephemeris puts them — turn round and they are
// behind you; look up and the zenith is overhead; tip the phone to the ground
// and there is a horizon. The clouds become a deck with perspective, the stars a
// sphere turning with the sidereal clock, and the rain keeps falling along real
// gravity, which in a window is simply what gravity looks like.
//
// This module is the geometry and the one sensor source. Nothing here renders:
// the view goes from the sensor to `WallpaperRenderer.setView()` without passing
// through React, like the gravity does.
//
// FRAMES. The world is East-North-Up (x east, y north, z up) — the W3C frame
// `deviceorientation` is defined in, and azimuths are clockwise from north, the
// way lib/solar.ts gives them. A view is three unit vectors in that frame: where
// the screen's right, its top and the direction it looks (out of the back of the
// phone) point.
//
// THE COMPASS. `deviceorientation`'s alpha is only a heading where the browser
// says it is: Chrome sends a separate `deviceorientationabsolute`, Firefox marks
// the event `absolute`, and WebKit keeps alpha relative to wherever the phone
// was when listening started and hands over `webkitCompassHeading` beside it.
// For WebKit the offset between the two is estimated, and only while the top of
// the phone has a direction to measure (it is a heading of the top edge, which
// a phone held straight up does not have). With no compass at all the window
// still turns, anchored so that where you first point is where the stage looked
// — so it opens onto the same sky it left.
// =============================================================================

import { smoothstep } from "./solar";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Where the screen points, in East-North-Up. All three are unit vectors. */
export interface SkyView {
  /** The screen's right edge. */
  right: Vec3;
  /** The screen's top edge. */
  up: Vec3;
  /** Out of the back of the phone — where you are looking. */
  forward: Vec3;
  /** True when the heading is a real compass heading, not a guess. */
  compass: boolean;
}

/**
 * How wide the window is, along the screen's LONGER side, in degrees. About a
 * phone camera's own: wide enough that a sun and a moon a quarter of the sky
 * apart can share it held in landscape, narrow enough that finding one is a
 * turn of the body rather than a flick of the wrist — which is the whole fun.
 */
export const WINDOW_FOV_DEG = 80;

/**
 * Past this, in screen heights from the centre, a body is simply off screen —
 * and a body BEHIND the viewer is put here too, in the direction it lies, so its
 * glow falls away continuously as it swings round behind you instead of
 * jumping through infinity.
 */
const OFF_SCREEN = 4;

const DEG = Math.PI / 180;

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z);
  return len < 1e-9 ? { x: 0, y: 0, z: 1 } : { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** An azimuth (clockwise from north) and an elevation, as a unit ENU vector. */
export function directionOf(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * DEG;
  const el = elevationDeg * DEG;
  return { x: Math.sin(az) * Math.cos(el), y: Math.cos(az) * Math.cos(el), z: Math.sin(el) };
}

/** Heading (clockwise from north) and pitch (up from level) of a direction, degrees. */
export function headingPitchOf(v: Vec3): { heading: number; pitch: number } {
  const heading = (Math.atan2(v.x, v.y) / DEG + 360) % 360;
  const pitch = Math.asin(Math.max(-1, Math.min(1, v.z))) / DEG;
  return { heading, pitch };
}

/**
 * A level view facing `headingDeg`, tipped up by `pitchDeg` — what the devtool
 * drives on a desktop, and the view before the first reading arrives.
 */
export function viewFacing(headingDeg: number, pitchDeg: number, compass = false): SkyView {
  const forward = directionOf(headingDeg, pitchDeg);
  const up = directionOf(headingDeg, pitchDeg + 90);
  return { forward, up, right: cross(forward, up), compass };
}

/**
 * Where the stage looks: south in the north, north in the south, level. The
 * window opens from here when nothing better is known, so the first frame of it
 * is the same sky the stage was showing, only now with a horizon.
 */
export function stageView(hemisphere: 1 | -1): SkyView {
  return viewFacing(hemisphere === 1 ? 180 : 0, 12);
}

/**
 * The view from a `deviceorientation` reading with an ABSOLUTE alpha.
 *
 * The W3C angles are intrinsic Z-X'-Y'': R = Rz(α)·Rx(β)·Ry(γ) takes a device
 * vector into the Earth frame. The screen's own axes are the device's, turned
 * by `screen.orientation.angle` when the layout has rotated — the same turn
 * lib/gyroscope.ts applies to gravity.
 */
export function viewFromOrientation(
  alphaDeg: number,
  betaDeg: number,
  gammaDeg: number,
  screenAngleDeg = 0,
  compass = true
): SkyView {
  const a = alphaDeg * DEG;
  const b = betaDeg * DEG;
  const g = gammaDeg * DEG;
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cg = Math.cos(g), sg = Math.sin(g);

  // The columns of R: where the device's x, y and z axes point on Earth.
  const col0 = vec3(ca * cg - sa * sb * sg, sa * cg + ca * sb * sg, -cb * sg);
  const col1 = vec3(-sa * cb, ca * cb, sb);
  const col2 = vec3(ca * sg + sa * sb * cg, sa * sg - ca * sb * cg, cb * cg);

  const s = screenAngleDeg * DEG;
  const cs = Math.cos(s), ss = Math.sin(s);
  // Screen right is device (cos s, −sin s), screen up device (sin s, cos s).
  const right = vec3(
    cs * col0.x - ss * col1.x,
    cs * col0.y - ss * col1.y,
    cs * col0.z - ss * col1.z
  );
  const up = vec3(
    ss * col0.x + cs * col1.x,
    ss * col0.y + cs * col1.y,
    ss * col0.z + cs * col1.z
  );
  const forward = vec3(-col2.x, -col2.y, -col2.z);
  return { right, up, forward, compass };
}

/**
 * How far one unit of screen (a viewport HEIGHT, the shader's unit) reaches at
 * the window's centre: `p = centre + k · (x, y) / z`. The field of view is
 * held along the longer side, so turning the phone to landscape widens the
 * window rather than narrowing it.
 */
export function viewScale(aspect: number): number {
  const halfLong = Math.max(aspect, 1) / 2;
  return halfLong / Math.tan((WINDOW_FOV_DEG / 2) * DEG);
}

/**
 * Where a world direction lands on screen: 0..1 across and 0..1 bottom → top,
 * the convention `uSun` uses. Off to the side and behind are both answered, and
 * continuously: a body leaving the window slides out to `OFF_SCREEN` along the
 * way it lies and waits there.
 */
export function projectToScreen(
  dir: Vec3,
  view: SkyView,
  aspect: number
): { x: number; y: number; ahead: number } {
  const cx = dot(dir, view.right);
  const cy = dot(dir, view.up);
  const cz = dot(dir, view.forward);
  const k = viewScale(aspect);
  let px: number;
  let py: number;
  const side = Math.hypot(cx, cy);
  if (cz > 1e-4 && (side * k) / cz < OFF_SCREEN) {
    px = (k * cx) / cz;
    py = (k * cy) / cz;
  } else if (side > 1e-6) {
    px = (cx / side) * OFF_SCREEN;
    py = (cy / side) * OFF_SCREEN;
  } else {
    // Dead behind: anywhere far is as good as anywhere else.
    px = 0;
    py = -OFF_SCREEN;
  }
  return { x: (aspect / 2 + px) / aspect, y: 0.5 + py, ahead: cz };
}

/**
 * Which way the moon's lit limb faces on screen, as an angle from screen-right,
 * in radians — toward the sun, along the great circle between them, whatever
 * the camera's roll. That is the only honest crescent in a window: the stage
 * can say "waxing is lit on the right", but a sky you can turn around in cannot.
 */
export function moonLitAngle(moon: Vec3, sun: Vec3, view: SkyView): number {
  const along = dot(sun, moon);
  const t = vec3(sun.x - moon.x * along, sun.y - moon.y * along, sun.z - moon.z * along);
  const sx = dot(t, view.right);
  const sy = dot(t, view.up);
  if (Math.hypot(sx, sy) < 1e-6) return 0;
  return Math.atan2(sy, sx);
}

// -----------------------------------------------------------------------------
// The sky's own frame: the stars
//
// The star field is fixed to the celestial sphere and the sphere turns about
// the pole once a sidereal day — so a star rises in the east and sets in the
// west, the pole sits at the latitude's height, and at a long exposure the
// whole field wheels. The stars themselves are hashed, not catalogued: this is
// a sky, not a planetarium.
// -----------------------------------------------------------------------------

/** Local sidereal time in degrees, from a clock and a longitude. */
export function localSiderealDeg(nowMs: number, lonDeg: number): number {
  const jd = nowMs / 86_400_000 + 2440587.5;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
  return (((gmst + lonDeg) % 360) + 360) % 360;
}

/**
 * ENU → the turning equatorial frame, as a column-major mat3 for GLSL. The
 * rows are the frame's axes in ENU: east and the meridian's equator point,
 * turned by the sidereal angle, and the pole.
 */
export function starFrame(latDeg: number, lstDeg: number, out: Float32Array): Float32Array {
  const phi = latDeg * DEG;
  const L = lstDeg * DEG;
  const cL = Math.cos(L), sL = Math.sin(L);
  const E = [1, 0, 0];
  const Q = [0, Math.sin(phi), -Math.cos(phi)];
  const P = [0, Math.cos(phi), Math.sin(phi)];
  const rows = [
    [cL * E[0] - sL * Q[0], cL * E[1] - sL * Q[1], cL * E[2] - sL * Q[2]],
    [sL * E[0] + cL * Q[0], sL * E[1] + cL * Q[1], sL * E[2] + cL * Q[2]],
    P,
  ];
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) out[c * 3 + r] = rows[r][c];
  return out;
}

// -----------------------------------------------------------------------------
// The shared source
//
// One listener per event type for the whole page, like the gravity's, smoothed
// against the clock. Chrome sends the compass as its own event; everything else
// sends one `deviceorientation` and says in it how much to trust alpha.
// -----------------------------------------------------------------------------

type ViewListener = (view: SkyView) => void;

/** The sensor's own jitter, smoothed — a compass wanders more than a level. */
const VIEW_TAU = 0.12;
/** How slowly WebKit's compass offset is allowed to wander, once it has one. */
const OFFSET_TAU = 1.5;
/** Chrome's absolute stream counts as present for this long after its last event. */
const ABSOLUTE_FRESH_MS = 600;
/**
 * The top of the phone must have at least this much of itself lying level for
 * `webkitCompassHeading` to mean what it says — past that the phone is held too
 * steeply for "where the top edge points" to be a direction at all.
 */
const COMPASS_LEVEL_MIN = 0.35;

const listeners = new Set<ViewListener>();
let attached = false;
let latest: SkyView | null = null;
let lastAt = 0;
let absoluteAt = 0;
/** WebKit: true heading minus relative alpha, radians; NaN until measured. */
let compassOffset = NaN;
/** No compass anywhere: the offset that makes the first reading face the stage. */
let anchorOffset = NaN;
let anchorHeading = 180;
let simulated: SkyView | null = null;

function readScreenAngle(): number {
  if (typeof window === "undefined") return 0;
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === "number" && Number.isFinite(angle)) return angle;
  const legacy = (window as { orientation?: unknown }).orientation;
  return typeof legacy === "number" && Number.isFinite(legacy) ? (legacy + 360) % 360 : 0;
}

function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function publish(raw: SkyView) {
  const now = performance.now();
  const dt = lastAt === 0 || !latest ? Infinity : Math.min((now - lastAt) / 1000, 1);
  lastAt = now;
  if (!latest || !Number.isFinite(dt)) {
    latest = raw;
  } else {
    const k = 1 - Math.exp(-dt / VIEW_TAU);
    const f = normalize(
      vec3(
        latest.forward.x + (raw.forward.x - latest.forward.x) * k,
        latest.forward.y + (raw.forward.y - latest.forward.y) * k,
        latest.forward.z + (raw.forward.z - latest.forward.z) * k
      )
    );
    const u0 = vec3(
      latest.up.x + (raw.up.x - latest.up.x) * k,
      latest.up.y + (raw.up.y - latest.up.y) * k,
      latest.up.z + (raw.up.z - latest.up.z) * k
    );
    // Back to a frame: up is made square to forward, and right follows.
    const along = dot(u0, f);
    const u = normalize(vec3(u0.x - f.x * along, u0.y - f.y * along, u0.z - f.z * along));
    latest = { forward: f, up: u, right: cross(f, u), compass: raw.compass };
  }
  for (const listener of listeners) listener(latest);
}

type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
};

function readAngles(event: DeviceOrientationEvent) {
  const { alpha, beta, gamma } = event;
  if (
    alpha === null || beta === null || gamma === null ||
    !Number.isFinite(alpha) || !Number.isFinite(beta) || !Number.isFinite(gamma)
  ) {
    return null;
  }
  return { alpha, beta, gamma };
}

function onAbsolute(event: DeviceOrientationEvent) {
  if (simulated) return;
  const angles = readAngles(event);
  if (!angles) return;
  absoluteAt = performance.now();
  publish(viewFromOrientation(angles.alpha, angles.beta, angles.gamma, readScreenAngle(), true));
}

function onRelative(event: DeviceOrientationEvent) {
  if (simulated) return;
  // Chrome's absolute stream is running: that one is the truth, this one is not.
  if (absoluteAt > 0 && performance.now() - absoluteAt < ABSOLUTE_FRESH_MS) return;
  const angles = readAngles(event);
  if (!angles) return;
  const screenAngle = readScreenAngle();

  if (event.absolute) {
    publish(viewFromOrientation(angles.alpha, angles.beta, angles.gamma, screenAngle, true));
    return;
  }

  const heading = (event as CompassEvent).webkitCompassHeading;
  const accuracy = (event as CompassEvent).webkitCompassAccuracy;
  if (typeof heading === "number" && Number.isFinite(heading) && (accuracy ?? 0) >= 0) {
    // Where the top edge points by the relative alpha, against where the
    // compass says it points: the difference is the rotation between WebKit's
    // arbitrary frame and north. It only means something while the top edge
    // lies level enough to point anywhere.
    const rel = viewFromOrientation(angles.alpha, angles.beta, angles.gamma, 0, false);
    const top = rel.up; // screen angle 0: the device's own top edge
    const level = Math.hypot(top.x, top.y);
    if (level > COMPASS_LEVEL_MIN || Number.isNaN(compassOffset)) {
      const relHeading = Math.atan2(top.x, top.y);
      const measured = wrapPi(relHeading - heading * DEG);
      if (Number.isNaN(compassOffset)) {
        compassOffset = measured;
      } else {
        const weight = smoothstep(COMPASS_LEVEL_MIN, 0.8, level);
        const now = performance.now();
        const dt = lastAt === 0 ? 0.016 : Math.min((now - lastAt) / 1000, 1);
        const k = (1 - Math.exp(-dt / OFFSET_TAU)) * weight;
        compassOffset = wrapPi(compassOffset + wrapPi(measured - compassOffset) * k);
      }
    }
    publish(
      viewFromOrientation(
        angles.alpha + compassOffset / DEG,
        angles.beta,
        angles.gamma,
        screenAngle,
        true
      )
    );
    return;
  }

  // No compass: anchor the first reading onto the stage's heading.
  const rel = viewFromOrientation(angles.alpha, angles.beta, angles.gamma, screenAngle, false);
  if (Number.isNaN(anchorOffset)) {
    const relHeading = Math.atan2(rel.forward.x, rel.forward.y);
    anchorOffset = wrapPi(relHeading - anchorHeading * DEG);
  }
  publish(
    viewFromOrientation(
      angles.alpha + anchorOffset / DEG,
      angles.beta,
      angles.gamma,
      screenAngle,
      false
    )
  );
}

/**
 * Stream the view until the returned function is called. `stageHeading` is
 * where the window opens when there is no compass to say better (see
 * `stageView`).
 */
export function subscribeView(listener: ViewListener, stageHeading = 180): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  anchorHeading = stageHeading;
  if (simulated) listener(simulated);
  if (!attached) {
    window.addEventListener("deviceorientationabsolute", onAbsolute as EventListener, {
      passive: true,
    });
    window.addEventListener("deviceorientation", onRelative, { passive: true });
    attached = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && attached) {
      window.removeEventListener("deviceorientationabsolute", onAbsolute as EventListener);
      window.removeEventListener("deviceorientation", onRelative);
      attached = false;
      latest = null;
      lastAt = 0;
      absoluteAt = 0;
      compassOffset = NaN;
      anchorOffset = NaN;
    }
  };
}

/** The last view, for a readout that polls. Null until a reading arrives. */
export function readView(): SkyView | null {
  return simulated ?? latest;
}

/**
 * Drive the window by hand — the devtool's heading and pitch, on a desktop
 * with no sensor. Null hands it back to the sensor.
 */
export function simulateView(view: SkyView | null) {
  simulated = view;
  if (view) for (const listener of listeners) listener(view);
}
