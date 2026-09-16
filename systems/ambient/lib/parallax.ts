// =============================================================================
// Wallpaper parallax — the tilt easter egg.
//
// Off by default, and never discovered by accident: the wallpaper only starts
// answering to the device once someone turns `wallpaperParallax` on, from the
// devtool's Wallpaper module or by searching the command palette for it.
//
// It cannot arm itself. iOS 13 put `deviceorientation` behind
// `DeviceOrientationEvent.requestPermission()`, which only resolves when it is
// called inside a user gesture — so there is no "just switch it on for
// everyone" path, and a toggle the visitor taps is both the permission prompt
// and the consent. Android fires the events with no prompt at all, but a
// wallpaper that moves on one platform and not the other is worse than one
// that waits to be asked.
//
// A desktop has no gyroscope, and Chrome defines `DeviceOrientationEvent`
// there anyway — so support is decided by whether an event actually arrives,
// not by what exists on `window`. When none does, the pointer drives the same
// offsets, which is what makes the easter egg checkable without a phone.
//
// Everything below the React layer writes styles straight to the element on a
// rAF, the way `fixedBgTracker` does: sixty tilt readings a second must not be
// sixty renders a second.
// =============================================================================

/**
 * How far the wallpaper travels per axis, in `vmin` — the same number of
 * pixels sideways as up and down, which a percentage of the viewport would
 * not give on a tall phone.
 */
const PARALLAX_AMPLITUDE_VMIN = 3;

/**
 * The layer is scaled up so the travel never uncovers an edge: 3.5% of slack
 * on each side of each axis, against 3vmin of travel. `vmin` is at most the
 * smaller side, so the slack wins on both axes in either orientation — which
 * is what makes one constant safe for every viewport.
 */
const PARALLAX_SCALE = 1.07;

/** The tilt, in degrees from where the device was when it started, that reaches full travel. */
const PARALLAX_MAX_TILT_DEG = 22;

/** Smoothing time constant, ms. Low enough to feel attached, high enough to swallow sensor noise. */
const PARALLAX_TAU_MS = 140;

/** No `deviceorientation` event within this long means there is no gyroscope here. */
const GYRO_PROBE_MS = 2000;

/** Below this much movement (in `vmin`) the loop has nothing left to do. */
const SETTLE_EPSILON = 0.002;

/**
 * What the wallpaper is listening to.
 *
 *   gyro    — device orientation, the point of the thing
 *   pointer — no gyroscope answered, so the mouse stands in
 *   none    — nothing is driving it (reduced motion, or not started)
 */
export type ParallaxSource = "gyro" | "pointer" | "none";

/**
 * Where the browser stands on motion access.
 *
 *   unsupported — no `DeviceOrientationEvent` at all
 *   ready       — events need no prompt here (Android, desktop)
 *   prompt      — iOS, and we have not been granted yet
 *   granted     — iOS, and we have
 *   denied      — iOS, and the visitor said no
 */
export type ParallaxPermission =
  | "unsupported"
  | "ready"
  | "prompt"
  | "granted"
  | "denied";

type RequestPermission = () => Promise<"granted" | "denied">;

function orientationEventClass(): (typeof DeviceOrientationEvent) | null {
  if (typeof window === "undefined") return null;
  return "DeviceOrientationEvent" in window ? window.DeviceOrientationEvent : null;
}

/** The iOS 13+ gate, when this browser has one. */
function permissionRequester(): RequestPermission | null {
  const ctor = orientationEventClass() as
    | (typeof DeviceOrientationEvent & { requestPermission?: RequestPermission })
    | null;
  return typeof ctor?.requestPermission === "function"
    ? ctor.requestPermission.bind(ctor)
    : null;
}

/** Whether the event type exists here. It says nothing about a sensor being behind it. */
function supportsDeviceOrientation(): boolean {
  return orientationEventClass() !== null;
}

/** Whether turning this on has to go through a permission prompt. */
function parallaxNeedsPermission(): boolean {
  return permissionRequester() !== null;
}

