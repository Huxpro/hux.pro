"use client";

import { GLASS_CAPSULE } from "@/lib/glass";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { dismissNotice, useNotice } from "../notice";
import { useDock } from "../provider";

// ---------------------------------------------------------------------------
// DockNotice — a notice (notice.ts), standing where the pills do.
//
// It takes the dock's anchor the way an open panel does: the pills step aside
// for it (`noticeUp`, the same fade they make for a panel) and come back when
// it goes, so the top centre holds one thing at a time — iOS's island putting
// a Live Activity away for a moment to say "Silent Mode". Its motion is the
// pills' own, so the hand-over reads as one thing changing rather than two
// things passing.
//
// It is the capsule (GLASS_CAPSULE), at the pills' height, because it is one
// line to glance at. The fade and the scale are on the capsule itself, which
// is the glass — never on a box around it (live-activity.tsx, note 4).
//
// It does not publish into `--dock-clear`: a bar pinned under the dock (/works,
// /prompt) would jump down and back for a three-second line. The notice floats
// over it instead, the way a banner floats over a navigation bar.
//
// A press takes it down early. It is not a button — it does nothing else, and
// a screen reader hears it through the status region, not as a control; the
// time is what puts it away for everyone else.
// ---------------------------------------------------------------------------

/** The pills' hide transition (globals.css, `[data-dock-pill][data-hidden]`). */
const EASE = [0.32, 0.72, 0, 1] as const;
const AWAY = { opacity: 0, y: -6, scale: 0.9 };

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
  useEffect(() => {
    if (id === undefined || duration === undefined) return;
    const timer = window.setTimeout(() => dismissNotice(id), duration);
    return () => window.clearTimeout(timer);
  }, [id, seq, duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-0 grid justify-items-center px-4"
    >
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div
            key={shown.id}
            initial={AWAY}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={AWAY}
            transition={reduced ? { duration: 0 } : { duration: 0.22, ease: EASE }}
            onClick={() => dismissNotice(shown.id)}
            className={cn(
              GLASS_CAPSULE,
              // Stacked in one cell, so a notice replacing another crossfades
              // in place instead of the two queueing side by side.
              "pointer-events-auto [grid-area:1/1] origin-top",
              "flex h-9 max-w-[calc(100vw-2rem)] items-center gap-2 pl-3 pr-3.5",
              "cursor-default select-none",
            )}
          >
            <shown.icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate text-sm">
              <span className="font-medium text-foreground">{shown.title}</span>
              {shown.note && (
                <span className="text-tertiary-foreground">
                  {" · "}
                  {shown.note}
                </span>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
