"use client";

import { GLASS_CAPSULE } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { dismissNotice, NOTICE_SLOT_ATTRIBUTE, useNotice } from "../notice";
import { useDock } from "../provider";

// ---------------------------------------------------------------------------
// DockNotice: a notice (notice.ts), shown where the pills are.
//
// It takes the dock's anchor the way an open panel does: the pills step aside
// for it (`noticeUp`, the same fade they make for a panel) and come back when
// it goes, so the top centre holds one thing at a time. This is how iOS's
// island puts a Live Activity away for a moment to say "Silent Mode". Its
// motion is the pills' own, so the hand-over reads as one thing changing
// rather than two things passing.
//
// It is the capsule (GLASS_CAPSULE), at the pills' height, because it is one
// line to glance at. The fade and the scale are on the capsule itself, which
// is the glass, never on a box around it (live-activity.tsx, note 4).
//
// It does not publish into `--dock-clear`: a bar pinned under the dock (/works,
// /prompt) would jump down and back for a three-second line. A bar it would
// cover steps aside instead, as the pills do (components/ui/use-notice-yield,
// which finds this slot by NOTICE_SLOT_ATTRIBUTE).
//
// It can be put away by hand, the way an iOS banner can: swiped up it follows
// the finger and leaves that way, and a short pull springs back; a tap takes
// it down too. It is not a button: it does nothing else, and a screen reader
// hears it through the status region, not as a control. For everyone else, the
// timer is what puts it away. While it is held (a finger down on it, or a
// pointer resting over it) the timer stops, so a line being read does not
// vanish mid-read. On release, it gets the time it had left.
// ---------------------------------------------------------------------------

/** The pills' hide transition (globals.css, `[data-dock-pill][data-hidden]`). */
const EASE = [0.32, 0.72, 0, 1] as const;
const AWAY = { opacity: 0, y: -6, scale: 0.9 };
/** Thrown up and away, past the top of the screen. */
const THROWN = { opacity: 0, y: -64, scale: 1 };

/** A pull this far up, or this fast, is a dismissal; anything less springs back. */
const SWIPE_PX = 16;
const SWIPE_VELOCITY = 300;
/** …but a flick has to have gone somewhere: a tremor on a tap is not one. */
const FLICK_MIN_PX = 6;

export function DockNotice() {
  const notice = useNotice();
  const { noticeUp } = useDock();
  const reduced = useReducedMotion() ?? false;
  const shown = noticeUp ? notice : null;

  // Its time runs only while it is on screen: a notice that waited behind an
  // open panel gets all of it once the panel is gone, and one shown again
  // (`seq`) starts over.
  const id = shown?.id;
  const seq = shown?.seq;
  const duration = shown?.duration;
  const [held, setHeld] = useState(false);
  const [thrown, setThrown] = useState(false);
  // What is left of its time, carried across a hold.
  const left = useRef<{ seq: number | undefined; ms: number }>({ seq: undefined, ms: 0 });
  useEffect(() => {
    if (id === undefined || duration === undefined) return;
    if (left.current.seq !== seq) left.current = { seq, ms: duration };
    if (held) return;
    const start = performance.now();
    const timer = window.setTimeout(() => dismissNotice(id), left.current.ms);
    return () => {
      window.clearTimeout(timer);
      left.current.ms = Math.max(0, left.current.ms - (performance.now() - start));
    };
  }, [id, seq, duration, held]);

  // A new notice arrives the ordinary way, whatever the last one did. This is
  // adjusted during the render that brings it, not in an effect after.
  const [lastSeq, setLastSeq] = useState(seq);
  if (seq !== undefined && seq !== lastSeq) {
    setLastSeq(seq);
    setThrown(false);
    setHeld(false);
  }

  return (
    <div
      {...{ [NOTICE_SLOT_ATTRIBUTE]: "" }}
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-0 grid justify-items-center px-4"
    >
      <AnimatePresence initial={false} custom={thrown}>
        {shown && (
          <NoticeCapsule
            key={shown.id}
            notice={shown}
            thrown={thrown}
            reduced={reduced}
            onHold={setHeld}
            onThrow={() => setThrown(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * One notice's capsule. Its own component so each notice owns its travel
 * (`y`): one leaving while the next arrives are two capsules in the same cell,
 * and a shared motion value would drag each by the other.
 */
function NoticeCapsule({
  notice,
  thrown,
  reduced,
  onHold,
  onThrow,
}: {
  notice: NonNullable<ReturnType<typeof useNotice>>;
  thrown: boolean;
  reduced: boolean;
  onHold: (held: boolean) => void;
  onThrow: () => void;
}) {
  /** Whether the press in progress has become a drag. */
  const dragged = useRef(false);
  /** The capsule's travel: the drag's, the throw's and the arrival's. */
  const y = useMotionValue(0);
  const Icon = notice.icon;
  return (
    <motion.div
      custom={thrown}
      variants={{
        away: (wasThrown: boolean) => (wasThrown ? THROWN : AWAY),
        here: { opacity: 1, y: 0, scale: 1 },
      }}
      initial="away"
      animate="here"
      exit="away"
      transition={reduced ? { duration: 0 } : { duration: 0.22, ease: EASE }}
      // Up only: down it barely gives, since there is nowhere below the band
      // for it to go.
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 1, bottom: 0.1 }}
      dragSnapToOrigin
      onDragStart={() => {
        dragged.current = true;
        onHold(true);
      }}
      onDragEnd={(_, info) => {
        onHold(false);
        const flicked = info.velocity.y < -SWIPE_VELOCITY && info.offset.y < -FLICK_MIN_PX;
        if (info.offset.y < -SWIPE_PX || flicked) {
          // Thrown: carried up and off from where the finger let go, and only
          // then dismissed. Left to the exit, the throw would race the drag's
          // own spring back to the rest (both move `y`), and the exit,
          // interrupted, would never finish, stranding the capsule. This runs
          // after the drag has started its spring (motion starts it, then
          // calls here), so it takes `y` over.
          onThrow();
          animate(y, -64, { duration: reduced ? 0 : 0.18, ease: EASE }).then(() =>
            dismissNotice(notice.id),
          );
        }
      }}
      // motion calls a press that became a drag a tap when it ends over the
      // capsule. It always does, having carried the capsule with it, so a
      // short pull would dismiss instead of springing back. A press that
      // dragged is not a tap.
      onTap={() => {
        if (!dragged.current) dismissNotice(notice.id);
      }}
      onPointerDown={() => {
        dragged.current = false;
        onHold(true);
      }}
      onPointerUp={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      onHoverStart={() => onHold(true)}
      onHoverEnd={() => onHold(false)}
      style={{ y }}
      className={cn(
        GLASS_CAPSULE,
        // Stacked in one cell, so a notice replacing another crossfades in
        // place instead of the two queueing side by side.
        "pointer-events-auto [grid-area:1/1] origin-top",
        "flex h-9 max-w-[calc(100vw-2rem)] items-center gap-2 pl-3 pr-3.5",
        "cursor-default select-none touch-none",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate text-sm">
        <span className="font-medium text-foreground">{notice.title}</span>
        {notice.note && (
          <span className="text-tertiary-foreground">
            {" · "}
            {notice.note}
          </span>
        )}
      </span>
    </motion.div>
  );
}
