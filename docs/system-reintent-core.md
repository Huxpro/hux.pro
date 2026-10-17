# Reintent core

`packages/reintent-core`: intents as a reactive, typed program. Parts take
intents in and give the world out. A standalone core (no React, no host, no
model), the libraries on it, and one host: The Wardrobe, at `/lab/reintent`.

It is the minimal API the design discussion converged on, built next to the
vendored `packages/reintent` and the scene-specific `packages/intents`
(docs/system-intents.md), not yet in place of them.

## The model, in React's terms

`UI = f(state)` becomes `World = f(intents)`. A **part** is the component: intents
come in through hooks, and the world goes out as whatever the host draws (JSX, in a
React host).

```tsx
const Man = part("man", { aka: ["他"] }, ({ pose }: { pose: Pose }) => {
  const hat = useIntent("hat", Size, { p: { big: 0.52, absurd: 0.44 }, resolve: "ask" });
  const stand = useIntent("stand", Place);
  return <Figure at={stand.data.at} hatScale={hat.data.hatScale} {...pose} />;
});
```

| Reintent | React | |
|---|---|---|
| `intent({...})` | a type | a closed set of kinds, each with the words that say it and its data |
| `part(id, meta, render)` | a component | a thing: its intents in, its world out |
| `useIntent(label, Type, opts)` | `useState` | declares a cell and reads its value. In a part, known by its **label**, not its call order, so it may sit under an `if`, and a model may rewrite the part |
| `useDerived` / `useCell` | lifting state, context | a relation to other cells (code writes it); another part's cell read sideways |
| `useLazy(effect)` | Suspense | eager code now, a lazy model world later, cached under the kinds it was written for |
| the program | the fiber tree | everything held (each mounted part or hook holds its declarations): a table of cells, kept by the root |
| the doc | state | what was said after the parts were written: decisions, rules, beliefs, learned kinds |
| the context | context | what the cells are seen in: prompts said of the whole, a viewer's leanings, focus |
| `values()` | render | the one rule, below |
| `reconcile` | reconciliation | the program changed: decisions kept by path, waiting when their kind is gone |
| `createRoot` / `collect` / `render` | the root | read (`evaluate`, `view`) apart from declare (`hold`, `release`); actions in, snapshots out, `watch`, undo, `preview`; a part run purely; parts run headless until they settle |

The novel part has no React counterpart: a cell's value has three writers.
A person narrows, a model believes, and code is the part. `values()` decides
between them:

```
person > rule (a person's, for every cell of the intent) > author (the part's pick)
       > derived (a relation the part wrote) > viewer (a leaning) > model (margin ≥ TAU)
       > code, or ask (on an intent that asks)
```

Kinds a person ruled out (`{ not: [...] }`) are out at every level. A belief
inferred under another context stays in use and is marked `stale`; a person's
decision is never stale.

**Reading and declaring are apart, as rendering and committing are.**

| | root | when |
|---|---|---|
| read | `evaluate(thing, decl, scope)`: what a declaration's cell is now; `view(scope)`: every published cell | in a render. Pure, so a render that is thrown away (a transition, Suspense) leaves nothing behind |
| declare | `hold(holder, thing, decls)`, `release(holder)` | at commit. Each mounted instance is a holder: him in the wardrobe and him at the bed are two holders of one thing |
| publish | `flush()`, scheduled once after the holds and releases of a commit | the program is everything held. When its shape (cells, kinds, beliefs) changed, the doc is reconciled and the change is logged: cells added and removed, decisions kept, waiting, or back |

The program changes when a model rewrites a part, when an `if` around a hook
goes the other way, or when a part unmounts. A version switch releases and
holds again within one commit, so nothing is lost. Undo steps the doc back,
never the program, which is code.

**Values share structure.** A cell that did not change is the same `Value`
object from one publish to the next. So whoever reads one cell is told only
when that cell changes.

**Reading sideways.** A cell another thing has not declared yet reads as
nothing. After the flush, the reader runs again: the second pass. `render()`
(headless) loops until the parts settle.

## In a React host (`reintent-core/react`)

```tsx
<ReintentRoot root={root}>
  <Thing id="wardrobe">
    <Director />          {/* useIntent("pace", Pace, …): a React hook, React's rules */}
  </Thing>
  <WardrobeView />        {/* reactPart(Wardrobe): a part, its own hooks by label */}
</ReintentRoot>
```

