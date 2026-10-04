"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { getConversation, saveConversation, type AskSettings } from "./history";
import { askEffortOf, askModelOf, DEFAULT_ASK_EFFORT, DEFAULT_ASK_MODEL } from "./models";
import { askEffortPref, askModelPref } from "./prefs";
import { loadAskSearch } from "./search";
import type { AskUIMessage } from "./tools";

// =============================================================================
// The session: which conversation is open, the conversations still running,
// and the agent loop that runs in the page.
//
// One conversation is current at a time, kept here rather than in a
// component, so any surface that shows Ask (the palette, a panel, a page)
// shows the same one, and closing a surface does not lose it. Every
// finished turn is saved to the history (./history.ts); opening an old
// conversation makes it current again.
//
// Conversations run side by side: moving to another one (a new chat, one
// from the history) does not stop the one being answered. It goes on in the
// background, tools and all, and saves itself when it ends; every
// conversation opened this visit stays live (`live`), so opening it again
// while it runs shows it running, not a copy from before. The history marks
// the ones still answering (`useAskRunning`).
//
// Each conversation runs on its own model and thinking level, kept with it
// in the history: reopening one puts its pickers back, and changing them
// changes that conversation. A new one starts on the last ones picked
// (./prefs.ts).
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

/** Each conversation's model and thinking level, by its id. */
const settings = new Map<string, AskSettings>();

function settingsOf(id: string): AskSettings {
  return settings.get(id) ?? { model: askModelPref.get(), effort: askEffortPref.get() };
}

/** Save a conversation with what it runs on. */
function save(chat: Chat<AskUIMessage>) {
  saveConversation(chat.id, chat.messages, settingsOf(chat.id));
}

function createChat(id?: string, messages?: AskUIMessage[], own?: Partial<AskSettings>): Chat<AskUIMessage> {
  const chat: Chat<AskUIMessage> = new Chat<AskUIMessage>({
    ...(id ? { id } : {}),
    ...(messages ? { messages } : {}),
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Read on every request, the automatic follow-ups after a tool
      // included, so a model or effort picked mid-conversation applies from
      // the next step. This conversation's own, wherever it is running.
      body: () => {
        const finalize = finalizeNext;
        finalizeNext = false;
        return { ...settingsOf(chat.id), finalize };
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
    // Also after an error or a stop, with what had come in by then.
    onFinish: () => save(chat),
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
        } else if (toolCall.toolName === "present") {
          // The cards are drawn from the call itself (components/cards.tsx);
          // the answer tells the model which ids were real.
          const shown = site.docsOf(toolCall.input.ids ?? []).map((d) => d.id);
          void chat.addToolOutput({
            tool: "present",
            toolCallId: toolCall.toolCallId,
            output: shown.length ? { shown } : { error: "None of these ids is on the site. Use ids from search_site or the map." },
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
  settings.set(chat.id, {
    model: own?.model ? askModelOf(own.model).id : askModelPref.get(),
    effort: own?.effort ? askEffortOf(own.effort) : askEffortPref.get(),
  });
  track(chat);
  return chat;
}

// ---- Conversations running ------------------------------------------------------

/** Every conversation opened this visit, by id: the one shown, and the ones
 *  still answering in the background. */
const live = new Map<string, Chat<AskUIMessage>>();
let running: ReadonlySet<string> = new Set();
const runningListeners = new Set<() => void>();

function track(chat: Chat<AskUIMessage>) {
  live.set(chat.id, chat);
  chat["~registerStatusCallback"](() => {
    const busy = chat.status === "submitted" || chat.status === "streaming";
    if (busy === running.has(chat.id)) return;
    const next = new Set(running);
    if (busy) next.add(chat.id);
    else next.delete(chat.id);
    running = next;
    runningListeners.forEach((l) => l());
    // In the history from its first question, so it can be gone back to
    // while it is still being answered.
    if (busy) save(chat);
  });
}

/** The ids of the conversations being answered now. */
export function getAskRunning(): ReadonlySet<string> {
  return running;
}

export function subscribeAskRunning(listener: () => void) {
  runningListeners.add(listener);
  return () => {
    runningListeners.delete(listener);
  };
}

// ---- The current conversation ------------------------------------------------

let current: Chat<AskUIMessage> | null = null;
const listeners = new Set<() => void>();

function setCurrent(chat: Chat<AskUIMessage>) {
  // The one left goes on (if it is answering) and is in the history now.
  if (current && current !== chat && current.messages.length) save(current);
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

/** Make a past conversation current again: live if it is still running
 *  (or was opened this visit), else from the history. */
export function openAskConversation(id: string): Chat<AskUIMessage> | null {
  if (current?.id === id) return current;
  let chat = live.get(id) ?? null;
  if (!chat) {
    const saved = getConversation(id);
    if (!saved) return null;
    chat = createChat(saved.id, saved.messages, saved);
  }
  setCurrent(chat);
  return chat;
}

/** Forget a conversation that was deleted from the history. */
export function dropAskConversation(id: string) {
  const chat = live.get(id);
  if (!chat || chat === current) return;
  void chat.stop();
  live.delete(id);
  settings.delete(id);
}

// ---- What the current conversation runs on -------------------------------------

const DEFAULT_SETTINGS: AskSettings = { model: DEFAULT_ASK_MODEL, effort: DEFAULT_ASK_EFFORT };

/** The current conversation's model and thinking level (the same object
 *  until they change). */
export function getAskSettings(): AskSettings {
  return typeof window === "undefined" ? DEFAULT_SETTINGS : settingsOf(getAskChat().id);
}

export function getAskServerSettings(): AskSettings {
  return DEFAULT_SETTINGS;
}

/** Change what the current conversation runs on; also what the next new
 *  one starts on. */
export function setAskSettings(change: Partial<AskSettings>) {
  const chat = getAskChat();
  const own = settingsOf(chat.id);
  const next: AskSettings = {
    model: change.model ? askModelOf(change.model).id : own.model,
    effort: change.effort ? askEffortOf(change.effort) : own.effort,
  };
  settings.set(chat.id, next);
  if (change.model) askModelPref.set(next.model);
  if (change.effort) askEffortPref.set(next.effort);
  if (chat.messages.length) save(chat);
  listeners.forEach((l) => l());
}

// For useSyncExternalStore: the current conversation's Chat.
export function subscribeAskChat(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---- Going back ---------------------------------------------------------------

/**
 * Rewind the conversation to just after a message: everything later is
 * dropped, and the history saved that way. A reply still being written is
 * stopped first.
 */
export async function rewindAskChat(messageId: string) {
  const chat = getAskChat();
  if (!chat.messages.some((m) => m.id === messageId)) return;
  await chat.stop();
  // Found again after the stop: its last chunk may have changed the list.
  const i = chat.messages.findIndex((m) => m.id === messageId);
  chat.messages = chat.messages.slice(0, i + 1);
  chat.clearError();
  saveConversation(chat.id, chat.messages);
}

/**
 * Ask a question again, changed: the AI SDK replaces the user message with
 * this id, drops everything after it, and asks for a new reply.
 */
export async function editAskMessage(messageId: string, text: string) {
  const question = text.trim();
  const chat = getAskChat();
  if (!question || !chat.messages.some((m) => m.id === messageId)) return;
  await chat.stop();
  chat.clearError();
  await chat.sendMessage({ text: question, messageId });
}
