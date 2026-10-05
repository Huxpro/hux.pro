"use client";

import { useChat } from "@ai-sdk/react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import {
  dropAskConversation,
  editAskMessage,
  getAskChat,
  getAskRunning,
  getAskServerSettings,
  getAskSettings,
  newAskChat,
  openAskConversation,
  prepareAskChat,
  rewindAskChat,
  setAskSettings,
  subscribeAskChat,
  subscribeAskRunning,
} from "./chat";
import {
  type AskSettings,
  deleteConversation,
  getConversationsServerSnapshot,
  getConversationsSnapshot,
  subscribeConversations,
} from "./history";
import { loadAskSearch } from "./search";
import { contextsNow } from "./page-context";
import { discardContextDraft, takeAskContexts } from "./pending-context";
import type { AskContext } from "./tools";

// =============================================================================
// Ask for React: the hooks every surface that shows Ask is built from. The
// state behind them is module-level (./chat.ts, ./history.ts), so two
// surfaces at once show the same conversation.
// =============================================================================

/** The current conversation, its status, and what can be done to it. */
export function useAskSession() {
  const chat = useSyncExternalStore(subscribeAskChat, getAskChat, getAskChat);
  // A render per streamed chunk is more than a reader can see.
  const helpers = useChat({ chat, throttle: 50 });
  const busy = helpers.status === "submitted" || helpers.status === "streaming";

  /** Ask, with what the reader has open (../lib/page-context.ts), if any.
   *  A different post starts a new chat first (./chat-continuity.ts). */
  const send = useCallback(
    (text: string, contexts: readonly AskContext[] = contextsNow()) => {
      const question = text.trim();
      if (!question) return false;
      const before = getAskChat();
      const target = prepareAskChat();
      if (target === before && busy) return false;
      void target.sendMessage({
        parts: [
          { type: "text", text: question },
          ...contexts.map((data) => ({ type: "data-context" as const, data })),
        ],
      });
      if (target === before) takeAskContexts();
      else discardContextDraft(before.id);
      return true;
    },
    [busy],
  );

  return {
    ...helpers,
    chat,
    busy,
    send,
    newChat: newAskChat,
    openConversation: openAskConversation,
    /** Drop everything after this message. */
    rewind: rewindAskChat,
    /** Replace this question and ask again; what came after it goes. */
    edit: editAskMessage,
  };
}

/** Past conversations, newest first. */
export function useAskHistory() {
  const conversations = useSyncExternalStore(
    subscribeConversations,
    getConversationsSnapshot,
    getConversationsServerSnapshot,
  );
  return {
    conversations,
    deleteConversation: (id: string) => {
      dropAskConversation(id);
      deleteConversation(id);
    },
  };
}

/** The current conversation's model and thinking level; changing them
 *  changes that conversation (and what the next new one starts on). */
export function useAskPrefs() {
  const { model, effort } = useSyncExternalStore(subscribeAskChat, getAskSettings, getAskServerSettings);
  return {
    model,
    setModel: (value: string) => setAskSettings({ model: value }),
    effort,
    setEffort: (value: string) => setAskSettings({ effort: value as AskSettings["effort"] }),
  };
}

/**
 * Opening Ask on another post starts a new chat. Moving between places, or
 * a route change while it stays open, does not: the next question does
 * (`prepareAskChat` in send).
 */
export function useAskContinuity(active: boolean) {
  const pathname = usePathname();
  const wasActive = useRef(false);
  useEffect(() => {
    const opened = active && !wasActive.current;
    wasActive.current = active;
    if (opened) prepareAskChat();
  }, [active, pathname]);
}

/** The ids of the conversations being answered now, for the history. */
export function useAskRunning(): ReadonlySet<string> {
  return useSyncExternalStore(subscribeAskRunning, getAskRunning, getAskRunning);
}

/** The last request sent, so a remount (or a second surface) never sends
 *  one twice. */
let consumedRequest = 0;

/**
 * Send a question handed to the surface (the palette's field, a link with a
 * question in it), once per request: `n` counts requests, so asking the same
 * thing twice asks twice.
 */
export function useAskRequest(request: { text: string; n: number } | null) {
  useEffect(() => {
    if (!request || request.n <= consumedRequest) return;
    consumedRequest = request.n;
    const before = getAskChat();
    const chat = prepareAskChat();
    void loadAskSearch().catch(() => null).then(() => {
      if (chat !== getAskChat()) return;
      void chat.sendMessage({
        parts: [
          { type: "text", text: request.text },
          ...contextsNow().map((data) => ({ type: "data-context" as const, data })),
        ],
      });
      if (chat === before) takeAskContexts();
      else discardContextDraft(before.id);
    });
  }, [request]);
}
