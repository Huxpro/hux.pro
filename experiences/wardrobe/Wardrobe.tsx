// =============================================================================
// The Wardrobe: a dream, in three blinks.
//
// A tall thin man in black, under a round hat far too big for him, stood in
// my wardrobe. Then he opened its door and stood at my bed, looking at me. I
// woke, and the wardrobe door really was opening. As a child I saw him every
// few nights.
//
// Hold to close your eyes. Every time you open them, he is closer. The third
// time, you wake: a beat of black, the eyes snap open, you gasp and pant, and
// the room is only the room, at night, with a clock in it. You calm down.
// Then the wardrobe door opens.
//
//   timeline.ts   the beats, phases and inputs (declared), and everything that
//                 moves, as a function of (state, t, timeline)
//   semantics.ts  the dream as it was told, and what it meant
//   Wardrobe.tsx  the scene, the overlays, and the director (sound, input)
//
// Shared with the other dreams (experiences/common): the bedroom and him
// (bedroom.tsx), the waking (waking.ts), the sound, the overlays.
// =============================================================================

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch } from "react";
import { dragValue, realized, useIntents, type DragPreview, type Tree, type Value } from "intents";
import { Atmosphere, Stage, useFlag, useFrame, useNow, useTime, useTimeline, type Still } from "scene";
import { Bed, BedroomDefs, Man, Room, Viewer, Wardrobe as WardrobeBox, Window } from "../common/bedroom";
import { DreamAir, Epilogue, Hint, Lids, SoundButton } from "../common/overlays";
import { Sound } from "../common/sound";
import { Learned } from "../common/learned";
import { wakingSound } from "../common/waking";
import { HOST, TREE } from "./intents";
import { LANGUAGE } from "./semantics";
import { PHASES, SHAPE, STILLS, TIMELINE, initial, paced, reduce, view, type Action, type Shape, type State, type Timeline } from "./timeline";
import { WORDS, type Words } from "./words";

const params = new URLSearchParams(location.search);
const QUIET = params.has("quiet");

/** ?stage=0..3 (&t=) from the hand-written page: a still, or (quiet) a live start. */
function stillFromUrl(): { name: string; u?: number } | null {
  const stage = params.get("stage");
  if (stage === null || QUIET) return null;
  const name = ["gap", "inside", "bedside", "door"][Number(stage)];
  const t = params.get("t");
  return name ? { name, u: t !== null ? Number(t) : params.has("epilogue") ? 20 : undefined } : null;
}

const STAGE_STILLS: Still[] = STILLS.map((s) => ({ name: s.name, label: s.label, phase: s.phase, expect: s.expect }));

// -----------------------------------------------------------------------------
// The intent tree, as the picture reads it (intents.ts, through reintent; the
// loop itself is packages/intents). A drag's in-between is the view's own:
// the dragged thing follows the pointer until the drag is an event.
// -----------------------------------------------------------------------------

interface Read {
  shape: Shape;
  hatScale: number;
  gaze: number;
  /** The door's pace (beat.door.over), when the tree says. */
  over: number | undefined;
  tree: Tree;
  values: Record<string, Value>;
}

function read(tree: Tree, values: Record<string, Value>, preview: DragPreview | null): Read {
  const r = (n: string, i: string) => realized(tree, values, n, i);
  const stand = r("man", "stand");
  const shape: Shape = {
    stand: {
      at: (stand.at as [number, number]) ?? SHAPE.stand.at,
      scale: (stand.scale as number) ?? SHAPE.stand.scale,
      lean: (stand.lean as number) ?? SHAPE.stand.lean,
    },
    doorEnd: (r("wardrobe", "door").open as number) ?? SHAPE.doorEnd,
  };
  if (preview) {
    const d = dragValue(tree, values, preview);
    if (d && "at" in d && d.at) {
      const [y0, s0, y1, s1] = d.gesture.depth ?? [0, shape.stand.scale, 1, shape.stand.scale];
      const scale = Math.max(0.6, Math.min(2.1, s0 + ((d.at[1] - y0) / (y1 - y0)) * (s1 - s0)));
      shape.stand = { at: d.at, scale, lean: 0 };
    } else if (d && "value" in d && d.value !== undefined) shape.doorEnd = d.value;
  }
  return {
    shape,
    hatScale: (r("man", "hat").hatScale as number) ?? 1,
    gaze: (r("man", "gaze").eyes as number) ?? 1,
    over: r("wardrobe", "pace").over as number | undefined,
    tree,
    values,
  };
}