/** The starting permission state, before anything has been asked. */
export function initialParallaxPermission(): ParallaxPermission {
  if (!supportsDeviceOrientation()) return "unsupported";
  return parallaxNeedsPermission() ? "prompt" : "ready";
}

/**
 * Ask for motion access.
 *
 * MUST be called synchronously from a user gesture on iOS — no `await` may run
 * before it, or WebKit treats the gesture as spent and rejects. Every caller
 * here is a click handler that reaches this on its first statement.
 */
export async function requestParallaxPermission(): Promise<ParallaxPermission> {
  const request = permissionRequester();
  if (!request) return initialParallaxPermission();
  try {
    return (await request()) === "granted" ? "granted" : "denied";
  } catch {
    // WebKit rejects rather than resolving when there is no live gesture. That
    // is not a refusal — the next tap can ask again.
    return "prompt";
  }
}

export interface ParallaxOffset {
  /** Travel per axis, in `vmin`, already clamped to the amplitude. */
  x: number;
  y: number;
  /**
   * The zoom that buys the travel its slack. It rides the same smoothing as the
   * offsets so switching the egg on eases into the crop instead of popping.
   */
  scale: number;
}

interface ParallaxDriverOptions {
  /** Hold still, but stay switched on, for `prefers-reduced-motion`. */
  reducedMotion?: boolean;
  /** Called when the source or the permission changes — for the devtool readout. */
  onStatus?: (status: { source: ParallaxSource; permission: ParallaxPermission }) => void;
}

