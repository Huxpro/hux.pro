"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  dropAskConversation,
  getAskChat,
  getAskRunning,
  getAskServerSettings,
  getAskSettings,
  newAskChat,
  openAskConversation,
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

// =============================================================================
// Ask for React: the hooks every surface that shows Ask is built from. The
// state behind them is module-level (./chat.ts, ./history.ts), so two
// surfaces at once show the same conversation.
// =============================================================================

/** The current conversation, its status, and what can be done to it. */
export function useAskSession() {
  const chat = useSyncExternalStore(subscribeAskChat, getAskChat, getAskChat);
  const helpers = useChat({ chat });
  const busy = helpers.status === "submitted" || helpers.status === "streaming";

  const send = useCallback(
    (text: string) => {
      const question = text.trim();
      if (!question || busy) return false;
      void helpers.sendMessage({ text: question });
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
  const { sendMessage } = useAskSession();
  useEffect(() => {
    if (!request || request.n <= consumedRequest) return;
    consumedRequest = request.n;
    void sendMessage({ text: request.text });
  }, [request, sendMessage]);
}
