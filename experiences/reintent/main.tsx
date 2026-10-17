// =============================================================================
// The Wardrobe, on Reintent core.
//
// The same experience as experiences/wardrobe (its stage, its timeline, its
// sound), with its things drawn by parts on Reintent core:
//
//   kinds.ts         the intent types: kinds, words, what each means
//   parts.tsx        him and the wardrobe as the model wrote them: intents in, drawing out
//   parts.v2.tsx     the same, as the model rewrote them
//   model.ts         a stand-in model, in rules
//   main.tsx         the root, the director's sideways read (the pace), and the devtools
//                    the Lab's /lab/reintent drives it through
// =============================================================================

import { useMemo, useSyncExternalStore } from "react";
import { createRoot as createReactRoot } from "react-dom/client";
import { createRoot } from "reintent-core";
import { ReintentRoot, reactPart, useCell } from "reintent-core/react";
import { readingAction, recognize } from "reintent-core/words";
import { observe } from "reintent-core/observe";
import { expose, type ProgramVersion, type Said } from "reintent-core/devtools";
import { WardrobeStage, type Read, type Things } from "../wardrobe/Wardrobe";
import { SHAPE } from "../wardrobe/timeline";
import { LANG } from "../common/words";
import { Pace } from "./kinds";
import { extend, rebelieve, STAND_IN } from "./model";
import * as V1 from "./parts";
import * as V2 from "./parts.v2";
import V1_SOURCE from "./parts.tsx?raw";
import V2_SOURCE from "./parts.v2.tsx?raw";
import "../common/styles.css";

const VERSIONS: ProgramVersion[] = [
  { id: "v1", note: "as the model first wrote it", file: "experiences/reintent/parts.tsx", source: V1_SOURCE },
  {
    id: "v2",
    note: "as the model rewrote it: a towering hat, a gaze asked only away from the window, a pace that follows the door",
    file: "experiences/reintent/parts.v2.tsx",
    source: V2_SOURCE,
  },
];

/** Each version's parts, as the stage's things. */
const THINGS: Record<string, Things> = {
  v1: { Man: reactPart(V1.Man), Wardrobe: reactPart(V1.Wardrobe) },
  v2: { Man: reactPart(V2.Man), Wardrobe: reactPart(V2.Wardrobe) },
};

const root = createRoot({ id: "wardrobe" });

// Which version runs: a small store the frame and the devtools share.
let current = "v1";
const versionSubs = new Set<() => void>();
const onVersion = (fn: () => void) => {
  versionSubs.add(fn);
  return () => versionSubs.delete(fn);
};

function say(text: string): Said {
  const s = root.get();
  const r = recognize(text, s);
  switch (r.outcome) {
    case "resolve":
      root.dispatch(r.action, `“${text}” → ${r.reading.key} ${r.reading.not ? "≠" : "="} ${r.reading.kind}`);
      return { ...r, done: "resolved: a person's decision, no model" };
    case "ask":
      return { ...r, done: "more than one reading: asking" };
    case "context": {
      root.dispatch(r.action, `“${text}”, said of the whole`);
      const believed = rebelieve(root.get());
      if (believed.length) root.dispatch({ type: "batch", actions: believed }, `${STAND_IN}: ${believed.length} beliefs again, under the new context`);
      return { ...r, done: `context: ${believed.length} stale beliefs inferred again` };
    }
    case "infer": {
      if (r.need.kind === "extend") {
        const actions = extend(s, r.need);
        if (actions) {
          root.dispatch({ type: "batch", actions }, `“${text}” → ${STAND_IN} learned a kind past the end of ${r.need.key}`);
          return { ...r, done: "past the end: a model learned a kind more, and it is yours" };
        }
      }
      return { ...r, done: "nothing in the program can say this: it would go to a strong model (none here)" };
    }
  }
}

expose({
  root,
  versions: VERSIONS,
  current: () => current,
  use(id) {
    if (id === current || !THINGS[id]) return;
    current = id;
    versionSubs.forEach((fn) => fn());
  },
  say,
  answer: (reading) => root.dispatch({ ...readingAction(reading, "answered") }, `answered: ${reading.key} = ${reading.kind}`),
  observe: () => observe(root.get()),
});

/** The director's share of the intents: the pace is time, read sideways from the wardrobe. */
function Stage({ things }: { things: Things }) {
  const over = useCell("wardrobe.pace", Pace)?.data.over;
  const rd = useMemo<Read>(() => ({ shape: SHAPE, hatScale: 1, gaze: 1, over }), [over]);
  return <WardrobeStage rd={rd} things={things} />;
}

function App() {
  const version = useSyncExternalStore(onVersion, () => current);
  return (
    <ReintentRoot root={root}>
      <Stage things={THINGS[version]} />
    </ReintentRoot>
  );
}

document.documentElement.lang = LANG;
createReactRoot(document.getElementById("root")!).render(<App />);
