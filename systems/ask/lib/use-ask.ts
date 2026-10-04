"use client";

import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getAskChat, newAskChat, openAskConversation, subscribeAskChat } from "./chat";
import { getAskEffort, getAskModel, setAskEffort, setAskModel, subscribeAskPrefs } from "./prefs";
import {
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
  return { conversations, deleteConversation };
}

/** The viewer's model and effort, remembered in this browser. */
export function useAskPrefs() {
  // One store, so the composer and the devtool show the same pick.
  const model = useSyncExternalStore(subscribeAskPrefs, getAskModel, getAskModel);
  const effort = useSyncExternalStore(subscribeAskPrefs, getAskEffort, getAskEffort);
  return { model, setModel: setAskModel, effort, setEffort: setAskEffort };
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
