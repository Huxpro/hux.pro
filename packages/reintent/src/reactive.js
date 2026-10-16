/**
 * Reintent on signals: an intent is a reactive value. Nothing here is told what changed; every
 * value is a computed over the signals it reads (a person's decision, a preference, the model's
 * belief, the context), and whatever reads it — another intent, a layout, a view — re-runs only
 * when it actually changes.
 *
 *   const I = intents(types, { cells, source, beliefs, derives })
 *   const x = I.intent('arrange|row:g0,g1,g2')
 *   x.at(screen)()              its value on a screen (a kind, or a Defer for code to settle)
 *   x.firm()                    'person' | 'pref' | undefined — who has a say
 *   x.belief()                  the model's distribution (cache)
 *   x.infer({ cols1: 0.7, … })  the model says
 *   x.resolve('cols1', screen)  a person says (crossover moves to that screen's shape)
 *   x.forget()
 *   I.view(screen)              { a, firm, dflt } for a screen: getters over the intents, so a
 *                               reader depends on exactly the cells it reads
 *   I.questions(screen)()       what to ask now
 *
 * `source` is the data layer: decision(key) and pref(type) signals, decide / forget / prefer.
 * `beliefs` is a cache: belief(key) signals. The math (belief, decide, narrow) is reintent.js's.
 */
import * as R from './reintent.js';
import { computed, signal, same } from './signal.js';

export function intents(
  types,
  { cells, source, beliefs = {}, derives = {}, key = (ctx) => ctx?.id ?? JSON.stringify(ctx) },
) {
  const byKey = new Map(cells.map((c) => [c.key, c]));
  const beliefOf = new Map(cells.map((c) => [c.key, signal(beliefs[c.key])]));
  const cache = new Map();
  const per = (name, k, ctx, make) => {
    const id = `${name}|${k}|${key(ctx)}`;
    if (!cache.has(id)) cache.set(id, make());
    return cache.get(id);
  };
  // The doc reintent's pure functions expect, holding only this cell's inputs (so only they are read).
  const slice = (c, { withDecision = true } = {}) => {
    const d = withDecision ? source.decision(c.key)() : undefined;
    const p = types[c.type].pref ? source.pref(c.type)() : undefined;
    const b = beliefOf.get(c.key)();
    return {
      decisions: d ? { [c.key]: d } : {},
      prefs: p ? { [c.type]: p } : {},
      beliefs: b ? { [c.key]: b } : {},
    };
  };

  const made = new Map();
  function intent(k) {
    if (made.has(k)) return made.get(k);
    const c = byKey.get(k);
    const derive = derives[k];
    const decided = (doc, ctx) => R.decide(types, doc, c, ctx).value ?? undefined;
    const x = {
      key: k,
      cell: c,
      belief: () => beliefOf.get(k)(),
      infer: (p) => beliefOf.get(k).set({ p }),
      decision: () => source.decision(k)(),
      firm: computed(() =>
        source.decision(k)()
          ? 'person'
          : types[c.type].pref && source.pref(c.type)()?.pick
            ? 'pref'
            : undefined,
      ),
      /** Its value on a screen. */
      at: (ctx) =>
        per('at', k, ctx, () =>
          computed(
            () => {
              const v = decided(slice(c), ctx);
              return derive ? derive(v, api) : v;
            },
            { equals: same },
          ),
        ),
      /** Its value with no person's decision (what a layout written before one was written under). */
      dflt: (ctx) =>
        per('dflt', k, ctx, () =>
          computed(
            () => {
              const v = decided(slice(c, { withDecision: false }), ctx);
              return derive ? derive(v, api, { withDecisions: false }) : v;
            },
            { equals: same },
          ),
        ),
      asks: (ctx) => per('asks', k, ctx, () => computed(() => R.decide(types, slice(c), c, ctx).ask)),
      /** A person says: a kind here (moving a crossover to this screen), or for every subject (`scope: 'all'`). */
      resolve(kind, ctx, opts = {}) {
        const doc = R.narrow(
          types,
          { ...slice(c), prefs: { [c.type]: source.pref(c.type)() } },
          c,
          kind,
          ctx,
          opts,
        );
        if (opts.scope === 'all') source.prefer(c.type, doc.prefs[c.type]);
        else source.decide(k, doc.decisions[k]);
      },
      forget: () => source.forget(k),
    };
    made.set(k, x);
    return x;
  }

  function view(ctx) {
    return per('view', '', ctx, () => {
      const getters = (part) =>
        Object.defineProperties(
          {},
          Object.fromEntries(
            cells.map((c) => [
              c.key,
              {
                enumerable: true,
                get: () => (part === 'firm' ? intent(c.key).firm() : intent(c.key)[part](ctx)()),
              },
            ]),
          ),
        );
      // `a` without the cells whose value is undefined (as an Assignment), firm without the absent ones.
      const present = (part) =>
        new Proxy(getters(part), {
          ownKeys: (t) => Reflect.ownKeys(t).filter((k) => t[k] !== undefined),
          getOwnPropertyDescriptor: (t, k) =>
            t[k] === undefined ? undefined : Reflect.getOwnPropertyDescriptor(t, k),
        });
      return { a: present('at'), firm: present('firm'), dflt: present('dflt') };
    });
  }

  const api = {
    cells,
    types,
    intent,
    view,
    /** Keys a person has decided (from the data layer). */
    decided: () => source.decided(),
    questions: (ctx) =>
      per('questions', '', ctx, () =>
        computed(() => cells.filter((c) => intent(c.key).asks(ctx)()), { equals: same }),
      ),
    belief: (k) => R.belief(types, slice(byKey.get(k)), byKey.get(k)),
  };
  return api;
}
