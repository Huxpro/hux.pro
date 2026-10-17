# Reintent core

`packages/reintent-core`: intents as a reactive, typed program. A standalone
core (no React, no host, no model), the libraries on it, and one host: The
Wardrobe, at `/lab/reintent`.

It is the minimal API the design discussion converged on, built next to the
vendored `packages/reintent` and the scene-specific `packages/intents`
(docs/system-intents.md), not yet in place of them.

## The model, in React's terms

| Reintent | React | |
|---|---|---|
| `intent({...})` | a type | a closed set of kinds, each with the words that say it and its data |
| `<Scene>`, `<Thing>`, `<Intent>` | JSX | the program, in TSX. Evaluating it is the whole compile: it becomes data |
| a cell (`man.hat`) | an element with a key | identity is the path, never an order of calls, so a model can rewrite the program |
| the doc | state | what was said after the program was written: decisions, rules, beliefs, learned kinds |
| the context | props / context | what the cells are seen in: prompts said of the whole, a viewer's leanings, focus |
| `values()` | render | the one rule, below |
| `reconcile` | reconciliation | the program rewritten: decisions kept by path, parked when their kind is gone |
| `effect` | effects + Suspense | eager code now, a lazy model world later, cached under the kinds it was written for |
| `createRoot` | the root | actions in, snapshots out, `watch`, undo, `preview` |

The novel part has no React counterpart: a cell's value has three writers.
A person narrows, a model believes, code is the program. `values()` decides
between them:

```
person > rule (a person's, for every cell of the intent) > author (the program's pick)
       > derived (a relation the program wrote) > viewer (a leaning) > model (margin ≥ TAU)
       > code, or ask (on an intent that asks)
```

Kinds a person ruled out (`{ not: [...] }`) are out at every level. A belief
inferred under another context stays in use and is marked `stale`; a person's
decision is never stale.

## Files

```
packages/reintent-core/src/
├── intent.ts       intent(): kinds, words, data; KindOf / DataOf
├── program.ts      Scene / Thing / Intent, toProgram, check, cells
├── jsx-runtime.ts  the JSX runtime (@jsxImportSource reintent-core): an element is its component, called
├── doc.ts          the doc; narrow / believe / learn; reconcile
├── decide.ts       values(): the rule; questions, staleCells
├── effect.ts       effect(): eager and lazy, cached under kinds
├── root.ts         createRoot(): actions, log, undo, preview, watch
├── index.ts        the core: everything above, nothing below
├── words.ts        library: a sentence → resolve / ask / infer / context
├── observe.ts      library: the state as text, what a model is shown
├── devtools.ts     library: window.__reintent, how a host opens itself to an inspector
└── react.ts        binding: useSnapshot, useIntent (typed by the intent)
packages/reintent-core/test/
├── core.test.ts    each rule, and the words library (pnpm reintent:test)
└── fixture.tsx     a program in TSX the type check holds (pnpm reintent:typecheck)

experiences/reintent/      The Wardrobe, its intents held by the core
├── kinds.ts               the intent types (.ts)
├── wardrobe.tsx           the program as the model wrote it (TSX)
├── wardrobe.v2.tsx        the program as the model rewrote it
├── model.ts               a stand-in model, in rules: extend a scale; believe again under a new context
└── main.tsx               the root, the picture reading it (useIntent), the devtools
app/lab/reintent/          the lab: the frame, and a panel driving the root through window.__reintent
```

The Wardrobe's stage is shared: `experiences/wardrobe/Wardrobe.tsx` exports
`WardrobeStage({ rd })`, which reads its intents from any source. The
original experience still feeds it from `packages/intents`.

## Writing a program

```tsx
/** @jsxImportSource reintent-core */
import { Intent, Scene, Thing, toProgram } from "reintent-core";
import { Size } from "./kinds";

export default toProgram(
  <Scene id="wardrobe">
    <Thing id="man" aka={["他"]}>
      <Intent name="hat" of={Size} p={{ big: 0.52, absurd: 0.44 }} resolve="ask" />
    </Thing>
  </Scene>,
);
```

- `of` types the rest: `p`, `pick` and `derive` may name only its kinds. A wrong one is a type error.
- `toProgram` is needed because a JSX expression is always typed `JSX.Element`. It also checks the program at runtime.
- `derive={(read) => …}` and `follows="man.where"` declare relations. `when` declares that a cell only means something given other cells.
- Read a cell's value with `useIntent(root, "man.hat", Size)`. Its `.data.hatScale` is typed, and it holds for a learned kind too.

## In the lab

`/lab/reintent` frames `/scenes/reintent/` beside a panel.

| | |
|---|---|
| Program | switch v1 ⇄ v2 (the model's rewrite). The report says what was kept, what waits, and what came back. Under v2, a person's `absurd` hat waits (v2 has no `absurd`), the gaze asks, and the pace follows the door |
| Say | `帽子大一点` steps along the scale. `帽子还要大` goes past its end, where the stand-in learns a kind. `门慢一点` is the pace (its own step words). `别看我` is a kind, not a refusal. `帽子不要大得离谱` rules a kind out. `更压抑一点` is said of the whole: beliefs go stale, and the stand-in infers them again |
| Asked, Cells | answer, decide, rule out, forget. Each value shows who said it |
| What happened | the log, cell by cell |
| Details | what a model is shown (`observe`), the program's source, the doc |

## Not yet

- **Index (values that cross over along one dimension of the context).** `/lab/screens` keeps this from the vendored `reintent`. Here it would be a decision that depends on context.
- **One-flip alternatives and their previews.** `root.preview()` is the base for them.
- **Words bound to the program (spans).**
- **A real model behind `extend` and `rebelieve`.**
- **Saving and sharing the doc.**
