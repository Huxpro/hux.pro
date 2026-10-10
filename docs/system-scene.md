# Scene

A thin semantic layer over React for short interactive scenes (the
experiences in `/lab`). Every thing a person could name is declared, measured,
overridable and verifiable; what it draws stays free.

```
packages/scene/src/
├── spec.ts        Declaration, num(), choice(): what a thing is called, its parts, params, state
├── timeline.ts    timeline(), beat(): when things happen, the phases, the inputs
├── path.ts        entity[instance].part paths (and beat.x, phase.x, input.x): parse, reaches
├── semantic.tsx   semantic(decl, Render), <Part>, <Atmosphere>: the one boundary
├── stage.tsx      <Stage>, useTime, useTimeline, useFrame, useFlag, <Draw> (canvas)
├── clock.ts       the one source of time; freezes for stills
├── registry.ts    what is on stage, overrides, draws, flags
├── measure.ts     geometry boxes, and the pick buffer (visible boxes, hit tests)
├── verify.ts      the checks an author (or a model) runs after writing a scene
├── api.ts         window.__scene: the running scene, open to an inspector
└── language.ts    LanguageLayer: the words a scene came from, and their meaning

experiences/<name>/        each experience, a Vite page built into public/scenes/<name>/
                           (every folder with an index.html; common/ and _* are shared code)
systems/lab/components/inspector.tsx   the lab's inspector, driving window.__scene
scripts/scene-new.mjs      pnpm scene:new <name>: a new experience, already passing
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
| a schema: inspector sliders, validation, words | the declaration's `params` and `state` (`num`, `choice`) with ranges, `aka`, `affects` |
| when things happen, named | `timeline()`: beats (`beat.door`: at, over), phases, inputs |
| an edit that survives regeneration | overrides, by path or entity (or `beat.door`), laid over what the code passes |
| where it is | geometry (SVG boxes) and the pick buffer (visible pixels), per path |
| more than one backend | SVG through react-dom; canvas through `<Draw>`; both measured the same way |
| the words it came from | `<Stage language>`: the prompt's spans and concepts, each resolving to a path |
| proof | `verify()`: declared, expected, deterministic, covered, local, phase, language, atmosphere |

No custom reconciler. A WebGL scene would put R3F inside the boundary the
same way `<Draw>` puts canvas there; its pick pass would draw each path in
its colour, as the canvas one does.

## Writing a scene: the rules

Inside a semantic component, draw anything. Around it, six rules. Each one
is checked by the verifier, and each failure message says what to do.

1. **Time comes from `useTime()`; timing from the timeline.** Never
   `performance.now()`, `Date.now()`, or a CSS animation on something
   semantic. Seed randomness. A number of seconds that says when something
   happens, or how long it takes, is a beat (`beat.door.at`, `.over`), read
   from `useTimeline()`. (Checked: the same held moment is drawn twice, the
   second time with the wall clock pushed hours ahead.)
2. **Anything nameable is a `semantic()` or a `<Part>`.** A hand, a hat, a
   door, a beam of light. Below that, any detail. Glows, grain, a rim of
   light on a thing, a second image in a dream: `<Atmosphere>`. (Checked:
   every pixel drawn belongs to a declared path; no atmosphere covers most
   of the frame on its own.)
3. **Numbers are params or state, read from props.** A number that shapes a
   thing (a hat's size) is a param: turning it is an edit. A number the scene
   drives every frame (how far a door stands open) is state: overriding it
   pins it. Never a literal in the drawing. Say what each one may move
   (`affects`), and whether it changes shape or only appearance (`effect`).
   (Checked: turning one moves its own parts and nothing else, and a shape
   one moves something.)
4. **Declare before use.** A part, an instance or an entity nothing declares
   fails, and so does a word in the language layer that points at one. Add it
   to the declaration in the same edit.
5. **Every phase has a still.** `stills` on the stage, each with its
   `phase` and what it should show (`expect`); `<Stage phase>` says which
   phase the scene is in. They are the moments an inspector, a thumbnail or
   a sentence can go to.
6. **Side effects outside render.** Sound, haptics and input go in
   `useFrame` or event handlers, never in render. (Not checked: say it in
   review.)

## Writing a new scene: the order

`pnpm scene:new <name>` writes the files, already passing. Then, in order,
each step a small diff the verifier can check before the next:

1. **`semantics.ts`**: the words it came from, the spans that name things, and
   what each was taken to mean. This is the plan: every ref is a path that
   must exist by the end.
2. **`entities.tsx`, declarations first**: one `semantic()` per thing the words
   name, with its `aka`, parts, params (what it is) and state (what is done to
   it), and instances where it appears in more than one place.
3. **`timeline.ts`**: beats, phases and inputs; the state machine; `view(state,
   t, timeline)`, the whole picture as a function; a still per phase.
4. **The drawings**, inside the boundaries, reading params and state.
5. **The scene and the director** (`<Name>.tsx`): the scene from `view()`;
   input in, state on, sound out.
6. **`pnpm scene:verify <name>`**, and fix until it passes.

## The timeline

```ts
export const TIMELINE = timeline({
  beats: {
    snap: beat(1.0, { aka: ["睁眼"], note: "the eyes snap open" }),
    door: beat(9.5, { over: 6.5, aka: ["柜门打开"], note: "the door begins to open" }),
  },
  phases: { gap: { label: "门缝" }, inside: {}, bedside: {}, awake: { aka: ["我醒了"] } },
  inputs: {
    hold: { aka: ["按住", "闭眼"], params: { minBlink: num(0.52, { min: 0.1, max: 2, unit: "s" }) } },
  },
});

<Stage timeline={TIMELINE} phase={PHASES[state.stage]} language={LANGUAGE} stills={STILLS} …>

const tl = useTimeline(TIMELINE);   // tl.beat.door.at, tl.beat.door.over, tl.input.hold.minBlink
```

Overrides reach it like any other: `setOverride("beat.door", "over", 12)` is
"门慢一点", and the scene, its stills (set against the beats) and its sound
follow, with no code changed.

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
    },
    state: {
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
caller's; params and state are the thing's.

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

`/lab/<experience>` → Inspect (`<ExperienceShell inspect>`). The four layers
line up: the words (`__scene.language().prompt`), what they meant
(`.concepts`), the declarations and the timeline (`__scene.manifest()`,
`__scene.timeline()`), and what is on stage (`__scene.snapshot()`, four times
a second, with the phase). Select in any layer or click the frame. A selected
thing's params and state are sliders, and so are a selected beat's time and
length; moving one is an override. Verify runs the checks on every still.
"Draw something undeclared" flips a flag the scene answers with a shape outside
every declaration, so the coverage check has something to find.
