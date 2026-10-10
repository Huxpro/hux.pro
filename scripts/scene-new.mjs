// =============================================================================
// pnpm scene:new <name>: a new experience, already passing the verifier.
//
// Writes experiences/<name>/ with the shape every scene has (docs/system-scene.md):
//
//   index.html, main.tsx   the page
//   semantics.ts           the words it came from, and what they mean
//   entities.tsx           the things, each declared where it is drawn
//   timeline.ts            the timeline (beats, phases, inputs), the state
//                          machine, view(state, t, timeline), the stills
//   <Name>.tsx             the stage, the scene, the director (input, sound)
//   words.ts, styles.css   its words on screen, its overlays
//
// The Vite build, `pnpm dev` and `pnpm scene:verify` find it on their own.
// What it does not do (printed at the end): the lab page and the app.
// =============================================================================

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/.test(name) || name === "common") {
  console.error("usage: pnpm scene:new <name>   (lower-case, a-z 0-9 -; not \"common\")");
  process.exit(2);
}
const dir = join("experiences", name);
if (existsSync(dir)) {
  console.error(`${dir} already exists.`);
  process.exit(1);
}
const Name = name.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

const files = {
  "index.html": `<!doctype html>
<html lang="zh">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
    <meta name="theme-color" content="#05070d" />
    <meta name="robots" content="noindex" />
    <title>${Name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
`,

  "main.tsx": `import { createRoot } from "react-dom/client";
import { ${Name} } from "./${Name}";
import { LANG } from "./words";
import "./styles.css";

document.documentElement.lang = LANG;
createRoot(document.getElementById("root")!).render(<${Name} />);
`,

  "words.ts": `// The words on screen, in the page's language (?lang=zh|en).
export const LANG: "zh" | "en" = new URLSearchParams(location.search).get("lang") === "en" ? "en" : "zh";

const zh = { hint: "按住" };
const en: typeof zh = { hint: "Hold" };

export type Words = typeof zh;
export const WORDS: Words = LANG === "en" ? en : zh;
`,

  "styles.css": `html,
body,
#root {
  margin: 0;
  height: 100%;
  background: #05070d;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

/* The stage fills the page (its own inline style says relative). */
.stage {
  position: fixed !important;
  inset: 0;
}

.hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(14% + env(safe-area-inset-bottom));
  text-align: center;
  font: 15px/1.4 ui-serif, Georgia, "Songti SC", serif;
  color: rgba(210, 220, 245, 0.7);
  letter-spacing: 0.08em;
  pointer-events: none;
  transition: opacity 0.6s;
}
`,

  "semantics.ts": `import type { LanguageLayer } from "scene";

// What the scene came from, as it was said, and what each part was taken to
// mean. Every ref is a declared path (entities.tsx) or the timeline's
// (timeline.ts: beat.<name>, phase.<name>, input.<name>); the verifier checks.
export const LANGUAGE: LanguageLayer = {
  prompt: ["一个", ["房间", "room"], "，", ["一盏灯", "lamp"], "，", ["按住", "input.hold"], "它就", ["亮起来", "beat.glow"], "。"],
  concepts: [
    { words: { zh: "房间", en: "a room" }, kind: { zh: "场景", en: "setting" }, ref: "room" },
    { words: { zh: "一盏灯", en: "a lamp" }, kind: { zh: "实体", en: "entity" }, ref: "lamp" },
    { words: { zh: "亮起来", en: "lights up" }, kind: { zh: "状态变化 · 有时长", en: "change of state · takes time" }, ref: "beat.glow", lands: "lamp.light (state) over beat.glow" },
  ],
};
`,

  "entities.tsx": `// =============================================================================
// The things, each declared where it is drawn. Anything a person could name is
// a semantic() or a <Part>; what is not a thing is <Atmosphere>. Numbers that
// shape a thing are params (an edit); numbers the scene drives are state (an
// override pins them). Read both from props.
// =============================================================================

import { Atmosphere, Part, num, semantic } from "scene";

export const Room = semantic(
  { id: "room", kind: "setting", aka: ["房间", "the room"], parts: ["wall", "floor"] },
  () => (
    <>
      <Part name="wall"><rect x="-200" y="-200" width="790" height="840" fill="#0b0f1d" /></Part>
      <Part name="floor"><rect x="-200" y="640" width="790" height="400" fill="#070a13" /></Part>
    </>
  ),
);

export const Lamp = semantic(
  {
    id: "lamp",
    kind: "prop",
    aka: ["灯", "台灯", "the lamp"],
    depicts: "一盏落地灯，细杆，圆灯罩。A floor lamp: a thin pole, a round shade.",
    parts: ["shade", "pole"],
    params: { shadeSize: num(1, { min: 0.5, max: 2, step: 0.05, aka: ["灯罩大小"], affects: ["shade"] }) },
    state: { light: num(0, { min: 0, max: 1, step: 0.01, aka: ["亮", "light"], effect: "appearance" }) },
  },
  ({ shadeSize, light }) => (
    <>
      <Atmosphere name="glow" opacity={light}>
        <circle cx="0" cy="-300" r="70" fill="#f2d79a" opacity="0.18" />
      </Atmosphere>
      <Part name="pole"><rect x="-2" y="-280" width="4" height="280" fill="#1c2440" /></Part>
      <Part name="shade" transform={\`translate(0 -300) scale(\${shadeSize}) translate(0 300)\`}>
        <path d="M -34 -280 L 34 -280 L 22 -330 L -22 -330 Z" fill={\`rgb(\${28 + 200 * light}, \${36 + 170 * light}, \${64 + 80 * light})\`} />
      </Part>
    </>
  ),
);
`,

  "timeline.ts": `// =============================================================================
// ${Name} as a function of (state, t, timeline).
//
// The timeline is declared: beats (when, and for how long), phases (the
// states of the machine, named), inputs (what a person does). Everything that
// moves is computed in view() from the state, the clock and the timeline's
// values (overrides included), never frame by frame, never from the wall
// clock: any moment can be held, and draws the same every time.
// =============================================================================

import { beat, num, timeline, type TimelineValues } from "scene";

export const PHASES = ["dark", "lit"] as const;
export type Phase = (typeof PHASES)[number];

export const TIMELINE = timeline({
  beats: {
    glow: beat(0, { over: 1.6, aka: ["亮起来", "lights up"], note: "灯慢慢亮起 · the lamp comes up" }),
  },
  phases: {
    dark: { label: "暗 · dark", aka: ["暗"] },
    lit: { label: "亮 · lit", aka: ["亮了"] },
  },
  inputs: {
    hold: {
      aka: ["按住", "hold"],
      does: "按住，灯亮 · hold, and the lamp lights",
      params: { minHold: num(0.2, { min: 0, max: 2, step: 0.05, unit: "s", aka: ["按多久"] }) },
    },
  },
});

export type Timeline = TimelineValues<typeof TIMELINE>;
export type Beats = Timeline["beat"];

export interface State {
  phase: Phase;
  /** When this phase began, on the scene's clock. */
  at: number;
  /** Pressed, and since when. */
  down: number | null;
}

export const initial: State = { phase: "dark", at: 0, down: null };

export const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

export interface View {
  light: number;
  hint: boolean;
}

export function view(s: State, t: number, { beat: b }: Timeline): View {
  const u = Math.max(0, t - s.at);
  return {
    light: s.phase === "lit" ? ease((u - b.glow.at) / b.glow.over) : 0,
    hint: s.phase === "dark" && s.down === null,
  };
}

// Each still is a phase and a time in it, set against the beats.
export const STILLS = [
  { name: "dark", label: "暗 · dark", phase: "dark", u: () => 1, expect: ["lamp.shade", "room.wall"] },
  { name: "lit", label: "亮 · lit", phase: "lit", u: (b: Beats) => b.glow.end + 0.5, expect: ["lamp.shade"] },
] as const;

export type Action =
  | { type: "down"; t: number }
  | { type: "up"; t: number; minHold: number }
  | { type: "still"; name: string | null; t: number; u: number };

export function reduce(s: State, a: Action): State {
  switch (a.type) {
    case "down":
      return s.down === null ? { ...s, down: a.t } : s;
    case "up":
      if (s.down === null) return s;
      if (s.phase === "dark" && a.t - s.down >= a.minHold) return { phase: "lit", at: a.t, down: null };
      return { ...s, down: null };
    case "still": {
      const still = STILLS.find((x) => x.name === a.name);
      return still ? { phase: still.phase, at: a.t - a.u, down: null } : s;
    }
  }
}
`,

  [`${Name}.tsx`]: `// =============================================================================
// ${Name}.
//
//   timeline.ts   the timeline, the state machine, view(state, t, timeline)
//   entities.tsx  the things, each declared where it is drawn
//   semantics.ts  the words it came from
//   ${Name}.tsx${" ".repeat(Math.max(1, 12 - Name.length))}the stage, the scene, the overlays, the director
//
// After any change: pnpm scene:verify ${name}
// =============================================================================

import { useEffect, useReducer, useRef, type Dispatch } from "react";
import { Stage, useNow, useTime, useTimeline, type Still } from "scene";
import { Lamp, Room } from "./entities";
import { LANGUAGE } from "./semantics";
import { STILLS, TIMELINE, initial, reduce, view, type Action, type State } from "./timeline";
import { WORDS } from "./words";

const QUIET = new URLSearchParams(location.search).has("quiet");
const STAGE_STILLS: Still[] = STILLS.map((s) => ({ name: s.name, label: s.label, phase: s.phase, expect: s.expect }));

export function ${Name}() {
  const [state, dispatch] = useReducer(reduce, initial);
  return (
    <Stage
      width={390}
      height={844}
      timeline={TIMELINE}
      phase={state.phase}
      language={LANGUAGE}
      stills={STAGE_STILLS}
      onStill={(name, t, tl) => {
        const still = STILLS.find((s) => s.name === name);
        if (still) dispatch({ type: "still", name, t, u: still.u(tl.beat) });
      }}
      svg={{ style: { background: "#05070d" } }}
      html={<Overlays state={state} />}
      className="stage"
    >
      <Scene state={state} />
      <Director state={state} dispatch={dispatch} />
    </Stage>
  );
}

function Scene({ state }: { state: State }) {
  const t = useTime();
  const v = view(state, t, useTimeline(TIMELINE));
  return (
    <>
      <Room />
      <Lamp light={v.light} transform="translate(195 640)" />
    </>
  );
}

function Overlays({ state }: { state: State }) {
  const t = useTime();
  const v = view(state, t, useTimeline(TIMELINE));
  if (QUIET) return null;
  return <div className="hint" style={{ opacity: v.hint ? 1 : 0 }}>{WORDS.hint}</div>;
}

/** Input in, state on (and sound out, in useFrame). Draws nothing. */
function Director({ state, dispatch }: { state: State; dispatch: Dispatch<Action> }) {
  const now = useNow();
  const tl = useTimeline(TIMELINE);
  const live = useRef({ state, tl });
  useEffect(() => {
    live.current = { state, tl };
  });
  useEffect(() => {
    if (QUIET) return;
    const down = () => dispatch({ type: "down", t: now() });
    const up = () => dispatch({ type: "up", t: now(), minHold: live.current.tl.input.hold.minHold });
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    return () => {
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
    };
  }, [dispatch, now]);
  return null;
}
`,
};

