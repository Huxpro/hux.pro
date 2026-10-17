// =============================================================================
// Over the scene, in every dream: the dream's haze and grain, the eyelids,
// the hint, the closing words, the sound switch. Not things; not measured
// (the stage's html layer). Styles in common/styles.css.
// =============================================================================

import { useState } from "react";
import type { Sound } from "./sound";

/** The dream's air: haze at the edges of sight (only in the dream), grain, a vignette. */
export function DreamAir({ dream }: { dream: boolean }) {
  return (
    <>
      <div className="haze" style={{ opacity: dream ? 1 : 0 }} />
      <div className="grain" style={{ opacity: dream ? 0.1 : 0.06 }} />
      <div className="vignette" />
    </>
  );
}

/** The eyelids; their speed is the timeline's (a dream blink, a snap, an ordinary blink). */
export function Lids({ closed, speed }: { closed: boolean; speed: number }) {
  const style = { transitionDuration: `${speed}s` };
  return (
    <>
      <div className={`lid top${closed ? " closed" : ""}`} style={style} />
      <div className={`lid bottom${closed ? " closed" : ""}`} style={style} />
    </>
  );
}

export function Hint({ text, show }: { text: string; show: boolean }) {
  return <div className={`line hint${show ? " show" : ""}`}>{text}</div>;
}

/** The room dims and the words come: the end of every dream. */
export function Epilogue({ show, text, replay }: { show: boolean; text: string; replay: string }) {
  return (
    <>
      <div className={`fade${show ? " show" : ""}`} />
      <div className={`line epilogue${show ? " show" : ""}`}>
        {text}
        <small>{replay}</small>
      </div>
    </>
  );
}

export function SoundButton({ sound, label }: { sound: Sound; label: string }) {
  const [muted, setMuted] = useState(sound.muted);
  return (
    <button
      type="button"
      className="sound"
      aria-label={label}
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
  );
}