const ReadContext = createContext<Read | null>(null);
const useRead = () => useContext(ReadContext)!;
/** view(), with the tree's say: the pace on the timeline, the shape on the picture. */
const viewOf = (state: State, t: number, tl: Timeline, rd: Read) => view(state, t, paced(tl, rd.over), rd.shape);

export function Wardrobe() {
  const [state, dispatch] = useReducer(reduce, initial);
  const intents = useIntents(TREE, HOST);
  const rd = useMemo(() => read(intents.state.tree, intents.values, intents.preview), [intents.state.tree, intents.values, intents.preview]);
  const [sound] = useState(() => new Sound());
  const [fit, setFit] = useState<"slice" | "meet">(() => (innerWidth / innerHeight > 0.62 ? "meet" : "slice"));
  useEffect(() => {
    const onResize = () => setFit(innerWidth / innerHeight > 0.62 ? "meet" : "slice");
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, []);

  return (
    <Stage
      width={390}
      height={844}
      fit={QUIET ? "slice" : fit}
      viewBox={QUIET ? "199 205 180 160" : undefined}
      timeline={TIMELINE}
      phase={PHASES[state.stage]}
      language={LANGUAGE}
      stills={STAGE_STILLS}
      onStill={(name, t, tl) => {
        const still = STILLS.find((s) => s.name === name);
        if (still) dispatch({ type: "still", name, t, u: still.u(tl.beat) });
      }}
      svg={(t, tl) => {
        const v = viewOf(state, t, tl, rd);
        return { style: { filter: v.filter, transform: v.jolt, background: "#05070d" } };
      }}
      html={
        <ReadContext.Provider value={rd}>
          <Overlays state={state} sound={sound} words={WORDS} />
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
// The scene: what is drawn, for this state at this moment.
// -----------------------------------------------------------------------------

function Scene({ state }: { state: State }) {
  const t = useTime();
  const rd = useRead();
  const v = viewOf(state, t, useTimeline(TIMELINE), rd);
  // The inspector's demonstration: something drawn outside every declaration.
  const undeclared = useFlag("undeclared");
  return (
    <>
      <BedroomDefs />
      <g transform={v.room}>
        <g id="scene">
          <Room />
          <Window />
          <WardrobeBox openLeft={v.doors.left} openRight={v.doors.right}>
            {v.manInWardrobe && (
              <Man instance="wardrobe" hatScale={rd.hatScale} eyes={v.manInWardrobe.eyes * rd.gaze} transform={`translate(285.5 640) rotate(${v.manInWardrobe.tilt.toFixed(2)})`} />
            )}
          </WardrobeBox>
          {v.manAtBed && (
            <Man
              instance="bedside"
              hatScale={rd.hatScale}
              eyes={v.manAtBed.eyes * rd.gaze}
              transform={`translate(${v.manAtBed.at[0].toFixed(1)} ${v.manAtBed.at[1].toFixed(1)}) rotate(${v.manAtBed.lean.toFixed(3)}) scale(${v.manAtBed.scale.toFixed(4)})`}
            />
          )}
          <Bed />
          <Learned tree={rd.tree} values={rd.values} drawingLabel={WORDS.drawing} />
          <Viewer world={v.dream ? "dream" : "awake"} eyes={v.lids.closed ? "closed" : "open"} />
          {undeclared && (
            <g fill="#c9d3ee" opacity="0.5">
              <ellipse cx="96" cy="560" rx="26" ry="34" />
              <path d="M 70 580 Q 96 520 122 580 L 128 660 L 64 660 Z" />
            </g>
          )}
        </g>
        {/* In the dream, a second room a few pixels off the first. */}
        {v.double && (
          <Atmosphere name="double" opacity="0.36" style={{ mixBlendMode: "screen" }}>
            <use href="#scene" transform={v.double} />
          </Atmosphere>
        )}
      </g>
    </>
  );
}

// -----------------------------------------------------------------------------
// Over the scene: the haze of the dream, grain, the lids, the words. Not
// things; not measured.
// -----------------------------------------------------------------------------

function Overlays({ state, sound, words }: { state: State; sound: Sound; words: Words }) {
  const t = useTime();
  const v = viewOf(state, t, useTimeline(TIMELINE), useRead());
  return (
    <>
      <DreamAir dream={v.dream} />
      {!QUIET && <Hint text={v.hint ? words[v.hint] : words.hint} show={!!v.hint} />}
      {!QUIET && <Epilogue show={v.line} text={words.epilogue} replay={words.replay} />}
      <Lids {...v.lids} />
      {!QUIET && <SoundButton sound={sound} label={words.sound} />}
    </>
  );
}

// -----------------------------------------------------------------------------
// The director: input in, state on, sound out. Draws nothing.
// -----------------------------------------------------------------------------

function Director({ state, dispatch, sound }: { state: State; dispatch: Dispatch<Action>; sound: Sound }) {
  const now = useNow();
  const tl = paced(useTimeline(TIMELINE), useRead().over);
  const live = useRef({ state, tl });
  useEffect(() => {
    live.current = { state, tl };
  });
  const prev = useRef<{ state: State; u: number }>({ state, u: 0 });
  const stillApplied = useRef(false);

  // A still asked for in the address.
  useEffect(() => {
    if (stillApplied.current) return;
    stillApplied.current = true;
    const still = stillFromUrl();
    if (still) {
      window.__scene?.goto(still.name);
      if (still.u !== undefined) dispatch({ type: "still", name: still.name, t: now(), u: still.u });
    }
  }, [dispatch, now]);

  // Input (TIMELINE.inputs): hold to close the eyes, let go to open them; after the words, tap to dream again.
  useEffect(() => {
    if (QUIET) return;
    const down = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof PointerEvent && e.button > 0) return;
      if (e instanceof KeyboardEvent && (e.repeat || (e.key !== " " && e.key !== "Enter"))) return;
      if (e instanceof KeyboardEvent) e.preventDefault();
      const { state: s, tl } = live.current;
      sound.ensure(s.stage < 3);
      if (s.stage === 3) {
        if (view(s, now(), tl).line) dispatch({ type: "replay", t: now() });
        return;
      }
      dispatch({ type: "close", t: now() });
    };
    const up = (e: PointerEvent | KeyboardEvent | FocusEvent) => {
      if (e instanceof KeyboardEvent && e.key !== " " && e.key !== "Enter") return;
      dispatch({ type: "release", t: now() });
    };
    const menu = (e: Event) => e.preventDefault();
    addEventListener("pointerdown", down);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
    addEventListener("blur", up);
    addEventListener("keydown", down);
    addEventListener("keyup", up);
    addEventListener("contextmenu", menu);
    return () => {
      removeEventListener("pointerdown", down);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      removeEventListener("blur", up);
      removeEventListener("keydown", down);
      removeEventListener("keyup", up);
      removeEventListener("contextmenu", menu);
    };
  }, [dispatch, now, sound]);

  // Every frame: let a held blink mature, and play what the moment implies.
  useFrame((t) => {
    const { state: s, tl } = live.current;
    if (s.pending) dispatch({ type: "tick", t, minBlink: tl.input.hold.minBlink });
    const p = prev.current;
    const u = Math.max(0, t - s.at);

    if (s !== p.state) {
      const was = p.state;
      if (s.via === "still") sound.heartbeat(false);
      else if (s.stage < 3 && s.closed && !was.closed) {
        // Eyes shut: the room goes, the heart comes up.
        sound.roomTo(0.08, 0.2);
        sound.heartbeat(true, [0.82, 0.64, 0.5][s.stage]);
      } else if (s.stage !== was.stage) {
        if (s.stage === 3) sound.hush();
        else if (s.via === "replay") {
          sound.padTo(0.16);
          sound.roomTo(0.22, 0.8);
        } else {
          sound.heartbeat(false);
          sound.roomTo(0.24, 0.4);
          sound.dread(s.stage);
        }
      }
    }

    if (s.stage === 3 && s.via !== "still" && p.state.stage === 3 && s.at === p.state.at) wakingSound(sound, p.u, u, tl.beat);
    prev.current = { state: s, u };
  });

  return null;
}
