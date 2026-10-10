import { kind } from "stage";

// The sound of the globe going quiet: one warm note, when the scene enters
// the phase it is given. A node with no shape, so the inspector can still
// name it.

/** A single warm note, the sound of the globe going quiet. */
function chime() {
  try {
    const ac = new AudioContext();
    const now = ac.currentTime;
    for (const [freq, gain] of [
      [523.25, 0.05],
      [783.99, 0.022],
      [1046.5, 0.01],
    ]) {
      const osc = ac.createOscillator();
      const env = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 3.4);
      osc.connect(env).connect(ac.destination);
      osc.start(now);
      osc.stop(now + 3.5);
      // The note closes its own context when it ends: nothing here keeps time but the audio clock.
      osc.onended = () => void ac.close().catch(() => {});
    }
  } catch {
    // No audio is fine; the dream is mostly quiet anyway.
  }
}

export const Chime = kind<{ at: string }, null, true>({
  name: "Chime",
  kind: "sound",
  names: ["chime", "the note", "钟声"],
  intent: "One warm note as the field goes quiet.",
  source: "app/dream/everyone/kinds/chime.ts",
  backend: "none",
  frame: () => true,
  enter(_state, { at }, phase) {
    if (phase === at) chime();
  },
});
