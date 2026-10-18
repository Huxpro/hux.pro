/**
 * What a model is shown: every intent a render read, its kinds (learned ones marked, ruled-out
 * ones crossed), the belief under it, its value now and who said so, and what was said of the
 * whole. Plain text, from the trace and nothing else.
 */
import type { Read } from '../core/index';
import { kindAbout, type About } from './vocab';

const pct = (n: number | undefined) => `${Math.round((n ?? 0) * 100)}%`;

export function observe(reads: readonly Read[], said: readonly string[] = []): string {
  const out: string[] = [];
  if (said.length) out.push(`said of the whole: ${said.map((p) => `"${p}"`).join(' · ')}`);
  const seen = new Set<string>();
  for (const r of reads) {
    if (seen.has(r.path)) continue;
    seen.add(r.path);
    const label = (r.about as About | undefined)?.label;
    const kinds = (r.kinds ?? []).map((k) => {
      const learned = !!kindAbout(r, k)?.learned;
      return `${String(k)}${learned ? '*' : ''}${r.not?.includes(String(k)) ? '✗' : ''} ${pct(r.belief?.[String(k)])}`;
    });
    const by = `${r.by}${r.scope === 'deck' ? ', everywhere' : ''}${r.ask ? ', asking' : ''}${r.waiting !== undefined ? `, ${JSON.stringify(r.waiting)} waiting` : ''}`;
    out.push(`${r.path}${label ? ` (${label})` : ''} = ${JSON.stringify(r.value ?? null)} [${by}]${kinds.length ? ` · ${kinds.join(' · ')}` : ''}`);
  }
  return out.join('\n');
}
