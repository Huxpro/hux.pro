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
//   entities.tsx  the things, each declared where it is drawn
//   Wardrobe.tsx  the scene, the overlays, and the director (sound, input)
//   sound.ts      the sound, made in the page
// =============================================================================

import { useEffect, useReducer, useRef, useState, type Dispatch } from "react";
import { Atmosphere, Stage, useFlag, useFrame, useNow, useTime, useTimeline, type Still } from "scene";
import { Bed, Man, Room, Viewer, Wardrobe as WardrobeBox, Window } from "./entities";
import { LANGUAGE } from "./semantics";
import { Sound } from "./sound";
import { PHASES, STILLS, TIMELINE, breathAmp, breathPhase, initial, reduce, view, type Action, type State } from "./timeline";
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

export function Wardrobe() {
  const [state, dispatch] = useReducer(reduce, initial);
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
        const v = view(state, t, tl);
        return { style: { filter: v.filter, transform: v.jolt, background: "#05070d" } };
      }}
      html={<Overlays state={state} sound={sound} words={WORDS} />}
      className="stage"
    >
      <Scene state={state} />
      <Director state={state} dispatch={dispatch} sound={sound} />
    </Stage>
  );
}

// -----------------------------------------------------------------------------
// The scene: what is drawn, for this state at this moment.
// -----------------------------------------------------------------------------

function Scene({ state }: { state: State }) {
  const t = useTime();
  const v = view(state, t, useTimeline(TIMELINE));
  // The inspector's demonstration: something drawn outside every declaration.
  const undeclared = useFlag("undeclared");
  return (
    <>
      <Defs />
      <g transform={v.room}>
        <g id="scene">
          <Room />
          <Window />
          <WardrobeBox openLeft={v.doors.left} openRight={v.doors.right}>
            {v.manInWardrobe && (
              <Man instance="wardrobe" eyes={v.manInWardrobe.eyes} transform={`translate(285.5 640) rotate(${v.manInWardrobe.tilt.toFixed(2)})`} />
            )}
          </WardrobeBox>
          {v.manAtBed && (
            <Man instance="bedside" eyes={v.manAtBed.eyes} transform={`translate(236 872) rotate(${v.manAtBed.lean.toFixed(3)}) scale(${v.manAtBed.scale.toFixed(4)})`} />
          )}
          <Bed />
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

function Defs() {
  return (
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0a0e1b" />
        <stop offset="0.75" stopColor="#0e1426" />
        <stop offset="1" stopColor="#0a0e1b" />
      </linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#080b15" />
        <stop offset="1" stopColor="#04060c" />
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3c4e78" />
        <stop offset="1" stopColor="#1b2642" />
      </linearGradient>
      <radialGradient id="moonGlow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#5a6d9c" stopOpacity="0.32" />
        <stop offset="1" stopColor="#5a6d9c" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="beam" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#8ea2d6" stopOpacity="0.12" />
        <stop offset="1" stopColor="#8ea2d6" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1a2440" />
        <stop offset="1" stopColor="#101729" />
      </linearGradient>
      <linearGradient id="doorFace" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#18213a" />
        <stop offset="1" stopColor="#0d1322" />
      </linearGradient>
      <linearGradient id="inside" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0a1020" />
        <stop offset="0.6" stopColor="#101830" />
        <stop offset="1" stopColor="#0b1122" />
      </linearGradient>
      <linearGradient id="blanket" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1b2440" />
        <stop offset="0.35" stopColor="#111829" />
        <stop offset="1" stopColor="#070a12" />
      </linearGradient>
      <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" />
      </filter>
      <clipPath id="wardrobeInside">
        <rect x="213" y="222" width="145" height="418" />
      </clipPath>
    </defs>
  );
}

// -----------------------------------------------------------------------------
// Over the scene: the haze of the dream, grain, the lids, the words. Not
// things; not measured.
// -----------------------------------------------------------------------------

function Overlays({ state, sound, words }: { state: State; sound: Sound; words: Words }) {
  const t = useTime();
  const v = view(state, t, useTimeline(TIMELINE));
  const [muted, setMuted] = useState(sound.muted);
  const lid = { transitionDuration: `${v.lids.speed}s` };
  return (
    <>
      <div className="haze" style={{ opacity: v.dream ? 1 : 0 }} />
      <div className="grain" style={{ opacity: v.dream ? 0.1 : 0.06 }} />
      <div className="vignette" />
      <div className={`fade${v.line ? " show" : ""}`} />
      {!QUIET && (
        <>
          <div className={`line hint${v.hint ? " show" : ""}`}>{v.hint ? words[v.hint] : words.hint}</div>
          <div className={`line epilogue${v.line ? " show" : ""}`}>
            {words.epilogue}
            <small>{words.replay}</small>
          </div>
        </>
      )}
      <div className={`lid top${v.lids.closed ? " closed" : ""}`} style={lid} />
      <div className={`lid bottom${v.lids.closed ? " closed" : ""}`} style={lid} />
      {!QUIET && (
        <button
          type="button"
          className="sound"
          aria-label={words.sound}
          aria-pressed={!muted}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            sound.setMuted(!muted);
            setMuted(!muted);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
          </svg>
        </button>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// The director: input in, state on, sound out. Draws nothing.
// -----------------------------------------------------------------------------

function Director({ state, dispatch, sound }: { state: State; dispatch: Dispatch<Action>; sound: Sound }) {
  const now = useNow();
  const tl = useTimeline(TIMELINE);
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
    const b = tl.beat;
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

    if (s.stage === 3 && s.via !== "still" && p.state.stage === 3 && s.at === p.state.at) {
      const crossed = (beat: number) => p.u < beat && u >= beat;
      if (crossed(b.snap.at)) {
        sound.gasp();
        sound.roomTo(0.1, 0.8);
        if (navigator.vibrate) navigator.vibrate(60);
      }
      // The breath, until it catches.
      const d = u - b.snap.at;
      if (d > 0 && u < b.door.at) {
        const before = breathPhase(p.u - b.snap.at);
        const after = breathPhase(d);
        if (Math.floor(after) > Math.floor(before)) sound.breathe(true, breathAmp(d));
        if (before % 1 < 0.42 && after % 1 >= 0.42 && Math.floor(before) === Math.floor(after)) sound.breathe(false, breathAmp(d));
      }
      // The heart: loud at first, gone by the time the clock is heard; back when the door moves.
      const since = u - b.door.at - 1;
      const beatEvery = d < 4 ? 0.48 + 0.4 * (d / 4) : u > b.door.at ? 1 - 0.42 * Math.min(1, since / 6) : 0;
      if (beatEvery && d > 0 && Math.floor(u / beatEvery) > Math.floor(p.u / beatEvery)) {
        sound.thump(d < 4 ? 0.6 * (1 - d / 4) + 0.05 : 0.12 + 0.5 * Math.min(1, since / 6));
      }
      if (u > b.clock.at && Math.floor(u - b.clock.at) > Math.floor(p.u - b.clock.at)) sound.tick(Math.min(1, (u - b.clock.at) / 2.5));
      if (crossed(b.door.at)) sound.creak(b.door.over, 0.6);
    }
    prev.current = { state: s, u };
  });

  return null;
}
