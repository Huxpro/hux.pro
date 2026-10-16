// =============================================================================
// A Dream, Told: a player for dreams written as intent trees.
//
// The Wardrobe is one dream with its own code for time. This is the other
// way round: no dream of its own, only a player. A dream is a tree (the cast,
// a node per beat, each beat's intents: where he is, the door, his gaze, how
// long), written by the strong model from the words someone tells it; the
// player plays its beats over the shared bedroom and him, a blink between
// each, and wakes. Tell it another dream (Inspect, "Tell a dream") and it
// plays that: a new tree, the same code.
//
//   intents.ts   the first dream's tree, the beat grammar, the stand-in that
//                composes a tree from words when no model is reachable
//   play.ts      the timeline, the state, view(state, t, timeline, tree)
//   Dream.tsx    the stage, the scene, the overlays, the director
// =============================================================================

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from "react";
import { useIntents } from "intents";
import { Stage, useFrame, useNow, useTime, useTimeline } from "scene";
import { Bed, BedroomDefs, Man, Room, Viewer, Wardrobe as WardrobeBox, Window } from "../common/bedroom";
import { Learned } from "../common/learned";
import { DreamAir, Epilogue, Hint, Lids, SoundButton } from "../common/overlays";
import { Sound } from "../common/sound";
import { HOST, TREE } from "./intents";
import { TIMELINE, initial, languageOf, read, reduce, stillsOf, view, type Action, type Read, type State } from "./play";
import { WORDS } from "./words";

const QUIET = new URLSearchParams(location.search).has("quiet");

const ReadContext = createContext<Read | null>(null);
const useRead = () => useContext(ReadContext)!;

export function Dream() {
  const [state, dispatch] = useReducer(reduce, initial);
  const [sound] = useState(() => new Sound());
  // The beat on screen is the loop's focus: a drag on him, or "门开大一点" said of nothing, is about it.
  const intents = useIntents(TREE, HOST, (tree) => tree.phases?.[state.i]?.node ?? null);
  const rd = useMemo(() => read(intents.state.tree, intents.values, intents.preview, intents.focus), [intents.state.tree, intents.values, intents.preview, intents.focus]);
  const stills = useMemo(() => stillsOf(rd), [rd]);
  const language = useMemo(() => languageOf(rd), [rd]);

  return (
    <Stage
      width={390}
      height={844}
      fit="slice"
      timeline={TIMELINE}
      phase={state.i < rd.beats.length ? "dream" : "awake"}
      language={language}
      stills={stills.map(({ name, label, phase, expect }) => ({ name, label, phase, expect }))}
      onStill={(name, t) => {
        if (name === null) return dispatch({ type: "play" });
        const still = stills.find((s) => s.name === name);
        if (still) dispatch({ type: "still", i: still.i, t, u: still.phase === "awake" ? 4 : 1.5 });
      }}
      svg={() => ({ style: { background: "#05070d" } })}
      html={
        <ReadContext.Provider value={rd}>
          <Overlays state={state} sound={sound} />
        </ReadContext.Provider>
      }
      className="stage"
    >
      <ReadContext.Provider value={rd}>
        <Scene state={state} />
        <Director state={state} dispatch={dispatch} sound={sound} />
      </ReadContext.Provider>
    </Stage>
  );
}

// -----------------------------------------------------------------------------
// The scene: the bedroom, him where the beat says, anything the tree learned.
// -----------------------------------------------------------------------------

function Scene({ state }: { state: State }) {
  const t = useTime();
  const rd = useRead();
  const v = view(state, t, useTimeline(TIMELINE), rd);
  const m = v.man;
  const him = m && (
    <Man
      instance={m.instance}
      hatScale={rd.hatScale}
      eyes={m.eyes}
      transform={`translate(${m.at[0].toFixed(1)} ${m.at[1].toFixed(1)}) rotate(${m.lean.toFixed(2)}) scale(${m.scale.toFixed(4)})`}
    />
  );
  return (
    <>
      <BedroomDefs />
      <g id="scene">
        <Room />
        <Window />
        <WardrobeBox openLeft={v.doors.left} openRight={v.doors.right}>
          {m?.inside && him}
        </WardrobeBox>
        {m && !m.inside && him}
        <Bed />
        <Learned tree={rd.tree} values={rd.values} drawingLabel={WORDS.drawing} />
        <Viewer world={v.dream ? "dream" : "awake"} eyes={v.lids.closed ? "closed" : "open"} />
      </g>
    </>
  );
}

// -----------------------------------------------------------------------------
// Over the scene: the haze, the beat's own words, the lids, the ending.
// -----------------------------------------------------------------------------

function Overlays({ state, sound }: { state: State; sound: Sound }) {
  const t = useTime();
  const v = view(state, t, useTimeline(TIMELINE), useRead());
  return (
    <>
      <DreamAir dream={v.dream} />
      {!QUIET && <div className={`line caption${v.caption ? " show" : ""}`}>{v.caption ?? ""}</div>}
      {!QUIET && <Hint text={WORDS.hint} show={v.hint} />}
      {!QUIET && <Epilogue show={v.line} text={WORDS.epilogue} replay={WORDS.replay} />}
      <Lids {...v.lids} />
      {!QUIET && <SoundButton sound={sound} label={WORDS.sound} />}
    </>
  );
}

// -----------------------------------------------------------------------------
// The director: the beats move on by themselves (or at a tap); a new dream
// starts over; the sound follows. Draws nothing.
// -----------------------------------------------------------------------------

function Director({ state, dispatch, sound }: { state: State; dispatch: Dispatch<Action>; sound: Sound }) {
  const now = useNow();
  const tl = useTimeline(TIMELINE);
  const rd = useRead();
  const live = useRef({ state, tl, rd });
  useEffect(() => {
    live.current = { state, tl, rd };
  });

  // A new dream (another tree's beats): from the top.
  const dreamKey = `${rd.tree.prompt}|${rd.beats.map((b) => b.id).join(",")}`;
  const lastKey = useRef(dreamKey);
  useEffect(() => {
    if (lastKey.current === dreamKey) return;
    lastKey.current = dreamKey;
    dispatch({ type: "replay", t: now() });
  }, [dreamKey, dispatch, now]);

  // A tap: the next beat; awake, once the words are up, the dream again.
  useEffect(() => {
    if (QUIET) return;
    const down = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof PointerEvent && e.button > 0) return;
      if (e instanceof KeyboardEvent && (e.repeat || (e.key !== " " && e.key !== "Enter"))) return;
      const { state: s, tl, rd } = live.current;
      sound.ensure(s.i < rd.beats.length);
      if (s.i < rd.beats.length) dispatch({ type: "next", t: now(), n: rd.beats.length, via: "tap" });
      else if (view(s, now(), tl, rd).line) dispatch({ type: "replay", t: now() });
    };
    addEventListener("pointerdown", down);
    addEventListener("keydown", down);
    return () => {
      removeEventListener("pointerdown", down);
      removeEventListener("keydown", down);
    };
  }, [dispatch, now, sound]);

  // Every frame: a beat that has run its length gives way to the next.
  const prev = useRef(state);
  useFrame((t) => {
    const { state: s, rd } = live.current;
    const cur = rd.beats[s.i];
    if (cur && s.via !== "still" && t - s.at >= cur.hold) dispatch({ type: "next", t, n: rd.beats.length, via: "auto" });
    if (s !== prev.current && s.via !== "still") {
      if (s.i >= rd.beats.length) sound.hush();
      else sound.dread(Math.min(2, s.i));
    }
    prev.current = s;
  });

  return null;
}
