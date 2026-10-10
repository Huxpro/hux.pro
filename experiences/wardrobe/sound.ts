// =============================================================================
// Sound: made here, nothing to download, and only after the first touch.
//
// The dream has a low chord a little out of tune; waking has a room with a
// clock in it. In between: a heart, a gasp, breath, a hinge. Carried over from
// the hand-written page as it was; the director decides when.
// =============================================================================

export class Sound {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private room: GainNode | null = null;
  private pad: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private beatTimer = 0;
  private tock = false;
  muted: boolean;

  constructor() {
    let muted = false;
    try {
      muted = sessionStorage.getItem("dream-muted") === "1";
    } catch {}
    this.muted = muted;
  }

  /** Start the audio graph (inside a user gesture). */
  ensure(dream: boolean): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const master = (this.master = ctx.createGain());
    master.gain.value = this.muted ? 0 : 0.9;
    master.connect(ctx.destination);

    // Room tone: brown noise under a low lid.
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 260;
    const room = (this.room = ctx.createGain());
    room.gain.value = 0;
    room.gain.linearRampToValueAtTime(dream ? 0.22 : 0.1, ctx.currentTime + 2);
    src.connect(lp).connect(room).connect(master);
    src.start();

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    // The dream's chord.
    const pad = (this.pad = ctx.createGain());
    pad.gain.value = 0;
    const padLp = ctx.createBiquadFilter();
    padLp.type = "lowpass";
    padLp.frequency.value = 420;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.13;
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(padLp.frequency);
    lfo.start();
    [55, 82.6, 110.9, 164.2].forEach((f, i) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = i % 2 ? "triangle" : "sine";
      o.frequency.value = f;
      og.gain.value = [0.5, 0.25, 0.22, 0.08][i];
      o.connect(og).connect(padLp);
      o.start();
    });
    padLp.connect(pad).connect(master);
    if (dream) pad.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 2.5);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      sessionStorage.setItem("dream-muted", muted ? "1" : "0");
    } catch {}
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }

  roomTo(level: number, tc = 0.3): void {
    if (this.ctx && this.room) this.room.gain.setTargetAtTime(level, this.ctx.currentTime, tc);
  }

  padTo(level: number, tc = 0.8): void {
    if (this.ctx && this.pad) this.pad.gain.setTargetAtTime(level, this.ctx.currentTime, tc);
  }

  /** Everything the dream was making, stopped dead. */
  hush(): void {
    if (!this.ctx) return;
    for (const g of [this.room, this.pad]) {
      if (!g) continue;
      g.gain.cancelScheduledValues(this.ctx.currentTime);
      g.gain.setValueAtTime(0, this.ctx.currentTime);
    }
    this.heartbeat(false);
  }

  thump(strength: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    for (const [dt, k] of [[0, 1], [0.17, 0.6]] as const) {
      const t = ctx.currentTime + 0.01 + delay + dt;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(70, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(strength * k, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.3);
    }
  }

  /** A steady heart while the eyes are shut in the dream. */
  heartbeat(on: boolean, rate = 0.8): void {
    clearTimeout(this.beatTimer);
    if (!on || !this.ctx) return;
    const beat = () => {
      this.thump(0.9);
      if (navigator.vibrate) navigator.vibrate([22, 140, 14]);
      this.beatTimer = window.setTimeout(beat, rate * 1000);
    };
    beat();
  }

  /** A low swell under the moment the eyes open on him. */
  dread(level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 + 0.14 * level, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
    g.connect(this.master);
    [41, 41.7, 61.5 + level * 3].forEach((f, i) => {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.type = i === 2 ? "triangle" : "sine";
      o.frequency.value = f;
      og.gain.value = i === 2 ? 0.25 : 0.6;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 3.8);
    });
    if (level >= 2) {
      const o = ctx.createOscillator();
      const og = ctx.createGain();
      o.frequency.setValueAtTime(1760, t);
      o.frequency.linearRampToValueAtTime(1810, t + 3);
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.012, t + 1.2);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      o.connect(og).connect(this.master);
      o.start(t);
      o.stop(t + 3.5);
    }
  }

  /** A hinge: stick and slip, clicks through a resonant body. */
  creak(duration: number, level = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = ctx.currentTime + 0.05;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 9;
    bp.frequency.setValueAtTime(520, t0);
    bp.frequency.linearRampToValueAtTime(760, t0 + duration * 0.55);
    bp.frequency.linearRampToValueAtTime(610, t0 + duration);
    const g = ctx.createGain();
    g.gain.value = 1.4 * level;
    bp.connect(g).connect(this.master);
    const click = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.004), ctx.sampleRate);
    const cd = click.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / cd.length);
    let t = t0;
    while (t < t0 + duration) {
      const u = (t - t0) / duration;
      const s = ctx.createBufferSource();
      const sg = ctx.createGain();
      s.buffer = click;
      sg.gain.value = 0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, u * 1.2));
      s.connect(sg).connect(bp);
      s.start(t);
      t += 0.007 + 0.016 * u + Math.random() * 0.012 + (Math.random() < 0.05 ? 0.09 : 0);
    }
  }

  private air(t: number, o: { type?: BiquadFilterType; f0: number; f1: number; q?: number; peak: number; attack: number; dur: number }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? "bandpass";
    f.Q.value = o.q ?? 0.8;
    f.frequency.setValueAtTime(o.f0, t);
    f.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.peak, t + o.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random());
    s.stop(t + o.dur + 0.05);
  }

  gasp(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.air(t, { f0: 700, f1: 2300, q: 1.1, peak: 0.55, attack: 0.07, dur: 0.5 });
    this.air(t + 0.02, { type: "lowpass", f0: 500, f1: 900, peak: 0.25, attack: 0.05, dur: 0.4 });
    this.thump(0.9, 0.04);
  }

  breathe(inhale: boolean, amp: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (inhale) this.air(t, { f0: 900, f1: 1500, q: 0.9, peak: 0.16 * amp + 0.02, attack: 0.18, dur: 0.42 });
    else this.air(t, { type: "lowpass", f0: 1100, f1: 450, peak: 0.2 * amp + 0.025, attack: 0.05, dur: 0.6 + 0.4 * (1 - amp) });
  }

  /** A clock somewhere in the house: what a real night sounds like. */
  tick(level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    this.tock = !this.tock;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    o.type = "square";
    o.frequency.value = this.tock ? 2350 : 2650;
    bp.type = "bandpass";
    bp.frequency.value = this.tock ? 2400 : 2800;
    bp.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * level, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(bp).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.04);
  }
}
