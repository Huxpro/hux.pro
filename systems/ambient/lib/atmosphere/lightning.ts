/** One shared event drives both the illuminated cloud volume and the sharp bolt.
 * Storm-local time makes the first event visible shortly after choosing Thunder. */
export interface LightningFrame {
  strength: number;
  bolt: number;
  x: number;
  y: number;
  seed: number;
}
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function lightningAt(time: number, enabled: boolean): LightningFrame {
  const cycle = Math.floor(Math.max(0, time) / 13);
  const start = cycle === 0 ? 1.6 : 1.4 + hash(cycle) * 3;
  const age = time - cycle * 13 - start;
  const pulse = (offset: number, duration: number) => {
    const t = (age - offset) / duration;
    return t > 0 && t < 1 ? Math.sin(Math.PI * t) ** 0.6 : 0;
  };
  const bolt = enabled ? Math.max(pulse(0, 0.24), pulse(0.34, 0.2) * 0.72) : 0;
  const afterglow = enabled && age > 0 && age < 1.3 ? Math.exp(-age * 3.5) * 0.28 : 0;
  return { strength: Math.max(bolt * 0.85, afterglow), bolt, x: 0.57 + hash(cycle + 8) * 0.26, y: 0.22, seed: cycle + 17 };
}
