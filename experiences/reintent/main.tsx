// =============================================================================
// The Wardrobe, on Reintent: three layers.
//
//   program/*.tsx    the intent tree a model writes: elements, literal props
//   intents/*.ts     the intent components: intents in (values), what was
//                    decided out (host nodes of kinds and paths). No view
//   main.tsx         the view: React, reading the render's host nodes and
//                    drawing them with the Wardrobe's own stage
//
// The session (reintent-core/lib/session) runs the loop: the source of what
// people and the model said, the render (a value, rendered again when what it
// read changes), undo, versions. React never subscribes to an intent: it reads
// the session's latest render, as it would any other value.
//
//   kinds.ts         the vocabularies: kinds, their words, what each means here
//   beliefs.ts       the model's beliefs, as it wrote each version
//   model.ts         a stand-in model, in rules
// =============================================================================

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type { HostNode } from "reintent-core";
import { createSession, type SessionSnapshot } from "reintent-core/lib/session";
import { meaning } from "reintent-core/lib/vocab";
import { WardrobeStage, transformOf, type ManPose, type Read, type Things, type WardrobePose } from "../wardrobe/Wardrobe";
import { Man as Figure, Wardrobe as Box } from "../common/bedroom";
import { SHAPE } from "../wardrobe/timeline";
import { LANG } from "../common/words";
import V1 from "./program/v1";
import V2 from "./program/v2";
import V1_PROGRAM from "./program/v1.tsx?raw";
import V2_PROGRAM from "./program/v2.tsx?raw";
import V1_INTENTS from "./intents/v1.ts?raw";
import V2_INTENTS from "./intents/v2.ts?raw";
import { V1 as B1, V2 as B2 } from "./beliefs";
import { standIn } from "./model";
import "../common/styles.css";

const session = createSession({
  versions: [
    {
      id: "v1",
      note: "as the model first wrote it",
      program: V1,
      beliefs: B1,
      files: [
        { file: "experiences/reintent/program/v1.tsx", source: V1_PROGRAM },
        { file: "experiences/reintent/intents/v1.ts", source: V1_INTENTS },
      ],
    },
    {
      id: "v2",
      note: "as the model rewrote it: a towering hat, a gaze read only away from the window, a pace whose default follows the door",
      program: V2,
      beliefs: B2,
      files: [
        { file: "experiences/reintent/program/v2.tsx", source: V2_PROGRAM },
        { file: "experiences/reintent/intents/v2.ts", source: V2_INTENTS },
      ],
    },
  ],
  model: standIn,
});
window.__reintent = session;

// -----------------------------------------------------------------------------
// What the render says, in the picture's terms.
// -----------------------------------------------------------------------------

interface Meaning {
  hatScale: number;
  /** How much his eyes catch the light: 0 when he does not look (or is not asked to, at the window). */
  eyes: number;
  stand: { at: readonly [number, number]; scale: number; lean: number };
  open: number;
  over: number | undefined;
}

type Ref = { kind: string; path: string } | null;

function meaningOf(s: SessionSnapshot): Meaning {
  const dream = s.result.tree as HostNode;
  const node = (kind: string) => (dream?.children as HostNode[] | undefined)?.find((n) => n.kind === kind)?.props ?? {};
  const man = node("man");
  const wardrobe = node("wardrobe");
  const of = <D,>(ref: Ref) => (ref ? meaning<D>(s.reads, ref) : undefined);
  const stand = of<Meaning["stand"]>(man.stand);
  return {
    hatScale: of<{ hatScale: number }>(man.hat)?.hatScale ?? 1,
    eyes: man.gaze === null ? 0 : (of<{ eyes: number }>(man.gaze)?.eyes ?? 1),
    stand: stand ? { at: stand.at, scale: stand.scale, lean: stand.lean } : SHAPE.stand,
    open: of<{ open: number }>(wardrobe.door)?.open ?? SHAPE.doorEnd,
    over: of<{ over: number }>(wardrobe.pace)?.over,
  };
}

const MeaningContext = createContext<Meaning>({ hatScale: 1, eyes: 1, stand: SHAPE.stand, open: SHAPE.doorEnd, over: undefined });

/** Him, as the timeline poses him and the render says he is: at the bed he stands where his intent says, the drift on top. */
function ManView({ instance, eyes, at, scale, lean, children }: ManPose & { children?: ReactNode }) {
  const m = useContext(MeaningContext);
  const pose =
    instance === "bedside"
      ? { at: m.stand.at, scale: m.stand.scale + scale - SHAPE.stand.scale, lean: m.stand.lean + lean - SHAPE.stand.lean }
      : { at, scale, lean };
  return (
    <Figure instance={instance} hatScale={m.hatScale} eyes={eyes * m.eyes} transform={transformOf(pose)}>
      {children}
    </Figure>
  );
}

/** The wardrobe: awake, its door opens as far as the render says (the timeline's opening, scaled to it). */
function WardrobeView({ openLeft, openRight, waking, children }: WardrobePose) {
  const m = useContext(MeaningContext);
  return (
    <Box openLeft={openLeft} openRight={waking ? (openRight / SHAPE.doorEnd) * m.open : openRight}>
      {children}
    </Box>
  );
}

const THINGS: Things = { Man: ManView, Wardrobe: WardrobeView };

function App() {
  const snap = useSyncExternalStore(session.subscribe, session.get);
  const m = useMemo(() => meaningOf(snap), [snap]);
  // The director's share: the door's pace is time, on the timeline.
  const rd = useMemo<Read>(() => ({ shape: SHAPE, hatScale: 1, gaze: 1, over: m.over }), [m.over]);
  return (
    <MeaningContext.Provider value={m}>
      <WardrobeStage rd={rd} things={THINGS} />
    </MeaningContext.Provider>
  );
}

document.documentElement.lang = LANG;
createRoot(document.getElementById("root")!).render(<App />);