function wrapDegrees(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

function clamp(n: number, min: number, max: number): number {
  return n < min ? min : n > max ? max : n;
}

/**
 * ParallaxDriver — one element, one set of listeners, one rAF.
 *
 * It owns the transform on the wallpaper layer for as long as it runs and puts
 * it back on `destroy()`, so nothing else has to know the layer can move.
 */
export class ParallaxDriver {
  private el: HTMLElement;
  private reducedMotion: boolean;
  private onStatus?: ParallaxDriverOptions["onStatus"];

  private source: ParallaxSource = "none";
  private permission: ParallaxPermission = "unsupported";

  /** Target and current offsets, in `vmin`, plus the zoom. */
  private target: ParallaxOffset = { x: 0, y: 0, scale: 1 };
  private current: ParallaxOffset = { x: 0, y: 0, scale: 1 };

  /** The attitude the device had when it started — parallax is relative to it. */
  private origin: { beta: number; gamma: number } | null = null;

  private rafId = 0;
  private lastFrameMs = 0;
  private probeId = 0;
  private gestureRetryArmed = false;
  private running = false;

  constructor(el: HTMLElement, options: ParallaxDriverOptions = {}) {
    this.el = el;
    this.reducedMotion = options.reducedMotion ?? false;
    this.onStatus = options.onStatus;
    this.permission = initialParallaxPermission();
  }

  /**
   * Start listening. `permission` is what the caller's gesture already
   * established, when it had one; without it the driver asks for itself and
   * falls back to the first tap on the page if WebKit turns it down.
   *
   * Calling it again with a permission that has moved on — a prompt answered
   * mid-session — re-picks the source without dropping the offsets, so the
   * wallpaper hands over from the pointer to the gyroscope mid-drift.
   */
  start(permission?: ParallaxPermission) {
    const next = permission ?? this.permission;
    if (this.running) {
      if (next === this.permission) return;
      this.teardownListeners();
      this.setSource("none");
    }
    this.running = true;
    this.el.style.willChange = "transform";
    this.target = { x: 0, y: 0, scale: this.restScale() };
    this.schedule();
    this.setPermission(next);

    // `prefers-reduced-motion` keeps the switch on and the wallpaper still —
    // there is nothing worth listening for, so nothing is listened for.
    if (this.reducedMotion) return;

    if (this.permission === "granted" || this.permission === "ready") {
      this.listenToGyro();
    } else if (this.permission === "prompt") {
      // Reloading a page that had this on lands here: the setting survived, the
      // grant did not, and asking needs a gesture. The next tap is that gesture.
      this.armGestureRetry();
      this.usePointer();
    } else {
      this.usePointer();
    }
  }

  /**
   * Stop listening and ease back out of the crop — switching the egg off is a
   * glide, not a snap. The element stays ours until `destroy`; `write` drops
   * the transform altogether once it lands.
   */
  stop() {
    if (!this.running) return;
    this.running = false;
    this.teardownListeners();
    this.origin = null;
    this.target = { x: 0, y: 0, scale: 1 };
    // Ease back to centre and out of the crop rather than snapping; the loop
    // stops once it lands, and `write` drops the transform entirely there.
    this.schedule();
    this.setSource("none");
  }

  destroy() {
    this.running = false;
    this.teardownListeners();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.el.style.transform = "";
    this.el.style.willChange = "";
  }

  /** Re-centre on the current attitude — what "hold it however you like" means. */
  recenter() {
    this.origin = null;
  }

  // --- sources -------------------------------------------------------------

  private listenToGyro() {
    window.addEventListener("deviceorientation", this.onOrientation);
    window.addEventListener("orientationchange", this.onRecenter);
    document.addEventListener("visibilitychange", this.onRecenter);
    // A `DeviceOrientationEvent` that exists but never fires is a desktop.
    this.probeId = window.setTimeout(() => {
      this.probeId = 0;
      if (this.source !== "gyro") this.usePointer();
    }, GYRO_PROBE_MS);
  }

  private usePointer() {
    if (this.source === "pointer") return;
    window.addEventListener("pointermove", this.onPointerMove, { passive: true });
    window.addEventListener("pointerleave", this.onRecenter);
    this.setSource("pointer");
  }

  private stopPointer() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerleave", this.onRecenter);
  }

  private teardownListeners() {
    window.removeEventListener("deviceorientation", this.onOrientation);
    window.removeEventListener("orientationchange", this.onRecenter);
    document.removeEventListener("visibilitychange", this.onRecenter);
    this.stopPointer();
    this.disarmGestureRetry();
    if (this.probeId) window.clearTimeout(this.probeId);
    this.probeId = 0;
  }

  /**
   * iOS only: retry the permission request inside the first tap on the page.
   * The visitor already asked for this — the prompt is the follow-through, not
   * a surprise — and one listener that removes itself costs nothing.
   */
  private armGestureRetry() {
    if (this.gestureRetryArmed) return;
    this.gestureRetryArmed = true;
    window.addEventListener("pointerdown", this.onFirstGesture, { once: true, capture: true });
  }

  private disarmGestureRetry() {
    if (!this.gestureRetryArmed) return;
    this.gestureRetryArmed = false;
    window.removeEventListener("pointerdown", this.onFirstGesture, { capture: true });
  }

  private onFirstGesture = () => {
    this.gestureRetryArmed = false;
    if (!this.running) return;
    void requestParallaxPermission().then((permission) => {
      if (!this.running) return;
      this.setPermission(permission);
      if (permission === "granted") {
        this.stopPointer();
        this.recenter();
        this.listenToGyro();
      } else if (permission === "prompt") {
        // Still no live gesture as far as WebKit is concerned — nothing was
        // shown and nothing was refused, so the next tap may as well try.
        this.armGestureRetry();
      }
    });
  };

  // --- readings ------------------------------------------------------------

  private onOrientation = (event: DeviceOrientationEvent) => {
    const { beta, gamma } = event;
    if (beta === null || gamma === null) return;

    // The first reading that arrives proves there is a sensor, and cancels the
    // pointer stand-in that was covering for its absence.
    if (this.source !== "gyro") {
      if (this.probeId) window.clearTimeout(this.probeId);
      this.probeId = 0;
      this.stopPointer();
      this.setSource("gyro");
    }

    if (!this.origin) this.origin = { beta, gamma };

    // Screen rotation, not device rotation: beta/gamma are axes of the device,
    // and in landscape the one that reads "left-right" has moved.
    const angle = (window.screen?.orientation?.angle ?? 0) * (Math.PI / 180);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const dBeta = wrapDegrees(beta - this.origin.beta);
    const dGamma = wrapDegrees(gamma - this.origin.gamma);
    const tiltX = dGamma * cos + dBeta * sin;
    const tiltY = dBeta * cos - dGamma * sin;

    this.setTarget(tiltX / PARALLAX_MAX_TILT_DEG, tiltY / PARALLAX_MAX_TILT_DEG);
  };

  private onPointerMove = (event: PointerEvent) => {
    // A finger dragging the page is scrolling, not aiming; only a mouse stands
    // in for a gyroscope.
    if (event.pointerType !== "mouse") return;
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    this.setTarget((event.clientX / w) * 2 - 1, (event.clientY / h) * 2 - 1);
  };

  private onRecenter = () => {
    this.origin = null;
    this.target = { x: 0, y: 0, scale: this.restScale() };
    this.schedule();
  };

  /** The zoom to hold while running: none under reduced motion, none when stopped. */
  private restScale(): number {
    return this.running && !this.reducedMotion ? PARALLAX_SCALE : 1;
  }

  /** `nx`/`ny` in roughly [-1, 1]: tilt right, and the wallpaper slides left. */
  private setTarget(nx: number, ny: number) {
    if (this.reducedMotion) return;
    this.target = {
      x: -clamp(nx, -1, 1) * PARALLAX_AMPLITUDE_VMIN,
      y: -clamp(ny, -1, 1) * PARALLAX_AMPLITUDE_VMIN,
      scale: PARALLAX_SCALE,
    };
    this.schedule();
  }

  // --- the loop ------------------------------------------------------------

  private schedule() {
    if (this.rafId) return;
    this.lastFrameMs = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.rafId = 0;
    // Frame-rate independent smoothing: the same 140ms whether this is a 60Hz
    // phone or a 120Hz one.
    const dt = this.lastFrameMs ? Math.min(now - this.lastFrameMs, 100) : 16;
    this.lastFrameMs = now;
    const k = 1 - Math.exp(-dt / PARALLAX_TAU_MS);

    const dx = this.target.x - this.current.x;
    const dy = this.target.y - this.current.y;
    const ds = this.target.scale - this.current.scale;
    this.current = {
      x: this.current.x + dx * k,
      y: this.current.y + dy * k,
      scale: this.current.scale + ds * k,
    };

    const settled =
      Math.abs(dx) < SETTLE_EPSILON &&
      Math.abs(dy) < SETTLE_EPSILON &&
      Math.abs(ds) < SETTLE_EPSILON;
    if (settled) this.current = { ...this.target };

    this.write();
    if (!settled) this.rafId = requestAnimationFrame(this.frame);
  };

  private write() {
    const { x, y, scale } = this.current;
    if (x === 0 && y === 0 && scale === 1) {
      // Nothing to compose — switched off, or on but held still by reduced
      // motion. Leave no trace: an idle `will-change: transform` on a
      // full-page background is a compositor layer nobody asked for.
      this.el.style.transform = "";
      this.el.style.willChange = "";
      return;
    }
    // Scale first, then translate: the offsets are resolved against the box as
    // laid out, which is what makes the slack arithmetic above hold.
    this.el.style.transform =
      `translate3d(${x.toFixed(3)}vmin, ${y.toFixed(3)}vmin, 0) scale(${scale.toFixed(4)})`;
  }

  private setSource(source: ParallaxSource) {
    if (this.source === source) return;
    this.source = source;
    this.onStatus?.({ source, permission: this.permission });
  }

  private setPermission(permission: ParallaxPermission) {
    if (this.permission === permission) return;
    this.permission = permission;
    this.onStatus?.({ source: this.source, permission });
  }
}
