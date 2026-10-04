"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { getConversation, saveConversation } from "./history";
import { getAskEffort, getAskModel } from "./prefs";
import { loadAskSearch } from "./search";
import type { AskUIMessage } from "./tools";

// =============================================================================
// The session: which conversation is open, and the agent loop that runs in
// the page. The viewer's model and effort are ./prefs.ts.
//
// One conversation is current at a time, kept here rather than in a
// component, so any surface that shows Ask (the palette, a panel, a page)
// shows the same one, and closing a surface does not lose it. Every
// finished turn is saved to the history (./history.ts); opening an old
// conversation makes it current again.
//
// The loop: the route streams a turn; when the turn ends in tool calls, each
// is run here against the site's index (./search.ts) and its result added to
// the message, and the conversation goes back to the route for the next step.
// It ends when the model answers. Two guards make sure it does answer:
//   - the route stops offering tools once a turn has made TOOL_BUDGET calls
//     (app/api/chat), and this page stops resubmitting at MAX_TOOL_CALLS;
//   - a step that ends with neither text nor a tool call (a model that only
//     reasoned) is sent back once with `finalize`, which tells the route to
//     answer now.
// =============================================================================

const MAX_TOOL_CALLS = 10;

// ---- The loop ---------------------------------------------------------------

function toolPartsIn(message: AskUIMessage | undefined) {
  return message?.parts.filter((p) => p.type.startsWith("tool-")) ?? [];
}

/** The turn's last step ended with no reply and nothing left to run. */
function endedWithoutAnswer(message: AskUIMessage | undefined): boolean {
  if (message?.role !== "assistant") return false;
  const parts = message.parts;
  const lastStep = parts.map((p) => p.type).lastIndexOf("step-start");
  const step = parts.slice(lastStep + 1);
  const answered = step.some((p) => p.type === "text" && p.text.trim());
  const calling = step.some((p) => p.type.startsWith("tool-"));
  return !answered && !calling && toolPartsIn(message).length > 0;
}

/** Messages already sent back once for an answer, so a model that still
 *  says nothing is not asked forever. */
const nudged = new Set<string>();
let finalizeNext = false;

function createChat(id?: string, messages?: AskUIMessage[]): Chat<AskUIMessage> {
  const chat: Chat<AskUIMessage> = new Chat<AskUIMessage>({
    ...(id ? { id } : {}),
    ...(messages ? { messages } : {}),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Read on every request, the automatic follow-ups after a tool
      // included, so a model or effort picked mid-conversation applies from
      // the next step.
      body: () => {
        const finalize = finalizeNext;
        finalizeNext = false;
        return { model: getAskModel(), effort: getAskEffort(), finalize };
      },
    }),
    sendAutomaticallyWhen: (options) => {
      const last = options.messages.at(-1);
      if (lastAssistantMessageIsCompleteWithToolCalls(options)) {
        return toolPartsIn(last).length < MAX_TOOL_CALLS;
      }
      if (last && endedWithoutAnswer(last) && !nudged.has(last.id)) {
        nudged.add(last.id);
        finalizeNext = true;
        return true;
      }
      return false;
    },
    onFinish: () => saveConversation(chat.id, chat.messages),
    onError: () => saveConversation(chat.id, chat.messages),
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

// ---- The current conversation ------------------------------------------------

let current: Chat<AskUIMessage> | null = null;
const listeners = new Set<() => void>();

function setCurrent(chat: Chat<AskUIMessage>) {
  if (current && current !== chat) {
    void current.stop();
    if (current.messages.length) saveConversation(current.id, current.messages);
  }
  current = chat;
  listeners.forEach((l) => l());
}

export function getAskChat(): Chat<AskUIMessage> {
  current ??= createChat();
  return current;
}

/** A fresh conversation; the one it replaces is in the history. */
export function newAskChat(): Chat<AskUIMessage> {
  const chat = createChat();
  setCurrent(chat);
  return chat;
}

/** Make a past conversation current again. */
export function openAskConversation(id: string): Chat<AskUIMessage> | null {
  if (current?.id === id) return current;
  const saved = getConversation(id);
  if (!saved) return null;
  const chat = createChat(saved.id, saved.messages);
  setCurrent(chat);
  return chat;
}

// For useSyncExternalStore: the current conversation's Chat.
export function subscribeAskChat(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
