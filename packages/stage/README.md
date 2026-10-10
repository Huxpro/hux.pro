# stage

React on top, the original drawing underneath. Three layers:

| Layer | What it is | Who changes it |
| --- | --- | --- |
| **Scene** (`*.scene.tsx`) | One JSX tree of placed kinds and words, with the phases (`machine`) and the `rules`. Data only: literals and the bindings `ref`, `after`, `at.*`, `rule.*`. | An editor writes values back (`pnpm scene:patch`); a model edits the tree. |
| **Kind** (`kind({...})`) | One sort of thing on the stage: `init`, `step` (simulated, seeded), `frame` (pure in props and time), `draw`, `measure`; optionally `pointerDown` / `pointerUp`, `enter` (a phase began), `dispose` (let go of an audio context). The only place logic lives. | A model regenerates one, keeping its params. |
| **Host** (`Stage`) | The loop, the canvas, input, the machine, DOM anchors; tells sem what was drawn. | Rarely. |

React renders a scene only when its phase changes; every frame is the host's.
Each node is in sem as `<scene>/<id>`, with its kind's intent, names, params
(their current values), source and links, measured from what it drew, so the
inspector (`?inspect`), the rules and `outline()` work with no annotations.

## The constraints, and what holds each

| Constraint | Held by |
| --- | --- |
| A scene is data: no statements, hooks, expressions or spreads; every node a unique literal `id` | `pnpm scene:check` |
| A kind is reproducible: time from `ctx.t`, randomness from `ctx.rng`, no timers | ESLint (`STAGE_KINDS` in `eslint.config.mjs`) |
| Phases keep time on the stage's clock (`after`), not `setTimeout` | the machine; the lint above |
| Words sit by anchors (`at.top`, `at.bottom`, `at.middle`, `at.below("light", 16)`, `at.between("sun-ring", "contours")`), placed from what was drawn | the host |
| A scene keeps its rules (`rule.clear`, `below`, `inside`, `aligned`, `atLeast`, `onScreen`, `minTarget`) at every size | `?inspect`, `window.__sem.check()` |
| Stage time is wall time on a slow device (a one-second hold is a second at 5 fps); only a gap over `MAX_DT` (a hidden tab) is cut short | the host |

## Edits

In `?inspect`, pick a node: each numeric param is a slider, live as you drag
(a param marked `live: false` takes effect when the scene starts again, `↻`).
"save to source" writes the values back into the scene file as literals,
through the dev server's `/api/scene` (development only; a production build
shows the command instead). The same edit from a terminal:

```bash
pnpm scene:patch app/dream/everyone/everyone.scene.tsx light approach 2.4   # "slower", no model
```

With `?sem` or `?inspect`, `window.__stage.set("light", "approach", 2.4)` is the same edit, live.
A write is refused when the value there is not a literal, or when the scene
would no longer pass `scene:check`.

## Scenes

| Scene | Kinds |
| --- | --- |
| `app/dream/everyone` | globe, voices, light, chime |
| `app/dream/blue` | contours, sun-ring, sea, sun, surf |
| `app/dream/forget` | window, edge, tide, moments, dust |

## Checks

```bash
pnpm stage:test      # the machine, the scene tools, the host's frame, the rules
pnpm stage:typecheck
pnpm scene:check
```
