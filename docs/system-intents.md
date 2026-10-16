# Intents

A framework for a model and a person making something together. The model
drives everything. When a strong model makes an artifact (an experience, a
dream), it writes its **intent tree** along with the code. The tree says what
the model means by each part, how sure it is, and what else it might have
meant. Everything after that is a shortcut through the tree:

```
                         ┌──────────── the intent tree (the one state) ────────────┐
 strong model ──writes──▶│ nodes → intents → kinds { realize } · beliefs p · picks │──▶ reintent ──▶ realize ──▶ view
                         └──────────────────────────────▲──────────────────────────┘          (code computes)
                                                        │ reduce(state, action)
   event (drag · say · answer · lean · dream) ──▶ recognize ──┬─ ① resolve   a person's pick, no model
                                                              ├─ ask         two readings, or the model unsure
                                                              ├─ context     a prompt said, a viewer's leaning
                                                              └─ ② infer     routed: weak model (a kind more)
                                                                                     strong model (a new thing, a new dream)
```

- **Code evaluates.** Reintent decides each intent's value from the tree, in
  this order: a person's pick, then a viewer's leaning, then a confident model
  (margin ≥ TAU), then code. The host's `realize` turns a kind into numbers in
  the scene's units.
- **A person resolves.** A drag that lands near a kind, a sentence whose words
  name one, an answer to a question. These are Flux: straight into the tree,
  with no model.
- **A model infers again** when no preset reads the event (ReAct). The router
  sends it to a **weak** model when it only needs a kind more on an intent that
  exists (learn a place, learn a value, extend a scale). It sends it to a
  **strong** model when the tree cannot hold the answer at all (a new thing, a
  sentence nothing is about, a new dream). Both answer in one schema, and the
  answer is reduced into the same tree.

## The tree

`packages/intents/src/tree.ts`

| | |
|---|---|
| `Tree` | `scene`, `title`, `prompt` (the words it came from), `by`, `nodes`, and for a dream told in beats, `phases` |
| `Node` | a thing (`draws`: a library thing; or `drawings`, written by a model, sanitized) with its `intents`, its own `prompt`, and `learned` if a model added it after an event |
| `Intent` | a closed set of `kinds`, the model's belief `p`, `resolve` (`ask` or `switch` when unsure), `ordered` with `more`/`less` words, a `gesture` (which drag reaches it), and a person's `pick` with how it was made (`from`) |
| `Kind` | `label`, `aka` (the words that name it), `realize` (what it means in the picture), and `learned` if a model added it |
| provenance | `By { who, model?, event? }` on the tree, on learned kinds, nodes and drawings |

Actions: `decide · forget · replace · load · draw · context`. `replace` rebases
by key: a person's picks, learned kinds and nodes, and drawings carry over to
the model's next tree wherever they still exist (React's keys). `load`
replaces the tree whole, for a new dream.

## The loop in an experience

```ts
const intents = useIntents(TREE, HOST, focus?);          // packages/intents/src/runtime.ts
realized(intents.state.tree, intents.values, "man", "hat").hatScale  // what the picture reads
```

