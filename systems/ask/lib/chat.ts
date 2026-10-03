"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { askModelOf, DEFAULT_ASK_MODEL } from "./models";
import { loadAskSearch } from "./search";
import type { AskUIMessage } from "./tools";

// =============================================================================
// The conversation, and the agent loop that runs in the page.
//
// One conversation per page load, kept here rather than in a component, so
// stepping back to search and returning (Escape, then the Ask row) finds it
// where it was. "New chat" replaces it.
//
// The loop: the route streams a turn; when the turn ends in tool calls, each
// is run here against the site's index (./search.ts) and its result added to
// the message, and the conversation goes back to the route for the next step.
// That repeats until the model answers in text, or MAX_TOOL_CALLS is reached
// in one turn, which stops a model that keeps searching.
// =============================================================================

const MODEL_KEY = "hux_ask_model";
const MAX_TOOL_CALLS = 8;

let model: string | null = null;

/** The picked model: a per-viewer convenience, remembered where it can be. */
export function getAskModel(): string {
  if (model === null) {
    try {
      model = askModelOf(localStorage.getItem(MODEL_KEY)).id;
    } catch {
      model = DEFAULT_ASK_MODEL;
    }
  }
  return model;
}

export function setAskModel(id: string) {
  model = askModelOf(id).id;
  try {
    localStorage.setItem(MODEL_KEY, model);
  } catch {
    // Storage unavailable (private window, blocked): the pick lasts the page.
  }
}

function toolCallsIn(message: AskUIMessage | undefined): number {
  return message?.parts.filter((p) => p.type.startsWith("tool-")).length ?? 0;
}

function createChat(): Chat<AskUIMessage> {
  const chat: Chat<AskUIMessage> = new Chat<AskUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Read on every request, the automatic follow-ups after a tool
      // included, so a model picked mid-conversation applies from the next
      // step.
      body: () => ({ model: getAskModel() }),
    }),
    sendAutomaticallyWhen: (options) =>
      lastAssistantMessageIsCompleteWithToolCalls(options) &&
      toolCallsIn(options.messages.at(-1)) < MAX_TOOL_CALLS,
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic) return;
      try {
        const site = await loadAskSearch();
        if (toolCall.toolName === "search_site") {
          void chat.addToolOutput({
            tool: "search_site",
            toolCallId: toolCall.toolCallId,
            output: site.search(toolCall.input),
          });
        } else if (toolCall.toolName === "read") {
          void chat.addToolOutput({
            tool: "read",
            toolCallId: toolCall.toolCallId,
            output: site.read(toolCall.input),
          });
        }
      } catch (error) {
        void chat.addToolOutput({
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
          state: "output-error",
          errorText: error instanceof Error ? error.message : "The site's index could not be loaded.",
        });
      }
    },
  });
  return chat;
}

let current: Chat<AskUIMessage> | null = null;

export function getAskChat(): Chat<AskUIMessage> {
  current ??= createChat();
  return current;
}

export function resetAskChat(): Chat<AskUIMessage> {
  void current?.stop();
  current = createChat();
  return current;
}