mkdirSync(dir, { recursive: true });
for (const [file, body] of Object.entries(files)) writeFileSync(join(dir, file), body);

console.log(`Made ${dir}/: ${Object.keys(files).join(", ")}

It builds and verifies as it is:
  pnpm experiences            live, with hot reload: http://localhost:5173/scenes/${name}/
  pnpm scene:verify ${name}

Write the scene in this order (docs/system-scene.md):
  1. semantics.ts   the words, and what each names
  2. entities.tsx   a declaration for each thing they name; then its drawing
  3. timeline.ts    beats, phases, inputs; the state machine; view(); a still per phase
  4. ${Name}.tsx${" ".repeat(Math.max(1, 12 - Name.length))}the scene from view(); the director (input, sound)
  5. pnpm scene:verify ${name}, until it passes

To put it in the lab and on the home screen:
  systems/lab/catalog.ts       an entry: kind "experience", experience { src: "/scenes/${name}/index.html", app: "${name}" }
  app/lab/${name}/              page.tsx, strings.ts, view.tsx (<ExperienceShell lab="${name}" inspect>), as app/lab/wardrobe
  content/apps.json            an app: url "/scenes/${name}/index.html", size "portrait"
  content/app-icons.json, public/app-icons/   its icon; then pnpm apps:check`);