| | |
|---|---|
| `useIntent(label, Type, opts)` | a React hook in any component under a `<Thing>`. Render reads it through `evaluate` with `useSyncExternalStore`, subscribed to that one cell. A layout effect holds it every commit (a re-run with the same shape is quiet), and unmounting releases it. React's rules of hooks apply: not under an `if` |
| `reactPart(part)` / `usePart` | a part as a component. Render collects the part (pure). It is subscribed to exactly the cells it read, and a layout effect holds what it declared. The part's hooks are known by label, so an `if` is fine inside |
| `<Thing id>` | composes paths (`beat:2/man`). A part names its own thing and does not compose under one it happens to be drawn in (`partId` names another) |
| `<Scope focus lean>` | a subtree's own part of the context. Its values are computed under it (`root.view(scope)`) |
| `useCell(key)` | a cell read sideways, subscribed to that cell |

## Files

```
packages/reintent-core/src/
├── intent.ts       intent(): kinds, words, data; KindOf / DataOf
├── part.ts         part(), collect (pure), runPart, render; useIntent / useDerived / useCell / useLazy
├── program.ts      the program as data: what parts declared; cells, signature
├── doc.ts          the doc; narrow / believe / learn; reconcile
├── decide.ts       values(): the rule; questions, staleCells
├── effect.ts       effect(): eager and lazy, cached under kinds
├── root.ts         createRoot(): evaluate / view (read), hold / release / flush (declare), actions, log, undo, preview, watch
├── index.ts        the core: everything above, nothing below
├── words.ts        library: a sentence → resolve / ask / infer / context
├── observe.ts      library: the state as text, what a model is shown
├── devtools.ts     library: window.__reintent, how a host opens itself to an inspector
└── react.ts        binding: ReintentRoot, Thing, Scope, useIntent, reactPart / usePart, useCell
packages/reintent-core/test/
├── core.test.ts    each rule, parts, and the words library (pnpm reintent:test)
└── fixture.ts      hooks typed by their intent (pnpm reintent:typecheck)

experiences/reintent/      The Wardrobe, its things drawn by parts on the core
├── kinds.ts               the intent types
├── parts.tsx              him and the wardrobe as the model wrote them: intents in, drawing out
├── parts.v2.tsx           the same, as the model rewrote them
├── model.ts               a stand-in model, in rules: extend a scale; believe again under a new context
└── main.tsx               the root, the director (the pace, a React useIntent under <Thing id="wardrobe">), the devtools
app/lab/reintent/          the lab: the frame, and a panel driving the root through window.__reintent
```

The Wardrobe's stage is shared. `experiences/wardrobe/Wardrobe.tsx` exports
`WardrobeStage({ rd, things })`: the timeline poses him and the wardrobe, and
`things` draws them. The original experience draws them from `rd`
(`packages/intents`). This host draws them with its parts. The pace is time,
not a drawing, so the director declares it where it uses it, with the React
`useIntent` (`usePace` in each parts file). The wardrobe then has two holders:
the part holds `door`, and the director's hook holds `pace`.

## In the lab

`/lab/reintent` frames `/scenes/reintent/` beside a panel.

| | |
|---|---|
| Program | switch v1 ⇄ v2 (the model's rewrite of the parts). The report says which cells are new or gone, and which decisions were kept, wait, or came back. Under v2, a person's `absurd` hat waits (v2 has no `absurd`), the pace follows the door, and his gaze is asked only away from the window (an `if` around its hook) |
| Say | `帽子大一点` steps along the scale. `帽子还要大` goes past its end, where the stand-in learns a kind. `门慢一点` is the pace (its own step words). `别看我` is a kind, not a refusal. `帽子不要大得离谱` rules a kind out. `更压抑一点` is said of the whole: beliefs go stale, and the stand-in infers them again |
| Asked, Cells | answer, decide, rule out, forget. Each value shows who said it |
| What happened | the log, cell by cell |
| Details | what a model is shown (`observe`), the program's source, the doc |

## Not yet

- **Index (values that cross over along one dimension of the context).** `/lab/screens` keeps this from the vendored `reintent`. Here it would be a decision that depends on context.
- **One-flip alternatives and their previews.** `root.preview()` is the base for them.
- **Words bound to the program (spans).**
- **Statically reading a part's cells without running it.** For now, the program is what the last run declared.
- **A real model behind `extend` and `rebelieve`.**
- **Saving and sharing the doc.**
