"use client";

import { useSyncExternalStore } from "react";
import type { AskContext } from "./tools";

// =============================================================================
// What the reader has pointed at for the next question: words they
// selected ("Ask" over a selection, components/selection.tsx), a thing they
// dragged in (a commit, an entry, a picture, a link; the composer's drop).
// Kept here, not in the composer, because the composer may not be mounted
// yet: the selection's button opens Ask after putting the quote here.
// Sent with the next question and cleared; each shows as a tag until then.
// =============================================================================

const MAX_PENDING = 3;

let pending: readonly AskContext[] = [];
const listeners = new Set<() => void>();

function set(next: readonly AskContext[]) {
  pending = next;
  listeners.forEach((l) => l());
}

/** Point at something for the next question (the same one twice is once). */
export function addAskContext(context: AskContext) {
  const others = pending.filter((c) => !(c.href === context.href && c.text === context.text));
  set([...others, context].slice(-MAX_PENDING));
}

export function removeAskContext(context: AskContext) {
  set(pending.filter((c) => c !== context));
}

/** Everything pointed at, for a question being sent; none left after. */
export function takeAskContexts(): readonly AskContext[] {
  const taken = pending;
  if (taken.length) set([]);
  return taken;
}

const EMPTY: readonly AskContext[] = [];

export function usePendingAskContexts(): readonly AskContext[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => pending,
    () => EMPTY,
  );
}
