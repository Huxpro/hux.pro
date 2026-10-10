# sem

A semantic layer over whatever draws the page. It never draws. It says what
each thing on the screen is, why it is there, where it is now and which rules
it keeps, the same way for the DOM, SVG, Canvas 2D and WebGL, retained or
immediate. It is for a person looking at the page (the inspector) and for
whoever has to change it next, a model included: a reference like "the light"
finds the node, and the node knows its knobs, its source and its constraints.

## A node

One thing a person could name and might want changed. A thousand particles are
one node (a population: `count` and `item(i)`), not a thousand.

```ts
import { sem } from "sem";

const dispose = sem.node({
  id: "everyone/light",              // stable across rewrites; `renamedFrom` keeps old ids working
  parent: "everyone/scene",
  kind: "agent",                      // open vocabulary
  names: ["the light", "那一点"],      // how people say it
  intent: "The one picked out of everyone: it comes forward and says hello.",
  backend: "canvas2d",
  measure: () => ({ circle: [light.x, light.y, light.r] }),   // null when not on screen
  state: () => ({ phase }),
  params: { APPROACH: { value: 1.8, unit: "s", range: [0.8, 3] } },
  links: [{ rel: "drives", to: "everyone/line" }],
  source: { file: "app/dream/everyone/view.tsx", symbols: ["frame", "APPROACH"] },
});
```

Everything live (`measure`, `state`, `count`, `item`, `visible`) is a function
the layer calls only when somebody looks. Nothing is pushed per frame; a scene
nobody inspects costs a Map of declarations.

All shapes are `rect`, `circle` or `poly`, in viewport CSS px. A node whose
numbers are local to an element (a canvas off the origin) names it as `space`.

## Any backend

| Backend | How a node gets its place |
| --- | --- |
| DOM | `elementNode(el, decl)`, or in React `ref={useSemElement(decl)}`: the client rect, and visibility from `checkVisibility` and opacity. Markup alone works too: `data-sem-id` / `-kind` / `-intent`, then `scan(layer)`. |
| SVG | The same calls: an SVG shape is its own box carried through its screen transform, so a rotated rect is a rotated outline. |
| Canvas 2D, immediate | A `measure` closure over the loop's own state, e.g. `() => ({ circle: [x, y, r] })`. |
| WebGL | `projectPoint` / `projectBox` / `projectSphere` with the camera's view-projection matrix (column-major, as WebGL and three.js keep it), and the canvas as `space`. |

## Reading it

| Call | Returns |
| --- | --- |
| `snapshot()` | Every node's shape, bounds, visibility and state, as JSON. |
| `outline()` | The scene as a short text tree, one line a node, then the rules. Cheaper than a screenshot and exact. |
| `at(x, y, snap?, { slop })` | What is under a point, topmost first; a population's member is `id#i` and outranks outlines; with `slop`, the nearest member within reach. |
| `select(id)` | What it takes to regenerate one node: the node, its ancestors and children, links both ways, and the rules over it. |
| `check()` | Every node's `invariants`, run against a snapshot. |

```
everyone/scene  scene·none 844×390  rect(0,0,844,390)  touched=true
  everyone/globe  field·canvas2d  off-screen  count=1200 turning=false
  everyone/light  agent·canvas2d  circle(422,194,71)  phase="here" drives→everyone/line
  everyone/line  text·dom  rect(365,278,115,20)
  everyone/again  control·dom  rect(370,340,44,44)
rules:
  ✓ line-below-light: the closing line sits below the light, clear of its glow
  ✓ touch-targets: the way out is at least 44px to a finger
```

## Rules

An invariant is a sentence for a person and, when it can be, a check:
`{ id, text, check: (snapshot) => true | "why not" }`. Layout claims that used
to need screenshots at five sizes ("the caption keeps clear of the globe") run
as `check()` at each size instead.

## Devtools

`useSemDevtools()` reads the address: `?sem` puts the layer on
`window.__sem` (for the console or a Playwright script); `?inspect` also draws
the inspector (`window.__semInspector`): every node's shape in its backend's
colour (DOM blue, SVG purple, Canvas amber, WebGL green; dashed when hidden),
and a panel with the picked node, the rules and the outline.

The inspector has two modes, switched by the button in the corner or the
<kbd>`</kbd> key:

- **inspect** (the default): the page is under glass. A sheet over the whole
  screen takes every touch, click and key, so nothing reaches the page. A tap
  picks the topmost node under the finger, a population's nearest member
  within 12px of it (3px for a mouse); tapping the same spot again goes one
  deeper (a light, its field, the scene), even while things move. Esc goes
  back to live. `?inspect=live` starts in live.
- **live**: the page works as usual and the shapes stay drawn. On a desk,
  shift-click still picks, and the page never hears that click.

A population can name its members (`itemName(i)`), so `forget/moments#0`
reads as "your cat"; `select()` returns the member's own shape and name.

A node that can be changed while it runs (`set(param, value)`) gets a slider
per numeric param in the panel. A node that says where it is written
(`edit: { file, id }`) also gets "save to source", which hands the changed
values to the `save` given to `useSemDevtools(layer, { save })`; without
one, the panel shows the command that would do it.

## Checks

```bash
pnpm sem:test        # geometry and the layer, in Node
pnpm sem:typecheck
```
