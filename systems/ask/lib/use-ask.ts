"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  dropAskConversation,
  editAskMessage,
  getAskChat,
  getAskRunning,
  getAskServerSettings,
  getAskSettings,
  newAskChat,
  openAskConversation,
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
import { takeAskContexts } from "./pending-context";
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

  /** Ask, with what the reader has open (../lib/page-context.ts), if any. */
  const send = useCallback(
    (text: string, contexts: readonly AskContext[] = contextsNow()) => {
      const question = text.trim();
      if (!question || busy) return false;
      void helpers.sendMessage({
        parts: [
          { type: "text", text: question },
          ...contexts.map((data) => ({ type: "data-context" as const, data })),
        ],
      });
      takeAskContexts();
      return true;
    },
    [busy, helpers],
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
    const chat = getAskChat();
    void loadAskSearch().catch(() => null).then(() => {
      if (chat !== getAskChat()) return;
      void chat.sendMessage({
        parts: [
          { type: "text", text: request.text },
          ...contextsNow().map((data) => ({ type: "data-context" as const, data })),
        ],
      });
      takeAskContexts();
    });
  }, [request]);
}
