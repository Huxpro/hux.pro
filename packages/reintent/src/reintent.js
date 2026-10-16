/**
 * Reintent: intents as a probabilistic, context-indexed decision table, and a reactive runtime
 * over it. Host-neutral: nothing here knows about slides, screens or layouts.
 *
 *   space   — the intent types an engineer declares: a closed set of kinds each, a prior, words.
 *   cells   — one decision per (type, subject); subjects are references into the host's world.
 *   doc     — what is known: `decisions` (a person's, stored), `prefs` (a person's, for every
 *             subject of a type, stored), `beliefs` (a model's distributions, a cache).
 *   assign  — doc × context → Assignment: one kind per cell, or `defer` (deterministic code picks).
 *   effects — Assignment → world: an eager one (code, always there, instant) and lazy ones
 *             (a model writes it, later), cached by the Assignment they were written under and
 *             checked against the one in force before they are shown.
 *
 * Three kinds of computation, and who runs them:
 *   infer   — a model: subject → distribution over the kinds          (probabilistic, async)
 *   narrow  — a person: a kind, or kinds ruled out, here or everywhere (interactive)
 *   derive / eager effect / check / read — code                      (deterministic, cheap)
 *   lazy effect — a model again, writing the world under an Assignment (probabilistic, async)
 */

/** How sure a belief must be (best minus second best) to act on it without asking. */
export const TAU = 0.2;
/** How strongly a person's preference for a type weighs against a model's belief about one subject. */
export const PREF_WEIGHT = 6;

