/**
 * Procedural Audio Engine for the Nightmare Experience.
 * Uses Web Audio API to synthesize heartbeats, wooden door creaks, sub-drones,
 * and sudden awakening gasps with zero external sound files.
 */

class NightmareAudio {
  private ctx: AudioContext | null = null;
  private droneGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private heartbeatTimer: number | null = null;
  private isMuted: boolean = false;
  private activeBpm: number = 60;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      if (this.droneGain && this.ctx) {
        this.droneGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /** Start ambient sub-bass ominous drone */
  public startDrone(intensity = 0.35) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (!this.droneGain) {
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(Math.max(0.001, intensity * 0.4), ctx.currentTime + 1.5);

      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(42, ctx.currentTime);

      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(43.5, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(120, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(master);
      master.connect(ctx.destination);

      osc1.start();
      osc2.start();

      this.droneGain = master;
      this.droneOsc1 = osc1;
      this.droneOsc2 = osc2;
    } else {
      this.droneGain.gain.cancelScheduledValues(ctx.currentTime);
      this.droneGain.gain.exponentialRampToValueAtTime(
        Math.max(0.001, intensity * 0.4),
        ctx.currentTime + 0.5
      );
    }
  }

  /** Synthesize a single realistic muffled heartbeat (lub-dub) */
  private triggerHeartbeatPulse(intensity = 0.6) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First thump ("lub")
    this.playThump(now, 58, 28, 0.12, intensity * 0.85);

    // Second thump ("dub") 220ms later
    this.playThump(now + 0.22, 52, 24, 0.1, intensity * 0.65);
  }

  private playThump(time: number, startFreq: number, endFreq: number, duration: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = "sine";
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(140, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  /** Start or update the heartbeat cycle at a given BPM */
  public setHeartbeatBpm(bpm: number, intensity = 0.6) {
    this.activeBpm = bpm;
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (bpm <= 0) return;

    // Trigger one immediately
    this.triggerHeartbeatPulse(intensity);

    const intervalMs = (60 / bpm) * 1000;
    this.heartbeatTimer = window.setInterval(() => {
      this.triggerHeartbeatPulse(intensity);
    }, intervalMs);
  }

  public stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Synthesize an eerie slow wooden door creak */
  public playDoorCreak(duration = 1.2) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // FM Modulator for rough wooden friction
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();

    mod.type = "sawtooth";
    mod.frequency.setValueAtTime(45, now);
    mod.frequency.linearRampToValueAtTime(25, now + duration);

    modGain.gain.setValueAtTime(180, now);
    modGain.gain.linearRampToValueAtTime(60, now + duration);

    mod.connect(modGain);
    modGain.connect(osc.frequency);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + duration);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(380, now);
    filter.frequency.linearRampToValueAtTime(220, now + duration);
    filter.Q.setValueAtTime(6, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    mod.start(now);
    osc.start(now);
    mod.stop(now + duration);
    osc.stop(now + duration);
  }

  /** Sudden waking gasp / gasp of relief mixed with horror */
  public playWakeGasp() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Drop drone quickly
    if (this.droneGain) {
      this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, ctx.currentTime);
      this.droneGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    }
    this.stopHeartbeat();

    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.45);
    filter.Q.setValueAtTime(3, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
  }

  /** Subtle, terrifying latch click when the real closet door starts opening */
  public playRealLatch() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Tiny click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);

    // Deep quiet breath drone fading in
    this.startDrone(0.2);
  }

  public stopAll() {
    this.stopHeartbeat();
    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, this.ctx.currentTime);
      this.droneGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    }
  }
}

export const sound = new NightmareAudio();
