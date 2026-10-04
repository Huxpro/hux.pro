"use client";

import type { AskEffort } from "./models";
import type { AskUIMessage } from "./tools";

// =============================================================================
// Past conversations, kept in this browser.
//
// A per-viewer convenience, so localStorage: nobody else sees them, they do
// not follow the viewer to another device, and they may be gone (a private
// window, cleared site data). Everything here survives storage failing; the
// list is then just this page's.
//
// Read results are trimmed before they are stored: a `read` can return
// twelve thousand characters, and the model can read it again if a resumed
// conversation needs it. The newest MAX_CONVERSATIONS are kept.
// =============================================================================

/** What a conversation runs on: its own, kept with it. */
export interface AskSettings {
  model: string;
  effort: AskEffort;
}

export interface AskConversation extends Partial<AskSettings> {
  id: string;
  title: string;
  updatedAt: number;
  messages: AskUIMessage[];
}

const KEY = "hux_ask_history";
const MAX_CONVERSATIONS = 30;
const MAX_STORED_READ = 600;

let conversations: AskConversation[] | null = null;
const listeners = new Set<() => void>();

function load(): AskConversation[] {
  if (conversations) return conversations;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as AskConversation[]) : [];
    conversations = Array.isArray(parsed) ? parsed : [];
  } catch {
    conversations = [];
  }
  return conversations;
}

function commit(next: AskConversation[]) {
  conversations = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Full or unavailable: keep the list for this page only.
  }
  listeners.forEach((l) => l());
}

/** The first thing asked, on one line: what the conversation is called. */
function titleOf(messages: AskUIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ") ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, 80) || "…";
}

function trimmed(messages: AskUIMessage[]): AskUIMessage[] {
  return messages.map((m) => ({
    ...m,
    parts: m.parts.map((p) => {
      if (p.type !== "tool-read" || p.state !== "output-available" || !("text" in p.output)) return p;
      const { text } = p.output;
      if (text.length <= MAX_STORED_READ) return p;
      return { ...p, output: { ...p.output, text: text.slice(0, MAX_STORED_READ), truncated: true } };
    }),
  }));
}

/** Save a conversation; without `settings`, it keeps the ones it had. */
export function saveConversation(id: string, messages: AskUIMessage[], settings?: AskSettings) {
  if (!messages.some((m) => m.role === "user")) return;
  const previous = load().find((c) => c.id === id);
  const rest = load().filter((c) => c.id !== id);
  const entry: AskConversation = {
    id,
    title: titleOf(messages),
    updatedAt: Date.now(),
    messages: trimmed(messages),
    model: settings?.model ?? previous?.model,
    effort: settings?.effort ?? previous?.effort,
  };
  commit([entry, ...rest].slice(0, MAX_CONVERSATIONS));
}

export function getConversation(id: string): AskConversation | undefined {
  return load().find((c) => c.id === id);
}

export function deleteConversation(id: string) {
  commit(load().filter((c) => c.id !== id));
}

export function clearConversations() {
  commit([]);
}

// For useSyncExternalStore: newest first, the same array until it changes.
export function subscribeConversations(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConversationsSnapshot(): AskConversation[] {
  return load();
}

const EMPTY: AskConversation[] = [];
export function getConversationsServerSnapshot(): AskConversation[] {
  return EMPTY;
}
