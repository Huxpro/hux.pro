// =============================================================================
// The Wardrobe, on Reintent core.
//
// The same experience as experiences/wardrobe (its stage, its timeline, its
// sound), with its intents held by Reintent core instead of packages/intents:
//
//   kinds.ts           the intent types (.ts): kinds, words, what each means
//   wardrobe.tsx       the program (TSX) as the model wrote it
//   wardrobe.v2.tsx    the program as the model rewrote it
//   model.ts           a stand-in model, in rules
//   main.tsx           the root, the picture reading it, and the devtools
//                      the Lab's /lab/reintent drives it through
// =============================================================================

import { createRoot as createReactRoot } from "react-dom/client";
import { createRoot, type Root } from "reintent-core";
import { useIntent } from "reintent-core/react";
import { readingAction, recognize } from "reintent-core/words";
import { observe } from "reintent-core/observe";
import { expose, type ProgramVersion, type Said } from "reintent-core/devtools";
import { WardrobeStage, type Read } from "../wardrobe/Wardrobe";
import { SHAPE } from "../wardrobe/timeline";
import { LANG } from "../common/words";
import { Gaze, Open, Pace, Place, Size } from "./kinds";
import { extend, rebelieve, STAND_IN } from "./model";
import V1 from "./wardrobe";
import V2 from "./wardrobe.v2";
import V1_SOURCE from "./wardrobe.tsx?raw";
import V2_SOURCE from "./wardrobe.v2.tsx?raw";
import "../common/styles.css";

const VERSIONS: ProgramVersion[] = [
  { id: "v1", note: "as the model first wrote it", program: V1, source: V1_SOURCE },
  { id: "v2", note: "as the model rewrote it: a towering hat, a gaze it is unsure of, a pace that follows the door", program: V2, source: V2_SOURCE },
];

const root = createRoot(V1);
let current = "v1";

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
    const v = VERSIONS.find((x) => x.id === id);
    if (!v || id === current) return;
    current = id;
    root.dispatch({ type: "program", program: v.program }, `program → ${id} (${v.note})`);
  },
  say,
  answer: (reading) => root.dispatch({ ...readingAction(reading, "answered") }, `answered: ${reading.key} = ${reading.kind}`),
  observe: () => observe(root.get()),
});

/** What the picture reads, cell by cell, each typed by its intent. */
function useRead(r: Root): Read {
  const stand = useIntent(r, "man.stand", Place)?.data;
  return {
    shape: {
      stand: stand ? { at: stand.at as [number, number], scale: stand.scale, lean: stand.lean } : SHAPE.stand,
      doorEnd: useIntent(r, "wardrobe.door", Open)?.data.open ?? SHAPE.doorEnd,
    },
    hatScale: useIntent(r, "man.hat", Size)?.data.hatScale ?? 1,
    gaze: useIntent(r, "man.gaze", Gaze)?.data.eyes ?? 1,
    over: useIntent(r, "wardrobe.pace", Pace)?.data.over,
  };
}

function App() {
  return <WardrobeStage rd={useRead(root)} />;
}

document.documentElement.lang = LANG;
createReactRoot(document.getElementById("root")!).render(<App />);
