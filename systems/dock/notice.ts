"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";

// =============================================================================
// Notices: what the system tells you, said once, at the top.
//
// The one-line "this just happened" the site used to put in a bottom toast:
// the sun switched the theme, the page is in the other language now, the sky
// window opened, a link went to a new tab. It is shown in the Dock (see
// components/dock-notice.tsx), where Live Activities already live, because
// the two are the same kind of thing (the system reporting to you), and
// because the bottom of the screen belongs to what you summon: the command
// bar and the sheets that rise from it. Top is the system → you, bottom is
// you → the system. See docs/system-dock.md, "Notices".
//
// A module store rather than a provider, because the callers are everywhere
// (providers, effects, a clock), and most of them sit above or beside the
// Dock in the tree, not under it. `showNotice` can be called from anywhere,
// before the Dock has mounted too; the Dock shows whatever is current when it
// does.
//
// One at a time. A new notice replaces the one showing, the way iOS's island
// swaps one system alert for the next rather than stacking them; the same `id`
// again updates it in place and starts its time over. Its time only runs while
// it is on screen: with a Live Activity panel open the notice waits for it to
// close (the panel is where it would stand), then gets its full duration.
// =============================================================================

export interface Notice {
  /** Same id again replaces this notice in place rather than popping a new one. */
  id: string;
  icon: LucideIcon;
  /** The fact, in the foreground. */
  title: ReactNode;
  /** The secondary line: how to undo it, or what did not change. */
  note?: ReactNode;
  /** How long it stays on screen, ms. */
  duration?: number;
}

export type ShownNotice = Notice & {
  duration: number;
  /** Bumped on every show, so the Dock can restart the notice's time. */
  seq: number;
};

/**
 * On the box the notice sits in, for anything that has to know where it is,
 * such as a bar pinned under the Dock stepping aside for it
 * (components/ui/use-notice-yield).
 */
export const NOTICE_SLOT_ATTRIBUTE = "data-dock-notice-slot";

/** Long enough to read a line and its note once. */
export const NOTICE_DURATION_MS = 3200;

let current: ShownNotice | null = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Put a notice up in the Dock, replacing whatever is there. Returns its id. */
export function showNotice(notice: Notice): string {
  seq += 1;
  current = { ...notice, duration: notice.duration ?? NOTICE_DURATION_MS, seq };
  emit();
  return notice.id;
}

/**
 * Take a notice down. With an id, only if that is the one showing: a caller
 * tidying up after itself must not take down someone else's.
 */
export function dismissNotice(id?: string) {
  if (!current || (id !== undefined && current.id !== id)) return;
  current = null;
  emit();
}

/** The notice that should be on screen, or null. */
export function useNotice(): ShownNotice | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
