"use client";

import { useEffect, type RefObject } from "react";
import {
  animate,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from "motion/react";
import { onPageScroll } from "vitre";
import { NOTICE_SLOT_ATTRIBUTE, useNotice } from "@/systems/dock";

/** The pills' hide transition (globals.css, `[data-dock-pill][data-hidden]`). */
const STEP = { duration: 0.22, ease: [0.32, 0.72, 0, 1] } as const;

/**
 * 0 → 1 as a bar pinned under the Dock steps aside for a notice.
 *
 * A notice (systems/dock) stands at the Dock's anchor and does not push
 * anything down, so a bar pinned at the top of the page (PageLayout
 * `pinnedActions` — the /works and /prompt toolbars) can end up under it,
 * and being wider, shows round both of its ends. It steps aside instead, the
 * way the Live Activity pills do: the top centre holds one thing at a time.
 *
 * Only when it is actually under the notice. Pinned beneath Live Activity
 * pills it already clears the notice, which stands where the pills do, and
 * resting down the page under the title it is nowhere near it. So this
 * measures: the bar's top against the notice's bottom, whenever either can
 * have moved — the page scrolls, the window resizes, or the notice appears
 * (it waits behind an open panel, so "there is a notice" is not yet "it is
 * on screen").
 *
 * A motion value, so the caller can put the fade on the glass and on the
 * row separately — never on a box that contains the glass
 * (systems/dock/components/live-activity.tsx, note 4).
 */
export function useNoticeYield(
  ref: RefObject<HTMLElement | null>,
): MotionValue<number> {
  const notice = useNotice();
  const up = notice !== null;
  const reduced = useReducedMotion() ?? false;
  const away = useMotionValue(0);

  useEffect(() => {
    const go = (to: number) =>
      animate(away, to, reduced ? { duration: 0 } : STEP);

    if (!up) {
      const step = go(0);
      return () => step.stop();
    }

    const slot = document.querySelector<HTMLElement>(`[${NOTICE_SLOT_ATTRIBUTE}]`);
    let target = -1;
    const check = () => {
      const bar = ref.current;
      if (!bar || !slot) return;
      // The slot's layout box, not the capsule's: the capsule arrives
      // scaled, and its rect would be the frame it was caught in.
      const under =
        slot.offsetHeight > 0 &&
        bar.getBoundingClientRect().top < slot.getBoundingClientRect().bottom + 4;
      const next = under ? 1 : 0;
      if (next === target) return;
      target = next;
      go(next);
    };

    check();
    const off = onPageScroll(check);
    const ro = new ResizeObserver(check);
    if (slot) ro.observe(slot);
    window.addEventListener("resize", check);
    return () => {
      off();
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [up, ref, away, reduced]);

  return away;
}
