/** One shared event drives both the illuminated cloud volume and the sharp bolt.
 * Storm-local time makes the first event visible shortly after choosing Thunder. */
export interface LightningFrame {
  /** How brightly the cloud volume is lit, 0..1. */
  strength: number;
  /** How bright the channel itself is, 0..1. */
  bolt: number;
  /** Where the flash is centred, uv with y down. */
  x: number;
  y: number;
  /** Where the channel ends, uv with y down: the ground, or a clicked point. */
  toX: number;
  toY: number;
  /** Where the channel starts, if not at the flash (y, uv): the top of the sky. */
  from?: number;
  seed: number;
  /** How much of the channel has grown down from its top, 0..1. */
  grow: number;
}

export const NO_LIGHTNING: LightningFrame = { strength: 0, bolt: 0, x: 0.5, y: 0.22, toX: 0.5, toY: 0.54, seed: 0, grow: 1 };

/** How long a channel takes to reach the ground, seconds — the Sky's ~70 ms. */
const GROW_S = 0.07;
const grown = (age: number) => Math.max(0, Math.min(1, age / GROW_S));

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** A stroke and its restrike, then an afterglow in the cloud: `age` seconds in. */
function envelope(age: number) {
  const pulse = (offset: number, duration: number) => {
    const t = (age - offset) / duration;
    return t > 0 && t < 1 ? Math.sin(Math.PI * t) ** 0.6 : 0;
  };
  const bolt = Math.max(pulse(0, 0.24), pulse(0.34, 0.2) * 0.72);
  const afterglow = age > 0 && age < 1.3 ? Math.exp(-age * 3.5) * 0.28 : 0;
  return { bolt, strength: Math.max(bolt * 0.85, afterglow) };
}

export function lightningAt(time: number, enabled: boolean): LightningFrame {
  if (!enabled) return NO_LIGHTNING;
  const cycle = Math.floor(Math.max(0, time) / 13);
  const start = cycle === 0 ? 1.6 : 1.4 + hash(cycle) * 3;
  const age = time - cycle * 13 - start;
  const { bolt, strength } = envelope(age);
  const x = 0.57 + hash(cycle + 8) * 0.26;
  return { strength, bolt, x, y: 0.22, toX: x + 0.035, toY: 0.54, seed: cycle + 17, grow: grown(age) };
}

/** How long a clicked strike lives, seconds — `POKE_MS.strike`, which retires it. */
export const STRIKE_LIFE = 1.2;

/**
 * The thunder-day egg: a bolt called down onto the point that was clicked
 * (`x`, `y` in uv, y down). As in the Sky, the channel comes down from the top
 * of the sky, grows to the point in ~70 ms and lands exactly on it; the flash
 * is centred high in the volume where it leaves the cloud — the one place a
 * picture of a cloud cannot be lit from.
 */
export function strikeAt(age: number, x: number, y: number, seed: number): LightningFrame {
  if (age < 0 || age > STRIKE_LIFE) return NO_LIGHTNING;
  const { bolt, strength } = envelope(age);
  const fromX = x + (hash(seed) - 0.5) * 0.25 * Math.max(0.2, y);
  return { strength, bolt, x: fromX, y: Math.min(0.12, y * 0.4), toX: x, toY: y, seed, grow: grown(age), from: -0.02 };
}
