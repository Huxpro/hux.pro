/**
 * Worlds: the program's possible renders, each a whole choice map with its joint probability.
 *
 * A render settles every intent on its own, from its belief. That is one world, chosen greedily:
 * fine while choices are independent, wrong when they are correlated. `worlds` chooses the world
 * first and renders it after: a beam over the choice sites a model (sure or not) still holds, in
 * the order the render reads them (a parent's before what it renders, so what is read under a
 * choice is believed given it: JSX nesting is the bind). Each site branches on its kinds, its
 * belief the probability, read again in the world so far (a conditional belief picks its case).
 * A person's decisions are not choice sites: they hold in every world.
 *
 *   worlds(el, source, { k: 3 })          → the k likeliest worlds: { choices, p, result }
 *   worlds(el, source, { beam: 1 })       → the greedy world, with its probability
 *   worlds(el, source, { only })          → worlds over the sites `only` keeps; the rest settle as
 *                                           a render settles them, and are summed out (their kinds'
 *                                           probabilities add to one), so `p` is the marginal of
 *                                           the kept choices. Without it, a world with more sites
 *                                           in it (a man to draw, his hat) is a more particular
 *                                           world, and less likely than one with fewer
 *   split(ws)                             → what to ask so a person picks among them: the first
 *                                           choice the worlds disagree on, and the mass of each kind
 *
 * Choosing a world is writing its choices; nothing here writes.
 */
import { whatIf, type Child, type Read, type RenderOptions, type Result, type Source } from '../core/index';

export type World = {
  /** The choices that make it, by path, in the order they were read. */
  choices: Record<string, string>;
  /** Their joint probability: the product of each one's belief, given the choices before it. */
  p: number;
  result: Result;
};

/** A choice site: an intent a model holds (sure or not), with a belief to branch on. */
export const site = (r: Read) => (r.by === 'model' || r.by === 'unresolved') && !!r.belief && Object.keys(r.belief).length > 0;

export function worlds(
  el: Child,
  source: Source,
  opts: RenderOptions & { k?: number; beam?: number; only?: (r: Read) => boolean } = {},
): World[] {
  const { k = 3, beam = Math.max(opts.k ?? 3, 8), only = () => true, ...render } = opts;
  type Partial = { choices: Record<string, string>; p: number };
  let open: Partial[] = [{ choices: {}, p: 1 }];
  const done: World[] = [];
  while (open.length) {
    const next: Partial[] = [];
    for (const w of open) {
      const result = whatIf(el, source, w.choices, render);
      const r = result.trace.reads.find((x) => !(x.path in w.choices) && site(x) && only(x));
      if (!r) {
        done.push({ ...w, result });
        continue;
      }
      for (const [kind, q] of Object.entries(r.belief!))
        if (q > 0) next.push({ choices: { ...w.choices, [r.path]: kind }, p: w.p * q });
    }
    open = next.sort((a, b) => b.p - a.p).slice(0, beam);
  }
  return done.sort((a, b) => b.p - a.p).slice(0, k);
}

export type Split = { path: string; options: { kind: string; p: number; worlds: number[] }[] };

/** The first choice (in the likeliest world's order) the worlds disagree on: one question splits them. */
export function split(ws: readonly World[]): Split | undefined {
  if (ws.length < 2) return undefined;
  for (const path of Object.keys(ws[0].choices)) {
    const kinds = new Set(ws.map((w) => w.choices[path]));
    if (kinds.size < 2) continue;
    const options = [...kinds]
      .filter((k) => k !== undefined)
      .map((kind) => {
        const idx = ws.flatMap((w, i) => (w.choices[path] === kind ? [i] : []));
        return { kind, p: idx.reduce((a, i) => a + ws[i].p, 0), worlds: idx };
      })
      .sort((a, b) => b.p - a.p);
    return { path, options };
  }
  return undefined;
}
