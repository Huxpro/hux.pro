// =============================================================================
// The clock: the one source of time in a scene.
//
// A scene is f(state, t). Nothing inside reads performance.now() or Date.now();
// it reads this. So any moment can be frozen (a still, a thumbnail, a test),
// the same moment renders the same pixels, and the inspector can scrub.
// =============================================================================

type Listener = (t: number, dt: number) => void;

export class Clock {
  private origin = 0;
  private t = 0;
  private frozen = false;
  private raf = 0;
  private last = 0;
  private readonly renders = new Set<() => void>();
  private readonly frames = new Set<Listener>();

  start(): () => void {
    this.origin = performance.now() - this.t * 1000;
    this.last = this.t;
    const tick = (now: number) => {
      if (!this.frozen) this.t = (now - this.origin) / 1000;
      const dt = Math.max(0, Math.min(0.1, this.t - this.last));
      this.last = this.t;
      for (const f of this.frames) f(this.t, dt);
      for (const r of this.renders) r();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(this.raf);
  }

  now = (): number => this.t;
  isFrozen = (): boolean => this.frozen;

  /** Hold time at t (or where it is). */
  freeze(t: number = this.t): void {
    this.t = t;
    this.frozen = true;
    this.notify();
  }

  /** Let time run again from where it is held. */
  resume(): void {
    this.origin = performance.now() - this.t * 1000;
    this.frozen = false;
  }

  /** For render subscribers (useTime): called every frame. */
  subscribe = (fn: () => void): (() => void) => {
    this.renders.add(fn);
    return () => this.renders.delete(fn);
  };

  /** For side effects (useFrame): called every frame, before renders. */
  onFrame(fn: Listener): () => void {
    this.frames.add(fn);
    return () => this.frames.delete(fn);
  }

  private notify() {
    for (const r of this.renders) r();
  }
}
