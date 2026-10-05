"use client";

import { useSyncExternalStore } from "react";
import { getAskChat, subscribeAskChat } from "./chat";
import type { AskContext } from "./tools";
import { MAX_CONTEXTS } from "./context-policy";

// Draft attachments and dismissed pages belong to a conversation, across
// placement changes. Switching chats never carries another draft's sources.
interface Draft { pending: readonly AskContext[]; dismissed: readonly string[] }
const EMPTY: Draft = { pending: [], dismissed: [] };
const drafts = new Map<string, Draft>();
const listeners = new Set<() => void>();
export function getContextDraft(): Draft { return drafts.get(getAskChat().id) ?? EMPTY; }
function set(next: Draft) {
  drafts.set(getAskChat().id, next);
  listeners.forEach((l) => l());
}

/** Refuse overflow visibly; never silently discard an earlier attachment. */
export function addAskContext(context: AskContext): boolean {
  const draft = getContextDraft();
  if (draft.pending.some((c) => c.href === context.href && c.text === context.text)) return true;
  if (draft.pending.length >= MAX_CONTEXTS) return false;
  set({ ...draft, pending: [...draft.pending, context] });
  return true;
}
export function removeAskContext(context: AskContext) {
  const draft = getContextDraft();
  set({ ...draft, pending: draft.pending.filter((c) => c !== context) });
}
export function dismissAskPage(id: string, dismissed: boolean) {
  const draft = getContextDraft();
  set({ ...draft, dismissed: [...draft.dismissed.filter((d) => d !== id), ...(dismissed ? [id] : [])] });
}
export function takeAskContexts(): readonly AskContext[] {
  const draft = getContextDraft();
  if (draft.pending.length) set({ ...draft, pending: [] });
  return draft.pending;
}
export function useContextDraft(): Draft {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      const off = subscribeAskChat(l);
      return () => { listeners.delete(l); off(); };
    },
    getContextDraft,
    () => EMPTY,
  );
}
