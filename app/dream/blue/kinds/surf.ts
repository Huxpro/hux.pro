import { kind, type Rng } from "stage";

// The sea heard: brown noise through a lowpass, swelling slowly, up in the
// phases it is given and away out of them. A node with no shape. Its context
// is made inside the press that opens the sea, which browsers count as the
// gesture audio needs.

type Surf = { level(v: number, seconds: number): void; close(): void };

function createSurf(rng: Rng): Surf | null {
  try {
    const ac = new AudioContext();
    const len = ac.sampleRate * 2;
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    // Brown noise: softer than white, closer to water.
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (rng() * 2 - 1)) / 1.02;
      data[i] = last * 3.5;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const swell = ac.createGain();
    swell.gain.value = 0.7;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.18;
    const lfoDepth = ac.createGain();
    lfoDepth.gain.value = 0.3;
    lfo.connect(lfoDepth).connect(swell.gain);
    const out = ac.createGain();
    out.gain.value = 0;
    src.connect(filter).connect(swell).connect(out).connect(ac.destination);
    src.start();
    lfo.start();
    return {
      level(v, seconds) {
        const now = ac.currentTime;
        out.gain.cancelScheduledValues(now);
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.linearRampToValueAtTime(v, now + seconds);
      },
      close: () => void ac.close().catch(() => {}),
    };
  } catch {
    // No audio: the sea is still there to see.
    return null;
  }
}

type SurfProps = {
  /** The phases it sounds in. */
  in: string[];
  /** How loud, how long it takes to swell, and to fade, s. */
  volume: number;
  rise: number;
  fall: number;
};

export const SurfSound = kind<SurfProps, { surf: Surf | null; on: boolean }, true>({
  name: "SurfSound",
  kind: "sound",
  names: ["surf", "the sound", "潮声"],
  intent: "The sea heard: swelling slowly while it is open, away when it closes.",
  source: "app/dream/blue/kinds/surf.ts",
  backend: "none",
  params: { volume: { range: [0, 1] }, rise: { unit: "s" }, fall: { unit: "s" } },

  init: () => ({ surf: null, on: false }),
  frame: () => true,
  enter(s, p, phase, { rng }) {
    const on = p.in.includes(phase);
    if (on && !s.surf) s.surf = createSurf(rng);
    if (on !== s.on) s.surf?.level(on ? p.volume : 0, on ? p.rise : p.fall);
    s.on = on;
  },
  dispose: (s) => s.surf?.close(),
  inspect: (s) => ({ playing: s.on }),
});
