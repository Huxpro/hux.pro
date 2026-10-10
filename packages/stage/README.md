# stage

React on top, the original drawing underneath. Three layers:

| Layer | What it is | Who changes it |
| --- | --- | --- |
| **Scene** (`*.scene.tsx`) | One JSX tree of placed kinds and words, with the phases (`machine`) and the `rules`. Data only: literals and the bindings `ref`, `after`, `at.*`, `rule.*`. | An editor writes values back (`pnpm scene:patch`); a model edits the tree. |
| **Kind** (`kind({...})`) | One sort of thing on the stage: `init`, `step` (simulated, seeded), `frame` (pure in props and time), `draw`, `measure`. The only place logic lives. | A model regenerates one, keeping its params. |
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
| Words sit by anchors (`at.below("light", 16)`), placed from what was drawn | the host |

## Edits

```bash
pnpm scene:patch app/dream/everyone/everyone.scene.tsx light approach 2.4   # "slower", no model
```

With `?sem` or `?inspect`, `window.__stage.set("light", "approach", 2.4)` is the same edit, live.

## Checks

```bash
pnpm stage:test      # the machine, the scene tools, the host's frame
pnpm stage:typecheck
pnpm scene:check
```
