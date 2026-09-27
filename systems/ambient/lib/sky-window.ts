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

import { readScreenAngle } from "./gyroscope";
import { holdSettle } from "./settle";
import { rev, smoothstep } from "./solar";

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
const WINDOW_FOV_DEG = 80;

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
  const heading = rev(Math.atan2(v.x, v.y) / DEG);
  const pitch = Math.asin(Math.max(-1, Math.min(1, v.z))) / DEG;
  return { heading, pitch };
}

/**
 * A level view facing `headingDeg`, tipped up by `pitchDeg` — what the devtool
 * drives on a desktop, and the view before the first reading arrives.
 */
export function viewFacing(headingDeg: number, pitchDeg: number): SkyView {
  const forward = directionOf(headingDeg, pitchDeg);
  const up = directionOf(headingDeg, pitchDeg + 90);
  return { forward, up, right: cross(forward, up), compass: false };
}

/** The two stage views, built once: they depend on nothing but the hemisphere. */
const STAGE_VIEW = { north: viewFacing(180, 12), south: viewFacing(0, 12) };

/**
 * Where the stage looks: south in the north, north in the south, level. The
 * window opens from here when nothing better is known, so the first frame of it
 * is the same sky the stage was showing, only now with a horizon.
 */
export function stageView(hemisphere: 1 | -1): SkyView {
  return hemisphere === 1 ? STAGE_VIEW.north : STAGE_VIEW.south;
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
  aspect: number,
  /** `viewScale(aspect)`, when the caller already has it. */
  k = viewScale(aspect)
): { x: number; y: number; ahead: number } {
  const cx = dot(dir, view.right);
  const cy = dot(dir, view.up);
  const cz = dot(dir, view.forward);
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
// Gliding between two views
//
// A view that jumps — the first reading after the window opens, a compass that
// arrives late, the devtool's slider let go somewhere else — is turned to, not
// cut to. Interpolating the three vectors on their own would shear the frame
// on the way (and pass through zero for a half turn), so the turn is a slerp of
// the rotation itself: the shortest way round, at an even speed, square the
// whole way.
// -----------------------------------------------------------------------------

type Quat = [number, number, number, number];

/** The rotation whose columns are right, up and back (−forward): right-handed. */
function quatOf(v: SkyView): Quat {
  const m00 = v.right.x, m01 = v.up.x, m02 = -v.forward.x;
  const m10 = v.right.y, m11 = v.up.y, m12 = -v.forward.y;
  const m20 = v.right.z, m21 = v.up.z, m22 = -v.forward.z;
  const tr = m00 + m11 + m22;
  let q: Quat;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    q = [s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = [(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s];
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = [(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s];
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4];
  }
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

function viewOfQuat([w, x, y, z]: Quat, compass: boolean): SkyView {
  const right = vec3(1 - 2 * (y * y + z * z), 2 * (x * y + w * z), 2 * (x * z - w * y));
  const up = vec3(2 * (x * y - w * z), 1 - 2 * (x * x + z * z), 2 * (y * z + w * x));
  const back = vec3(2 * (x * z + w * y), 2 * (y * z - w * x), 1 - 2 * (x * x + y * y));
  return { right, up, forward: vec3(-back.x, -back.y, -back.z), compass };
}

/** The view `t` of the way from `a` to `b`, turning the shortest way round. */
export function slerpView(a: SkyView, b: SkyView, t: number): SkyView {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const qa = quatOf(a);
  let qb = quatOf(b);
  let d = qa[0] * qb[0] + qa[1] * qb[1] + qa[2] * qb[2] + qa[3] * qb[3];
  if (d < 0) {
    qb = [-qb[0], -qb[1], -qb[2], -qb[3]];
    d = -d;
  }
  let wa: number;
  let wb: number;
  if (d > 0.9995) {
    wa = 1 - t;
    wb = t;
  } else {
    const th = Math.acos(d);
    const sin = Math.sin(th);
    wa = Math.sin((1 - t) * th) / sin;
    wb = Math.sin(t * th) / sin;
  }
  const q: Quat = [
    qa[0] * wa + qb[0] * wb,
    qa[1] * wa + qb[1] * wb,
    qa[2] * wa + qb[2] * wb,
    qa[3] * wa + qb[3] * wb,
  ];
  const n = Math.hypot(...q);
  return viewOfQuat([q[0] / n, q[1] / n, q[2] / n, q[3] / n], b.compass);
}

/** The unit direction `t` of the way from `a` to `b`, along the great circle. */
export function slerpDir(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = Math.max(-1, Math.min(1, dot(a, b)));
  if (d > 0.9995) {
    return normalize(vec3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t));
  }
  if (d < -0.9995) {
    // Dead opposite: any great circle will do; go over the top.
    const mid = normalize(vec3(-a.y, a.x, 0.5));
    return t < 0.5 ? slerpDir(a, mid, t * 2) : slerpDir(mid, b, t * 2 - 1);
  }
  const th = Math.acos(d);
  const sin = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / sin;
  const wb = Math.sin(t * th) / sin;
  return vec3(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb);
}

/**
 * Has the view jumped by more than `deg` between two readings? A cheap test —
 * how far the forward and the up edge each turned — for the renderer to run on
 * every sensor event, where the exact angle of the turn is not needed.
 */
export function viewJumped(a: SkyView, b: SkyView, deg: number): boolean {
  const c = Math.cos(deg * DEG);
  return dot(a.forward, b.forward) < c || dot(a.up, b.up) < c;
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

/**
 * A compass correction bigger than this is not jitter: the sky is being
 * re-aimed, and the settle spinner says so until it is back within
 * `CALIBRATED_DEG`.
 */
const CALIBRATING_DEG = 6;
const CALIBRATED_DEG = 2;
/** How long the window waits for a first reading before it stops saying so. */
const FIRST_READING_MS = 1500;

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

/** Where north came from, for the devtool. */
export type ViewSource =
  | "absolute"   // Chrome's deviceorientationabsolute
  | "flagged"    // deviceorientation with absolute: true (Firefox)
  | "webkit"     // relative alpha + webkitCompassHeading
  | "anchored"   // no compass: the first reading anchored to the stage
  | "simulated"  // the devtool's hand
  | "none";

/** What the sensor has been saying, raw — the devtool's Motion fold. */
export interface MotionDiagnostics {
  source: ViewSource;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  /** WebKit's own heading and its accuracy (± degrees; −1 when uncalibrated). */
  compassHeading: number | null;
  compassAccuracy: number | null;
  /** The rotation applied to alpha to reach north (WebKit, or the anchor), degrees. */
  offsetDeg: number | null;
  /** Events per second, smoothed. */
  rateHz: number;
  screenAngle: number;
  /** A correction is in flight (see CALIBRATING_DEG), or no reading has come yet. */
  calibrating: boolean;
}

function freshDiag(): MotionDiagnostics {
  return {
    source: "none",
    alpha: null,
    beta: null,
    gamma: null,
    compassHeading: null,
    compassAccuracy: null,
    offsetDeg: null,
    rateHz: 0,
    screenAngle: 0,
    calibrating: false,
  };
}

const diag = freshDiag();
let eventAt = 0;
let firstReadingTimer = 0;

function setCalibrating(on: boolean) {
  if (diag.calibrating === on) return;
  diag.calibrating = on;
  holdSettle("compass", on);
}

/** Note an event: its angles, its source, and the rate they arrive at. */
function note(
  source: ViewSource,
  angles: { alpha: number; beta: number; gamma: number },
  screenAngle: number
) {
  const t = performance.now();
  if (eventAt > 0) {
    const dt = Math.max(1, t - eventAt);
    diag.rateHz += (1000 / dt - diag.rateHz) * 0.1;
  }
  eventAt = t;
  diag.source = source;
  diag.alpha = angles.alpha;
  diag.beta = angles.beta;
  diag.gamma = angles.gamma;
  diag.screenAngle = screenAngle;
  // A reading has come: the wait for one is over. A WebKit correction below
  // may raise it again.
  if (firstReadingTimer) {
    window.clearTimeout(firstReadingTimer);
    firstReadingTimer = 0;
    if (source !== "webkit") setCalibrating(false);
  }
}

/** An angle in radians, wrapped to −π..π. */
export function wrapPi(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function publish(raw: SkyView) {
  const now = performance.now();
  const dt = Math.min((now - lastAt) / 1000, 1);
  lastAt = now;
  if (!latest) {
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
  const screenAngle = readScreenAngle();
  note("absolute", angles, screenAngle);
  publish(viewFromOrientation(angles.alpha, angles.beta, angles.gamma, screenAngle, true));
}

function onRelative(event: DeviceOrientationEvent) {
  if (simulated) return;
  // Chrome's absolute stream is running: that one is the truth, this one is not.
  if (absoluteAt > 0 && performance.now() - absoluteAt < ABSOLUTE_FRESH_MS) return;
  const angles = readAngles(event);
  if (!angles) return;
  const screenAngle = readScreenAngle();

  if (event.absolute) {
    note("flagged", angles, screenAngle);
    publish(viewFromOrientation(angles.alpha, angles.beta, angles.gamma, screenAngle, true));
    return;
  }

  const heading = (event as CompassEvent).webkitCompassHeading;
  const accuracy = (event as CompassEvent).webkitCompassAccuracy;
  const compassed = typeof heading === "number" && Number.isFinite(heading);
  // An accuracy of −1 is WebKit's compass saying it has lost its calibration —
  // common in the first seconds after the sensor starts, and near metal. Once
  // there is an offset, such a reading keeps it rather than falling back to the
  // anchor: the two can be half the sky apart, and a stream that flickered
  // between them made the window turn back and forth without ever arriving.
  if (compassed && (accuracy ?? 0) < 0 && !Number.isNaN(compassOffset)) {
    note("webkit", angles, screenAngle);
    diag.compassHeading = heading;
    diag.compassAccuracy = accuracy ?? null;
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
  if (compassed && (accuracy ?? 0) >= 0) {
    note("webkit", angles, screenAngle);
    diag.compassHeading = heading;
    diag.compassAccuracy = typeof accuracy === "number" ? accuracy : null;
    // Where the top edge points by the relative alpha, against where the
    // compass says it points: the difference is the rotation between WebKit's
    // arbitrary frame and north. It only means something while the top edge
    // lies level enough to point anywhere.
    // The device's own top edge in the relative frame is R's second column,
    // (−sin α·cos β, cos α·cos β, sin β): its level part is all this needs.
    const a = angles.alpha * DEG;
    const cb = Math.cos(angles.beta * DEG);
    const topX = -Math.sin(a) * cb;
    const topY = Math.cos(a) * cb;
    const level = Math.hypot(topX, topY);
    if (level > COMPASS_LEVEL_MIN || Number.isNaN(compassOffset)) {
      const relHeading = Math.atan2(topX, topY);
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
      // How far the offset still has to go: a big gap is the sky being
      // re-aimed, and that is worth the spinner until it has closed.
      const gap = Math.abs(wrapPi(measured - compassOffset)) / DEG;
      if (gap > CALIBRATING_DEG) setCalibrating(true);
      else if (gap < CALIBRATED_DEG) setCalibrating(false);
    } else {
      // Held too steeply to measure — the phone raised to the sky, which is
      // what the window is for. No correction can land until it comes back
      // down, so there is nothing to wait for; a spinner held up here would
      // spin for as long as the visitor kept looking.
      setCalibrating(false);
    }
    diag.offsetDeg = compassOffset / DEG;
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
  note("anchored", angles, screenAngle);
  if (Number.isNaN(anchorOffset)) {
    const rel = viewFromOrientation(angles.alpha, angles.beta, angles.gamma, screenAngle, false);
    const relHeading = Math.atan2(rel.forward.x, rel.forward.y);
    anchorOffset = wrapPi(relHeading - anchorHeading * DEG);
  }
  diag.offsetDeg = anchorOffset / DEG;
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
    // Until the first reading, the window is looking where the stage did and
    // is about to turn: say so — but not for ever, on a device that has no
    // sensor to send one.
    if (!simulated) {
      setCalibrating(true);
      firstReadingTimer = window.setTimeout(() => {
        firstReadingTimer = 0;
        setCalibrating(false);
      }, FIRST_READING_MS);
    }
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
      window.clearTimeout(firstReadingTimer);
      firstReadingTimer = 0;
      setCalibrating(false);
      eventAt = 0;
      Object.assign(diag, freshDiag());
    }
  };
}

/** The sensor's own story, for the devtool. A copy; poll it. */
export function readMotionDiagnostics(): MotionDiagnostics {
  return { ...diag, source: simulated ? "simulated" : diag.source };
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
  if (view) {
    setCalibrating(false);
    for (const listener of listeners) listener(view);
  }
}