- `TREE` is the model's tree, kept beside the code (`experiences/<name>/intents.ts`).
- `HOST` says what the router, and a real model, need about the scene:
  - `grammar`: the units, the library things, the realize fields;
  - `recorded`: the strong model's answers, kept for when no model is reachable;
  - `recordedDrawing`, `placeName`;
  - `shape`: the experience's conventions, laid over any tree a model writes
    (a dream's beats get their gesture and their "longer").
- `focus` is the node on screen now, or a function from the tree to it (a dream's
  beat). A drag means that node's gesture. A sentence that names no node leans
  to it.
- `intents.preview` is the drag in progress: the view's own temporary state. The
  dragged thing follows the pointer, and the tree changes only when the drag
  becomes an event.
- The loop opens itself as `window.__intents` (`IntentsApi`) for Inspect:
  - `get` returns a snapshot (cached for `useSyncExternalStore`) with the tree,
    values with their sources, asks, the event log with each event's path, tier
    and the observation a model was shown, changes, and the version;
  - `subscribe`, `dispatch`, `preview`, `undo`, `forget`, `reset`, `save`,
    `share`, `open`.

## Models

`app/api/intents/infer/route.ts`, `@anthropic-ai/sdk` with structured outputs:

- **weak**: Claude Haiku 5.5, low effort.
- **strong**: Claude Opus 5.5, high effort, refusals falling back server-side.

The answer has one fixed shape (`Answer`: kinds to add, nodes to add, picks,
phases and a title for a dream). Strict-schema friendly, it is the same shape
the recorded stand-in returns. A drawing is a lazy effect, asked of the strong
model after a node needs one. Until then a placeholder is drawn, and the SVG
that comes back is sanitized (`sanitize.ts`, a whitelist).

Without credentials the route answers 501, and the client stands in, saying so:
the event log marks each inference as "live" or "stand-in". The weak stand-in
is generic rules. The strong stand-in is the host's `recorded`: for the dream,
a composer that cuts the words into beats.

## Versions: the tree is the data

- **Saved.** `save()` writes `content/scenes/<scene>.intents.json`. It works in
  dev only, through `app/api/scenes/intents`; production answers 403. The file
  is copied to `public/scenes/_data/` by `experiences:build`. The experience
  loads it over the code's tree on start: rebased if it is the same piece, whole
  if it is another dream. Regenerate the code, and the author's decisions carry
  over.
- **Shared.** `share()` gives the version as `#v=…`: the tree, deflated and
  base64url'd into the fragment. The lab hands the fragment to the frame, so a
  link opens in Inspect as well as full screen. Opening a version and changing
  it makes a new version whose `parent` it is (a remix).
- **Viewer leanings.** A viewer's preference per intent type (reintent's
  `prefs`) lives in context, not in the tree. It never overrides what the
  author picked. Its source shows as "viewer" only where it changed the value.

## Where it shows

| | |
|---|---|
| `/lab/wardrobe` → Inspect | live editing of a written experience. Drag him or the door on the frame; say "帽子大一点 · 门慢一点 · 床头放一盏灯 · 关灯"; answer the model's question about the hat; see every value's source; undo, forget, save, share |
| `/lab/dream` → Inspect | a player for dreams written as trees (`experiences/dream`). Tell it a dream: the strong model (or the composer) writes a new tree, and the same player plays it. Answer where the model was unsure; drag him in a held beat |
| `systems/lab/components/intents-panel.tsx` | the panel: say, tell a dream, asked, now (values, sources, leanings), events, versions, the tree as XML |
| `systems/lab/components/inspector.tsx` | the overlay: a drag on a thing an intent's `gesture` names is a loop event; a click selects |

## Files

```
packages/reintent/          Reintent, vendored (Huxpro/airtalk#818): types, cells, decide, beliefs, prefs
packages/intents/src/
├── tree.ts        the tree, actions, reduce, rebase, toXml, changes
├── space.ts       the tree as reintent types; values() with each value's source
├── recognize.ts   events → resolve / ask / context / infer (a need); gestureFor, dragValue
├── router.ts      tiers, the Answer shape, applyAnswer, observe, infer, draw, the weak stand-in
├── runtime.ts     useIntents(): the loop as a hook, window.__intents
├── version.ts     saved and shared versions
└── sanitize.ts    a model's SVG, whitelisted
experiences/wardrobe/intents.ts   the Wardrobe's tree and host
experiences/dream/                the dream player: intents.ts (first tree, beat grammar, composer), play.ts, Dream.tsx
experiences/common/things.ts      the recorded answers any dream shares (a lamp, a cat) and their drawings
experiences/common/learned.tsx    things a model added, drawn from the tree
app/api/intents/infer/route.ts    the models
app/api/scenes/intents/route.ts   save (dev only)
content/scenes/*.intents.json     saved trees
```
