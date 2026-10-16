# Reintent in the Lab: intents beyond resize

Reintent (vendored from Huxpro/airtalk#818 into `packages/reintent/`) is a
**reactive, intent-oriented programming model**. It is not just a responsive
layout tool. It works like React:

```
model ──intent tree──▶ data ──▶ compute (reintent) ──▶ view
                        ▲                               │ an event (drag, resize, a sentence)
                        │                               ▼
                        ├── ① preset intent: resolve ◀── recognizer
                        │                               │ cannot read it
                        └── ② new intent tree ◀── model infer ◀┘
```

- **The intent tree is the state, and the only source of truth.** reintent decides what each
  intent is now (a person's pick > a confident model > code; when unsure, it either asks or
  switches). Its output is projected to coordinates and drawn.
- **Every interaction is an event, and its callback produces a new intent:**
  - ① A hit on a preset is Flux: `resolve` straight into the tree, without calling a model.
  - ② A miss is ReAct: the model sees the current tree and this event, and writes a new tree,
    which comes back through `replace`. It is an async effect.
  - Both go through the same `reduce(state, action)`.
- **Context covers more than screen size.** Every prompt the person has said is context too.
  The model reads all of it at each inference.

## Where it lives

The loop is now a package, `packages/intents` (docs/system-intents.md), and it
runs inside the experiences themselves. It is laid open in **Inspect**, which is
the mainline:

| | What it shows | Files |
|---|---|---|
| `/lab/wardrobe` → Inspect | The Wardrobe reads its hat, gaze, where he stands, and the door's reach and pace through its tree. Drag on the frame, say a sentence, answer, lean as a viewer, save, share | `experiences/wardrobe/intents.ts` · `systems/lab/components/intents-panel.tsx` |
| `/lab/dream` → Inspect | A player for dreams written as trees. Tell it a dream: a new tree, the same code | `experiences/dream/` |
| `/lab/screens` One Dream, Any Screen | Resize as context, in depth. On 10 screens plus any size: framing as an indexed intent, crossing over by the screen's shape. "Keep" decisions, to ask or to set as a rule. One-flip alternatives | `app/lab/screens/`: `host.ts` types and solver · `capture.tsx` the scene measured |

The first prototype, the standalone `/lab/intents`, is folded into the
package and removed.

A real model answers through `app/api/intents/infer`: Claude Haiku 5.5 for the
weak tier, Claude Opus 5.5 for the strong one. `observe()` is exactly what it is
shown. Without credentials, the recorded stand-in answers instead, and the
event log says so.

## Brainstorm: events → intents

✓ built in the labs · ○ proposed

| Event | ① What hits a preset (Flux) | ② When it misses (ReAct) |
|---|---|---|
| Drag a thing ✓ | Dropped within `DOCK` of a known place → `place = that place` | Dropped somewhere new → the model learns a place (by region and depth) and the drag becomes the person's pick |
| Drag a continuous value (the door) ✓ | Snaps to the nearest kind | Left between two kinds → the model learns a kind ("33% open"), nameable from then on |
| Resize ✓ | Context only: reintent recomputes. An indexed intent crosses over by shape; a person's switch moves the crossover to that screen | (none) |
| Reprompt an entity ✓ | The sentence's words hit an intent's or a kind's `aka` (帽子大一点 hat bigger · 关上门 close the door · 站到窗边 stand by the window) | Several readings → ask (reintent's ask). Past the end of an ordered intent's scale → the model adds a kind further along. An indefinite (一盏灯, "a lamp") brings in something new → the model adds a node with its own intents, and drawing it is a lazy effect |
| A rule (scope: all) ✓ | "His face must always be in frame" → a preference over every subject of the type | |
| Tell a whole dream ✓ | | The strong model writes a new tree (the cast, a node per beat), and the dream player plays it: new content, the same code |
| A global prompt ("make it more oppressive") ○ | | It goes into context. The model's beliefs are a cache under that context: when the context changes they go stale and are re-inferred, and decisions the person made stay |
| Timing ("门慢一点", the door slower) ✓ | A scene's beats are ordered intents too (the Wardrobe's door pace; a dream beat's hold) | Past the end → a learned beat length |
| Inspector sliders ○ | An override is a person's decision; a continuous value snaps to a kind | Between kinds → a learned kind (the same as the door) |
| Regenerate a thing (the model rewrites a drawing) ✓ partly | | A lazy effect cached `under` the Assignment it was written for: a stale one is kept, not shown. A person's picks survive `replace` by key (React's keys) |
| Undo / forget ✓ | Undo is the reducer's history. Forgetting a decision hands it back to the model and code | |
| Parked home-screen windows, the Band Lab's overflow strategies ○ | These are intents already: a few closed choices, decided by person > preference > code | A layout no preset covers → a new tree |
| Several viewers ✓ | Per-viewer preferences as a layer of `prefs`, in context: they never override an author's pick | |
| Share and remix ✓ | A version as a `#v=` link; opening one and changing it makes a child version | |

## What building it taught (feedback for reintent)

1. **On an indexed type, `narrow` turns `at: 'auto'` into an explicit crossover.**
   - Every screen taller than the switched one is then forced to the base kind, even where code
     had chosen otherwise.
   - So the base kind has to be one that is always feasible. This is why `/lab/screens` changed
     from crop / fit / whole to fill (crop, stepping back as far as needed) / whole.
2. **`effect` requests a write only when its cache already holds something.** The first drawing
   of a thing that has just been inferred has to be requested by the infer step itself
   (`Inference.draw`).
3. **The recognizer needs a few linguistic rules.** Word matching alone gets them wrong:
   - An indefinite (一盏灯, "a lamp") introduces a new referent. If the tree has nothing it
     could name, the event must go to ②; otherwise "床头放一盏灯" (put a lamp by the bed) is
     misread as *the man's place = bedside*.
   - If the sentence names an intent, only that intent can be read. Otherwise, with the hat
     already at its largest, "帽子大一点" (the hat, bigger) resolves to the door.
   - Past the end of an ordered intent is a miss, not "no change".
4. **`replace` needs to reconcile by key:** a person's pick is kept wherever its intent and kind
   still exist. These are React's `key`s.
5. **On path ②, a person's gesture becomes two actions: `replace` + `decide`.** The model
   changes the vocabulary (the kinds); the choice stays the person's (`from="dragged"`).
6. **A preset is a learned kind after its first use.** After an event that took path ②, the same
   kind of event hits a preset the next time (the lamp: "关灯", lights off, resolves at once).
   The tree's vocabulary grows from use; this is how the intent model learns.

7. **`resolve` is per type, not per subject.** A dream's beats share the intent `where`, so
   whether one beat asks or switches is decided by the first beat's. Every beat's `where` asks,
   and a confident beat never does: a confident model wins first.
8. **What is on screen is context.** In a dream, "门开大一点" (the door, wider) is about the beat
   being played. The runtime takes a `focus`, the node on screen, and a sentence that names no
   node leans to it. A sentence that names one ("第一幕…", the first beat) is about that node only.

## Next

- Make context prompts drive belief caching: when context changes, beliefs go stale and are
  re-inferred.
- Fold the scene layer's overrides and beats into the same tree, so the Inspector's sliders are
  events into the loop too.
- Any surface (the screens lab's framing, in the experiences themselves), and intents as tests.
