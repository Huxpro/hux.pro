/**
 * What a change of program did to the decisions a person made, from the renders before and after
 * (a model rewrote the instance file or the intent components, a guard went the other way):
 *
 *   added / removed   intents read now and not before, and the other way round
 *   kept              a decision that applied before and still does
 *   waiting           one that applied and no longer does: its intent is not read, or its kind is
 *                     not one the program has (Read.waiting). Kept in the source, not applied
 *   back              one that waited and applies again
 *
 * Nothing here writes: like `orphans`, it reports, and the decisions stay where they are.
 */
import type { Read } from '../core/index';

export interface ProgramChange {
  added: string[];
  removed: string[];
  kept: string[];
  waiting: string[];
  back: string[];
}

type Status = 'applied' | 'waiting' | 'absent';

function status(reads: readonly Read[], path: string): Status {
  const r = reads.filter((x) => x.path === path);
  if (!r.length) return 'absent';
  return r.some((x) => x.waiting !== undefined) ? 'waiting' : 'applied';
}

export function changes(before: readonly Read[], after: readonly Read[], decided: readonly string[]): ProgramChange {
  const was = new Set(before.map((r) => r.path));
  const now = new Set(after.map((r) => r.path));
  const out: ProgramChange = {
    added: [...now].filter((p) => !was.has(p)),
    removed: [...was].filter((p) => !now.has(p)),
    kept: [],
    waiting: [],
    back: [],
  };
  for (const p of decided) {
    const a = status(before, p);
    const b = status(after, p);
    if (a === 'applied' && b === 'applied') out.kept.push(p);
    else if (a === 'applied') out.waiting.push(p);
    else if (b === 'applied') out.back.push(p);
  }
  return out;
}

/** What changed between two renders, intent by intent: `path: was → is (by)`. */
export function diff(before: readonly Read[], after: readonly Read[]): string[] {
  const one = (reads: readonly Read[]) => new Map(reads.map((r) => [r.path, r]));
  const a = one(before);
  const b = one(after);
  const out: string[] = [];
  for (const p of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(p);
    const y = b.get(p);
    const v = (r: Read) => JSON.stringify(r.value ?? null);
    if (!y) out.push(`${p}: ${v(x!)} → (gone)`);
    else if (!x) out.push(`${p}: (new) → ${v(y)} (${y.by})`);
    else if (v(x) !== v(y) || x.by !== y.by) out.push(`${p}: ${v(x)} → ${v(y)} (${y.by})`);
  }
  return out;
}
