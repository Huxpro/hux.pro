# Scene

A thin semantic layer over React for short interactive scenes (the
experiences in `/lab`). Every thing a person could name is declared, measured,
overridable and verifiable; what it draws stays free.

```
packages/scene/src/
├── spec.ts        Declaration, num(), choice(): what a thing is called, its parts, its params
├── path.ts        entity[instance].part paths: parse, prefixes, reaches (selection)
├── semantic.tsx   semantic(decl, Render), <Part>, <Atmosphere>: the one boundary
├── stage.tsx      <Stage>, useTime, useFrame, useFlag, <Draw> (canvas)
├── clock.ts       the one source of time; freezes for stills
├── registry.ts    what is on stage, overrides, draws, flags
├── measure.ts     geometry boxes, and the pick buffer (visible boxes, hit tests)
├── verify.ts      the checks an author (or a model) runs after writing a scene
├── api.ts         window.__scene: the running scene, open to an inspector
└── language.ts    LanguageLayer: the words a scene came from, and their meaning

experiences/<name>/        each experience, a Vite page built into public/dreams/<name>/
systems/lab/components/inspector.tsx   the lab's inspector, driving window.__scene
scripts/scene-verify.mjs   pnpm scene:verify: every experience, verified headless
```

## Why React, and what is ours

React already gives components, props, keys, a pure render, hot reload, and
the shape models write best (TSX). It does not give a name that survives a
rewrite, a schema for props, time as an input, or a way to say where a thing
is on screen. Those are the layer:

| need | from |
|---|---|
| components, instances, props | React |
| render = f(state, t), any moment can be held | `useTime()` from the stage's clock (the Remotion idea) |
| a stable name for each thing | `semantic({ id })`, paths `entity[instance].part` |
| a schema: inspector sliders, validation, words | the declaration's `params` (`num`, `choice`) with ranges, `aka`, `affects` |
| an edit that survives regeneration | overrides, by path or entity, laid over the props the code passes |
| where it is | geometry (SVG boxes) and the pick buffer (visible pixels), per path |
| more than one backend | SVG through react-dom; canvas through `<Draw>`; both measured the same way |
| proof | `verify()`: declared, expected, deterministic, covered, local |

No custom reconciler. A WebGL scene would put R3F inside the boundary the
same way `<Draw>` puts canvas there; its pick pass would draw each path in
its colour, as the canvas one does.

## Writing a scene: the rules

Inside a semantic component, draw anything. Around it, five rules. Each one
is checked by the verifier, and each failure message says what to do.

1. **Time comes from `useTime()`.** Never `performance.now()`, `Date.now()`,
   or a CSS animation on something semantic. Seed randomness. (Checked: the
   same held moment is drawn twice, the second time with the wall clock
   pushed hours ahead.)
2. **Anything nameable is a `semantic()` or a `<Part>`.** A hand, a hat, a
   door. Below that, any detail. Glows, grain, a second image in a dream:
   `<Atmosphere>`. (Checked: every pixel drawn belongs to a declared path.)
3. **Turnable numbers are params, read from props.** Not literals in the
   drawing. Say what each one may move (`affects`), and whether it changes
   shape or only appearance (`effect`). (Checked: turning a param moves its
   own parts and nothing else, and a shape param moves something.)
4. **Declare before use.** A part name that is not in the declaration, or an
   entity nothing declares, fails. Add it to the declaration in the same edit.
5. **Say what each still shows.** `stills` on the stage, with `expect`.
   They are the moments an inspector, a thumbnail or a sentence can go to.

Sound, haptics and input are side effects: they go in `useFrame` (or event
handlers), never in render.

## The boundary

```tsx
export const Man = semantic(
  {
    id: "man",
    kind: "character",
    aka: ["他", "黑衣人", "鬼", "the man"],
    parts: ["hat", "head", "eyes", "body"],
    params: {
      hatScale: num(1, { min: 0.6, max: 2, aka: ["帽子大小"], affects: ["hat"] }),
      eyes: num(0, { min: 0, max: 1, affects: ["eyes"], effect: "appearance" }),
    },
    instances: { wardrobe: "衣柜里", bedside: "床头" },
  },
  ({ hatScale, eyes }) => (
    <>
      <Part name="body">…</Part>
      <Part name="hat" transform={`… scale(${hatScale}) …`}>…</Part>
      <Part name="eyes" opacity={eyes}>…</Part>
    </>
  ),
);

<Man instance="bedside" transform="translate(236 872) scale(1.9)" />
```

The boundary registers the instance, lays overrides over its props, wraps
what it draws in `<g data-sem="man[bedside]">` and tells the parts inside
whose they are. Placement (`transform`, `clipPath`, `opacity`, `mask`) is the
caller's; params are the thing's.

## Measuring

- **Geometry**: every shape's bounding box, owned by its nearest `data-sem`.
  A thing inside another (the man in the wardrobe) is his own, and does not
  grow his host. Occlusion is ignored.
- **Visible**: the pick buffer. The svg is cloned, every shape recoloured to
  its owner's flat colour (atmosphere removed, no filters, no antialiasing),
  rasterised; then every `<Draw>` runs again through a context that paints in
  its path's colour. A colour's box is what can be seen of that thing; a pixel's
  colour is a hit test. Unclaimed pixels are magenta, and reported.

## The inspector

`/lab/<experience>` → Inspect. The four layers line up: the words
(`language.prompt`), what they meant (`language.concepts`), the declarations
(`__scene.manifest()`), and what is on stage (`__scene.snapshot()`, four times
a second). Select in any layer or click the frame. A selected thing's params
are sliders; moving one is an override. Verify runs the checks on every still.
"Draw something undeclared" flips a flag the scene answers with a shape outside
every declaration, so the coverage check has something to find.
