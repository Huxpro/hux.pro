# Reintent core

`packages/reintent-core`: Reintent in `.tsx`. A model writes an **intent tree**
(a pure semantic layer, with no view in it), on **intent components** that read
intents as values. A view, in any host, draws what the render says.

The core is the one in [Huxpro/airtalk#845](https://github.com/Huxpro/airtalk/pull/845)
(`prototypes/reintent-tsx`), ported with its tests. It is built next to the
vendored `packages/reintent` and the scene-specific `packages/intents`
(docs/system-intents.md), not yet in place of them.

## Values, not signals

The execution model is React's, without React's runtime:

- **A render is a function**: (element, source, contexts, overrides) → (host
  tree, trace). The same inputs give the same outputs, and nothing in a render
  writes.
- **A component is a function of its props.** It keeps no state of its own.
  Every intent's value comes from the source, read by path. Reads are known by
  name, not by call order, so any control flow is allowed (a guard is a branch).
- **`useIntent` returns a value** (`T | Unresolved<T> | Unknown`), not a getter
  or a signal. Read twice in one render, it is the same value. To see a new
  value, render again.
- **Change propagates by rendering again.** `watch` re-runs a render when a
  write touches something it read, and skips the rest. No dependency graph
  outlives a render but its trace.
- **Many worlds at once.** Renders over other contexts or other overrides
  (`whatIf`) are just more calls, and never disturb one another.
- **A host consumes values.** The host tree and the trace are plain data. A
  view (React here, a layout solver in airtalk) reads them; it never subscribes
  to an intent.

Why values rather than a signal graph: the program is written and rewritten by
a model, so identity has to come from structure (paths, keys, scopes), not
object references. Counterfactual and multi-context renders (alternatives,
"would asking change anything", one tree on many screens) are the everyday
operations. Code is nearly free next to a model's inference and a person's
attention. These are the test files' first group (`test/value.test.ts`).

Because the reads are not React hooks, React's call-order lint is off for the
intent layer (`eslint.config.mjs`, `REINTENT_INTENT_LAYER`). Vocabularies read
with `.read(...)`, not `.use(...)`, so they are not named like hooks.

## Choices, and worlds

A model's belief about an intent is a distribution over its kinds, so a program
with beliefs in it is a distribution over trees. Reintent is a trace-based
probabilistic program:

| probabilistic program | here |
|---|---|
| a choice site, at an address | `useIntent(name)`, at its path |
| the trace | the render's reads |
| the choice map | the source (and `whatIf`'s overrides) |
| an intervention (`do`) | `whatIf`: as if a person had decided |
| bind (`flatMap`) | JSX nesting: what a component renders depends on what it read, and is read after it |

A render settles every intent on its own, from its belief. That is fine while
choices are independent and wrong when they are not: the likeliest title and
the likeliest layout, each taken alone, can be a pair the model holds unlikely.
Three pieces keep correlated choices together:

- **Beliefs given other choices** (core, `Given`). The model writes
  `{ $given: [{ when: { [path]: kind }, p }], else? }`. A case holds when every
  path in `when` was read earlier in the same render with that value (an
  ancestor's, an earlier sibling's). `Read.given` says which case it was, so a
  belief, like a cached result, is known by what it was made under.
- **Worlds** (`lib/worlds`). The world is chosen whole, then rendered. A beam
  over the choice sites a model holds, in the order the render reads them, with
  each site's belief read again in the world so far, gives the likeliest whole
  choice maps and their joint probability. `beam: 1` is greedy. `only` keeps
  some sites and sums out the rest, so `p` is the marginal of the kept choices.
  `split(worlds)` is the one question that tells the likeliest apart. Nothing
  here writes: choosing a world is writing its choices.
- **Structural choice** (`lib/choose`, `<Choose>`). Its kinds are subtrees:
  one intent over named alternatives, and only the chosen one is rendered (and
  read). What is under it is read after it, so it can be believed given it, and
  worlds branch on it before what it holds. A keyed component keeps its path in
  whichever alternative holds it.

```tsx
<Choose key="ending" name="ending" default="waits" ask
  alternatives={{ waits: [<Man key="man" />, <Wardrobe key="wardrobe" />], gone: <Wardrobe key="wardrobe" /> }} />
```

The Wardrobe's v3 shows the gap. The model is torn about whether he is still
there (0.55 / 0.45) and believes the door given it (gone: ajar 0.8; waits: wide
0.6). The render goes on code's pick (he waits) and the door wide (0.33 in
all). The likeliest world is the other one (gone, the door ajar: 0.36).

Rendering stays deterministic: a probabilistic program is resolved by
choosing a choice map (a person, a sure model, a world picked whole), and the
render of a choice map is a function. Alternatives generated only when asked
for (a model writing a subtree for an alternative named but not yet written)
are not here yet.

## Three layers

| layer | what | in The Wardrobe |
|---|---|---|
| intent tree | what a model writes: elements and literal props only (`test/structure.test.ts` holds it to that) | `experiences/reintent/program/v1.tsx`, `v2.tsx` |
| intent components | the semantics: read intents (values), branch on them, return host nodes saying what was decided, in kinds and paths. No view | `experiences/reintent/intents/v1.ts`, `v2.ts` |
| view | a host: reads the render's host nodes and draws them | `experiences/reintent/main.tsx`: React, the Wardrobe's own stage (`WardrobeStage({ rd, things })`) |

```tsx
/** @jsxImportSource reintent-core */
export default (
  <Dream key="wardrobe">
    <Man key="man" />
    <Wardrobe key="wardrobe" />
  </Dream>
);

export function Man() {
  const hat = Size.read("hat", { thing: MAN, aka: ["帽子"], default: "big", ask: true });
  const stand = Place.read("stand", { thing: MAN, default: "bedside" });
  return host("man", { hat: ref(hat), stand: ref(stand) });   // kinds and paths, not pixels
}
```

An intent's identity is its path: the nearest scope, the component's
`Name:key`, and the intent's name (`Dream:wardrobe/Man:man#hat`). A component
is named by its `displayName` before its function name, because paths are
stored and a minifier renames functions. Every intent component here sets one,
and a test checks it.

## The core (ported)

From Huxpro/airtalk#845, unchanged except where noted below:

- elements (`h`, the automatic runtime `reintent-core/jsx-runtime`, `host`, `scope`);
- contexts with numeric axes;
- one intent's value from its writers: a person (about this intent > about every intent of its name, `{ scope: 'deck' }`) > a sure model (margin ≥ `TAU`) > code;
- partial values along an axis (`Piecewise`), `{ $not }`, `open: false`, Unresolved and Unknown;
- `render` with its trace, `whatIf`, `watch`;
- results stamped with the values they were made under (`createCache`, `under`, `stale`);
- a pluggable `Source`.

What this repository adds to it, each in value semantics:

| | |
|---|---|
| kinds bound a person's value | when an intent lists its kinds, a person's value that is not one of them does not apply. It falls through to the next writer and is reported as `Read.waiting`. It stays in the source, so it applies again when the kind is back. This replaces the earlier suspend-and-reconcile step without mutating anything. A model's belief is not bounded |
| learned kinds | `source.learn(path, kind, about)`: a model adds a kind to an intent. It joins the intent's kinds, and `Read.learned` carries what the host keeps about it |
| `about` | anything a component says about an intent (labels, words), passed through to `Read.about` for the libraries. The core never reads it |
| `usePath(name)` | the path an intent of this component has, which a host keys the meaning by |
| `jsx-runtime` | the automatic JSX runtime, with the `JSX` namespace scoped to it (not global, so it never meets React's) |

## Libraries (`reintent-core/lib/*`, on the core's public entry only)

| | |
|---|---|
| `axis`, `alternatives`, `questions`, `orphans` | from airtalk: choices along an axis; one-flip alternatives that render differently; what to ask (only where the answer changes something); decisions no render reads |
| `vocab` | kinds with their words and data. `Size.read(name, opts)` in a component, `meaning(reads, ref)` in a view, `shown`, `half` |
| `words` | a sentence read against the trace: resolve, ask, infer (a step past the end of a scale), or context |
| `changes` | what a program change did to the decisions: added, removed, kept, waiting, back; plus `diff` of two renders |
| `observe` | what a model is shown, from the trace |
| `worlds` | the likeliest whole choice maps and their joint probability (a beam; greedy with `beam: 1`; `only` sums the other sites out), and `split`: the question that tells them apart |
| `choose` | `<Choose name default alternatives>`: a structural choice, one intent over subtrees |
| `session` | the loop a host runs: the worlds (choose one: a person writes its choices), the source, a render under `watch`, versions of the program with the model's beliefs for each, undo (the host's history; a program change starts it over), say/answer/decide/rule out/forget, a `Model` behind two doors (`extend`, `rebelieve`), and `window.__reintent` for an inspector |

## Files

```
packages/reintent-core/
├── src/core/        the core (ported): jsx, jsx-runtime, context, value, source, render, cache, index
├── src/lib/         axis, alternatives, questions, orphans (ported); vocab, words, changes, observe, session, worlds, choose
└── test/
    ├── core.test.ts       airtalk's core tests, as written (its email-reply host in email.ts)
    ├── structure.test.ts  the layering, and literal instance files (The Wardrobe's)
    ├── value.test.ts      values, not signals; and what this repository adds to the core
    ├── choice.test.ts     beliefs given other choices, <Choose>, worlds (a brief in brief.tsx)
    ├── wardrobe.test.ts   The Wardrobe's intent layer, headless, step by step through a session (v3 included)
    └── hooks.mjs, register.mjs   Node runs .tsx (TypeScript's transpiler) and the package's subpaths

experiences/reintent/
├── program/v1–v3.tsx      the intent tree, as written, as rewritten, and with a choice of the tree
├── intents/v1.ts, v2.ts     the intent components
├── kinds.ts                 the vocabularies
├── beliefs.ts               the model's beliefs, per version
├── model.ts                 a stand-in model, in rules
└── main.tsx                 the session, and the React view
app/lab/reintent/            the lab: the frame, and a panel on the session
```

`pnpm reintent:test` (36 tests) and `pnpm reintent:typecheck` check it.

## In the lab

`/lab/reintent` frames `/scenes/reintent/` beside a panel on its session.

| | |
|---|---|
| Program | v1 ⇄ v2 (the model's rewrite of the components): what is new, gone, kept, waiting, back. Under v2, a person's `absurd` hat waits, his gaze is not read at the window, and the pace's default follows the door |
| Program v3 | `<Choose>`: he waits, or he is gone into the wardrobe. Gone, nothing about him is read. The door is believed given the ending |
| Worlds | the likeliest choice maps over the ending and the door, with their probability, and which one the render settled on. Choosing one writes its choices |
| Say | `他走了` names an alternative. `帽子大一点` steps along the scale. `帽子还要大` goes past its end, where the stand-in learns a kind. `门慢一点` is the pace (its own step words). `别看我` is a kind, not a refusal. `帽子不要大得离谱` rules a kind out. `更压抑一点` is said of the whole: the stand-in believes again |
| Asked, Intents | answer, decide, rule out, forget. Each value shows who said it and whether a decision waits |
| Details | what a model is shown, the source files of the running version, the source |

## Not yet

- Static reads of a program's intents without rendering it.
- A real model behind the stand-in.
- Saving and sharing the source.
- Piecewise decisions in this lab (the core has them; `/lab/screens` uses the vendored `reintent`).
- The YSML ⇄ instance file ⇄ source mapping airtalk lists.