export const margin = (p) => {
  const v = Object.values(p || {}).sort((a, b) => b - a);
  return v.length < 2 ? 1 : v[0] - v[1];
};
export const argmax = (p) => Object.entries(p || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
function normalize(p, kinds) {
  const s = kinds.reduce((a, k) => a + (p[k] || 0), 0) || 1;
  return Object.fromEntries(kinds.map((k) => [k, (p[k] || 0) / s]));
}

// ---------------------------------------------------------------------------------------------
// Space and cells.

/**
 * Declare the intent types. Each: {
 *   kinds(subject) → string[]       the closed set (a sum type's constructors); ≥ 2 to be a decision
 *   subjects(world) → subject[]     what in the host's world it is about (references, not owned)
 *   id(subject) → string            a stable key for a subject
 *   prior(subject, world) → Dist    code's guess before any model
 *   describe(kind, subject) → string  words for the model and the person
 *   resolve: 'ask' | 'switch'        when unsure: ask the person, or act and offer the other kinds
 *   pref: boolean                    a person may state it once for every subject of the type
 *   index?: { of(ctx) → number, base(subject) → kind }
 *                                    the value varies along one dimension of the context (a
 *                                    screen's width/height): `base` at the high end, another kind
 *                                    below a crossover
 *   applies?(subject, assignment) → boolean   a guard: meaningful only given other decisions
 *   read?(world, subject) → kind | null       observe: what a world actually shows
 *   check?(kind, world, subject) → string | null  verify: why a world breaks the kind, if it does
 * }
 */
export function space(types) {
  return types;
}

export function cells(types, world) {
  const out = [];
  for (const [type, T] of Object.entries(types))
    for (const subject of T.subjects(world)) {
      const kinds = T.kinds(subject);
      if (kinds.length < 2) continue;
      out.push({ key: `${type}|${T.id(subject)}`, type, subject, kinds, prior: T.prior(subject, world) });
    }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Values. A decision's `pick` is one of:
//   'kind'                                   a constant
//   { not: ['kind', …] }                     a refinement: these are ruled out, the rest stay open
//   { base, below, at }                      indexed: `base` where index ≥ at, `below` under it;
//                                            at: 'auto' leaves *where* to code; below: null leaves
//                                            *what* to code (among the kinds other than base)

/** Belief about a cell: code's prior, replaced by a model's belief, weighed by a preference, narrowed. */
export function belief(types, doc, cell) {
  let p = { ...cell.prior };
  const m = doc.beliefs?.[cell.key]?.p;
  if (m) p = normalize(m, cell.kinds);
  const pref = types[cell.type].pref && doc.prefs?.[cell.type]?.pick;
  if (pref && cell.kinds.includes(pref))
    p = Object.fromEntries(cell.kinds.map((k) => [k, (p[k] || 0) * (k === pref ? PREF_WEIGHT : 1)]));
  const not = doc.decisions?.[cell.key]?.pick?.not;
  if (not) for (const k of not) p[k] = 0;
  return normalize(p, cell.kinds);
}

/**
 * The value of one cell in a context, and why. Precedence: a person's decision for this subject >
 * their preference for the type (alone it decides; against a model's belief it weighs) > a model's
 * belief sure enough to act on > defer (code decides, a switch is offered, or the person is asked).
 *   → { value: kind | Defer | null, from, p?, ask }
 *   Defer = { defer: true, base?, below?, not? }: code chooses, within these bounds.
 */
export function decide(types, doc, cell, ctx) {
  const T = types[cell.type];
  const d = doc.decisions?.[cell.key];
  const pick = d?.pick;
  if (typeof pick === 'string') return { value: pick, from: d.from || 'resolved', ask: false };
  if (T.index) return decideIndexed(types, doc, cell, ctx, d);
  const pref = T.pref && doc.prefs?.[cell.type];
  if (pref?.pick && cell.kinds.includes(pref.pick) && !doc.beliefs?.[cell.key] && !pick?.not)
    return { value: pref.pick, from: pref.from || 'pref', ask: false };
  const p = belief(types, doc, cell);
  if (margin(p) >= TAU) return { value: argmax(p), from: 'inferred', p, ask: false };
  return {
    value: { defer: true, ...(pick?.not && { not: pick.not }) },
    from: 'unsure',
    p,
    ask: T.resolve === 'ask',
  };
}

function decideIndexed(types, doc, cell, ctx, d) {
  const T = types[cell.type];
  const pick = d?.pick && typeof d.pick === 'object' && !d.pick.not ? d.pick : null;
  const base = pick?.base ?? T.index.base(cell.subject);
  let below = pick?.below ?? null;
  if (below == null && doc.beliefs?.[cell.key]) {
    // Only a model's belief, and only a sure one, says what the low end becomes; a prior never does.
    const p = belief(types, doc, cell);
    const rest = Object.fromEntries(Object.entries(p).filter(([k]) => k !== base));
    if (margin({ ...rest, [base]: 0 }) >= TAU) below = argmax(rest);
  }
  const at = pick?.at ?? 'auto';
  const from = pick ? d.from || 'resolved' : below ? 'inferred' : 'code';
  if (at === 'auto') return { value: { defer: true, base, ...(below && { below }) }, from, ask: false };
  if (T.index.of(ctx) >= at) return { value: base, from, ask: false };
  return { value: below ?? { defer: true, base, not: [base] }, from, ask: false };
}

/**
 * doc × context → Assignment { key: kind | Defer }. `derives` run after, in order, each
 * (assignment, doc) → { key: value } — decisions that follow from other decisions.
 */
export function assign(types, doc, cs, ctx, derives = []) {
  let a = {};
  for (const c of cs) {
    const { value } = decide(types, doc, c, ctx);
    if (value != null) a[c.key] = value;
  }
  for (const c of cs) if (types[c.type].applies && !types[c.type].applies(c.subject, a)) delete a[c.key];
  for (const f of derives) a = { ...a, ...f(a, doc) };
  return a;
}

/**
 * Everything a context sees of a doc: `a` the Assignment; `firm` who has a say over each cell
 * ('person' — a decision for this subject; 'pref' — a preference for its type; absent — only the
 * model and code); `dflt` the Assignment with no person's decisions (what the model and code
 * would say, and what a world written before those decisions was written under).
 */
export function view(types, doc, cs, ctx, derives = []) {
  const firm = {};
  for (const c of cs)
    if (doc.decisions?.[c.key]) firm[c.key] = 'person';
    else if (types[c.type].pref && doc.prefs?.[c.type]?.pick) firm[c.key] = 'pref';
  return {
    a: assign(types, doc, cs, ctx, derives),
    firm,
    dflt: assign(types, { ...doc, decisions: {} }, cs, ctx, derives),
  };
}

/** The cells to ask a person about now: unsure, on a type that asks, not decided. */
export function questions(types, doc, cs, ctx) {
  return cs.filter((c) => decide(types, doc, c, ctx).ask);
}

// ---------------------------------------------------------------------------------------------
// Narrowing: a person's action → a new doc (the reducer). Stored state is only what people decide.

/**
 * A person chose `kind` for `cell` while seeing context `ctx`:
 *   scope 'here'  — this subject; on an indexed type the crossover moves to this context, so
 *                   contexts further along the index take the same kind and the rest keep theirs
 *   scope 'all'   — every subject of the type (a preference)
 *   { not: [...] } instead of a kind rules kinds out and leaves the rest to belief and code
 */
export function narrow(types, doc, cell, kind, ctx, { scope = 'here', from = 'resolved' } = {}) {
  const T = types[cell.type];
  if (scope === 'all') return { ...doc, prefs: { ...doc.prefs, [cell.type]: { pick: kind, from } } };
  let pick = kind;
  if (T.index && typeof kind === 'string') {
    const prev = doc.decisions?.[cell.key]?.pick;
    const base = prev?.base ?? T.index.base(cell.subject);
    // Rounded so that this context lands on the side it chose: at ≤ x for the base, at > x below.
    const x = T.index.of(ctx);
    pick =
      kind === base
        ? { base, below: prev?.below ?? null, at: Math.floor(x * 1000) / 1000 }
        : { base, below: kind, at: Math.floor(x * 1000 + 1) / 1000 };
  }
  return { ...doc, decisions: { ...doc.decisions, [cell.key]: { pick, from } } };
}
export function forget(doc, key) {
  const decisions = { ...doc.decisions };
  delete decisions[key];
  return { ...doc, decisions };
}

// ---------------------------------------------------------------------------------------------
// Observe, check, alternatives.

/** What a world shows, per cell — read where it can be read, else what it was written under. */
export function observe(types, cs, world, under = {}) {
  const out = {};
  for (const c of cs) {
    const T = types[c.type];
    const v = T.read ? T.read(world, c.subject) : null;
    if (v != null) out[c.key] = v;
    else if (typeof under[c.key] === 'string') out[c.key] = under[c.key];
  }
  return out;
}

/**
 * Why a world breaks an Assignment: each firm value (a person's, or a preference) checked by its
 * type; a type that cannot be read off the world is held to what the world was written under.
 */
export function check(types, doc, cs, a, world, under) {
  const out = [];
  for (const c of cs) {
    const v = a[c.key];
    const T = types[c.type];
    const firm = doc.decisions?.[c.key] || (T.pref && doc.prefs?.[c.type]);
    if (!firm || typeof v !== 'string') continue;
    const why = T.check?.(v, world, c.subject);
    if (why) out.push(`${c.key}: ${why}`);
    else if (!T.read && !T.check && under && under[c.key] != null && under[c.key] !== v)
      out.push(`${c.key}: written for ${under[c.key]}`);
  }
  return out;
}

/**
 * The other kinds each cell could take here, each as a world: exactly one cell flipped, every
 * other cell frozen at what this world shows. When the flip cannot be had with the rest frozen,
 * other types give way in `relax` order (and say so); when it still cannot, it is not offered.
 *   run(assignment) → world,   holds(world, key, kind) → boolean
 */
export function alternatives(types, cs, a, world, { run, holds, relax = [], read }) {
  // `read(world)`: the host's own reading of a world, when its types cannot read one cell at a time.
  const now = { ...strings(a), ...(read ? read(world) : observe(types, cs, world)) };
  const out = [];
  for (const c of cs) {
    const cur = now[c.key];
    if (cur == null) continue;
    for (const kind of c.kinds) {
      if (kind === cur) continue;
      let b = { ...now, [c.key]: kind };
      let w = run(b);
      const relaxed = [];
      for (const type of relax) {
        if (holds(w, c.key, kind)) break;
        const ks = Object.keys(b).filter((k) => k !== c.key && k.startsWith(type + '|'));
        if (!ks.length) continue;
        b = Object.fromEntries(Object.entries(b).filter(([k]) => !ks.includes(k)));
        relaxed.push(type);
        w = run(b);
      }
      if (holds(w, c.key, kind))
        out.push({ key: c.key, type: c.type, kind, from: cur, assignment: b, world: w, relaxed });
    }
  }
  return out;
}
const strings = (a) => Object.fromEntries(Object.entries(a || {}).filter(([, v]) => typeof v === 'string'));

// ---------------------------------------------------------------------------------------------
// Effects: Assignment → world.

/**
 * An effect with an eager implementation (code: instant, never fails) and an optional lazy one
 * (a model: later, better), whose results are cached with the Assignment they were written under:
 *   eager(assignment) → world
 *   cache() → [{ world, under }]      written worlds, newest first; `under` = the firm values
 *                                      the writer was given ({ key: kind }), never re-derived
 *   request(assignment)                ask for one to be written under this Assignment (async)
 *   valid(world, under) → string[]     why a written world cannot be shown now (empty: it can)
 * → (assignment) → { world, source: 'written' | 'eager', pending }
 * The first written world that is still valid is shown; none is ever thrown away (undo a decision
 * and the one written before it is back). With none, the eager world; and when worlds had been
 * written here and none still holds, one is requested under the new Assignment (`pending`).
 */
/** Written under a value the Assignment no longer has: kept, not shown. */
export const stale = (w, a) =>
  Object.entries(w.under || {}).some(([k, v]) => typeof a[k] === 'string' && a[k] !== v);

export function effect({ eager, cache = () => [], request, valid = () => [] }) {
  const asked = new Set();
  return (a) => {
    const hit = cache().find((w) => !stale(w, a) && !valid(w.world, w.under).length);
    if (hit) return { world: hit.world, source: 'written', pending: false };
    const pending = !!request && cache().length > 0;
    const k = JSON.stringify(strings(a));
    if (pending && !asked.has(k)) {
      asked.add(k);
      request(a);
    }
    return { world: eager(a), source: 'eager', pending };
  };
}

// ---------------------------------------------------------------------------------------------
// Runtime: the doc is the input; what each context sees of it (its view) is computed; effects are
// watchers, each with its own context, re-run only when a value they read changes. Fine-grained
// like signals (a watcher tracks the cells it reads, in any context it reads), with React's
// semantics (a world is a pure function of what was read).

/**
 * runtime(types, { cells, doc, derives, key }) → {
 *   doc                      the doc now
 *   view(ctx)                what `ctx` sees (untracked): { a, firm, dflt }
 *   watch(ctx, fn)           fn(v) with v = { a, firm, dflt, at(ctx2) }, every read tracked;
 *                            → { value, runs, rerun(), dispose() }
 *   set(doc)                 a new doc: watchers whose reads changed re-run, the rest are skipped
 *   narrow / forget / believe / prefer   the reducers, then set()
 *   invalidate()             something outside the doc changed (the world itself): re-run all
 *   stats                    { runs, skipped }
 * }
 * `key(ctx)` names a context (default: its id, else its JSON).
 */
export function runtime(
  types,
  { cells: cs, doc, derives = [], key = (ctx) => ctx?.id ?? JSON.stringify(ctx) },
) {
  let current = doc;
  let views = new Map();
  const viewOf = (ctx) => {
    const k = key(ctx);
    if (!views.has(k)) views.set(k, view(types, current, cs, ctx, derives));
    return views.get(k);
  };
  const subs = new Set();
  const stats = { runs: 0, skipped: 0 };
  const PARTS = ['a', 'firm', 'dflt'];
  // A view whose every read is recorded in `deps`: `${ctx}|${part}|${cell}` → [ctx, part, cell, value seen].
  const tracked = (deps, ctx) => {
    const k = key(ctx);
    const v = viewOf(ctx);
    const out = { at: (c2) => tracked(deps, c2) };
    for (const part of PARTS)
      out[part] = new Proxy(v[part], {
        get(t, cell) {
          if (typeof cell === 'string')
            deps.set(`${k}|${part}|${cell}`, [ctx, part, cell, JSON.stringify(t[cell])]);
          return t[cell];
        },
        ownKeys(t) {
          deps.set(`${k}|${part}|*`, [ctx, part, '*', JSON.stringify(t)]);
          return Reflect.ownKeys(t);
        },
      });
    return out;
  };
  const run = (s) => {
    s.deps = new Map();
    s.value = s.fn(tracked(s.deps, s.ctx));
    s.runs++;
    stats.runs++;
  };
  const changed = (s) =>
    [...s.deps.values()].some(([ctx, part, cell, seen]) => {
      const t = viewOf(ctx)[part];
      return JSON.stringify(cell === '*' ? t : t[cell]) !== seen;
    });
  const set = (next) => {
    current = next;
    views = new Map();
    for (const s of [...subs])
      if (changed(s)) run(s);
      else stats.skipped++;
  };
  const cellOf = (k) => cs.find((c) => c.key === k);
  return {
    get doc() {
      return current;
    },
    stats,
    view: viewOf,
    watch(ctx, fn) {
      const s = { ctx, fn, runs: 0 };
      run(s);
      subs.add(s);
      return {
        get value() {
          return s.value;
        },
        get runs() {
          return s.runs;
        },
        rerun: () => run(s),
        dispose: () => subs.delete(s),
      };
    },
    set,
    narrow: (k, kind, ctx, opts) => set(narrow(types, current, cellOf(k), kind, ctx, opts)),
    forget: (k) => set(forget(current, k)),
    believe: (beliefs) => set({ ...current, beliefs: { ...current.beliefs, ...beliefs } }),
    prefer: (type, kind, from = 'asked') =>
      set({
        ...current,
        prefs: { ...current.prefs, [type]: kind == null ? undefined : { pick: kind, from } },
      }),
    invalidate() {
      views = new Map();
      for (const s of [...subs]) run(s);
    },
  };
}
