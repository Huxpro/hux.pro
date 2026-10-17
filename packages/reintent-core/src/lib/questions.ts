/**
 * What to ask a person now: intents nobody sure has settled, of a kind that asks, and only where
 * the answer would change something — some context where the kinds render different worlds.
 */
import { render, whatIf, type Child, type RenderOptions, type Source } from '../core/index';

export type Question = {
  path: string;
  name: string;
  belief?: Record<string, number>;
  kinds: unknown[];
  where: string[];
};

export function questions(el: Child, source: Source, contexts: RenderOptions[]): Question[] {
  const byPath = new Map<string, Question>();
  for (const opts of contexts) {
    const now = render(el, source, opts);
    for (const r of now.trace.reads) {
      if (r.by !== 'unresolved' || !r.ask) continue;
      const kinds = [...(r.kinds ?? Object.keys(r.belief ?? {}))];
      const worlds = new Set(
        kinds.map((k) => JSON.stringify(whatIf(el, source, { [r.path]: k }, opts).tree)),
      );
      if (worlds.size < 2) continue;
      const where = Object.values(r.ctx).join(' · ');
      const q = byPath.get(r.path) ?? { path: r.path, name: r.name, belief: r.belief, kinds, where: [] };
      if (!q.where.includes(where)) q.where.push(where);
      byPath.set(r.path, q);
    }
  }
  return [...byPath.values()];
}
