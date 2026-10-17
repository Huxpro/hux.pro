/**
 * Results stamped with the intent values they were made under. A layout a model wrote, a picture
 * it generated: kept, with `under` = the values it was told (path → value), and shown only while
 * every one of them still holds. None is thrown away: decide something and the old one is no
 * longer shown; undo it and it is back.
 */
import type { Read } from './render';

export type Stamped<R> = { value: R; under: Record<string, unknown> };

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** The values a render went on, for the intents whose path starts with `prefix`: what to stamp a result with. */
export function under(reads: Read[], prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const r of reads) if (r.path.startsWith(prefix) && r.by !== 'unknown') out[r.path] = r.value;
  return out;
}

/**
 * Why a stamped result does not hold for this render: the paths whose value moved, or that are no
 * longer read at all (the structure it was made for is gone). Empty: it holds.
 */
export function stale(s: Pick<Stamped<unknown>, 'under'>, reads: Read[]): string[] {
  const now = new Map(reads.map((r) => [r.path, r.value]));
  return Object.entries(s.under)
    .filter(([p, v]) => !now.has(p) || !same(now.get(p), v))
    .map(([p]) => p);
}

export function createCache<R>() {
  const entries: Stamped<R>[] = [];
  return {
    put(value: R, stampedUnder: Record<string, unknown>) {
      entries.unshift({ value, under: stampedUnder });
    },
    /** The newest result that still holds for this render. */
    get(reads: Read[]): Stamped<R> | undefined {
      return entries.find((e) => !stale(e, reads).length);
    },
    get size() {
      return entries.length;
    },
  };
}
