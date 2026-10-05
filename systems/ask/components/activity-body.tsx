"use client";

import { followHref } from "@/lib/follow-href";
import { useLocale } from "@/services";
import { useDock } from "@/systems/dock";
import type { ChatStatus } from "ai";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect } from "react";
import { useAskRequest, useAskSession } from "../lib/use-ask";
import type { AskUIMessage } from "../lib/tools";
import { askStrings } from "../strings";
import { AskComposer } from "./composer";
import { AskHistory } from "./history";
import { AskMessages } from "./messages";

// =============================================================================
// The Dock panel's conversation. Loaded the first time Ask is called: the
// panel itself is already up (activity.tsx), and this fades in over the
// skeleton. It also keeps the session subscribed while the panel is put
// away, so a reply still being written can bring the pill back.
// =============================================================================

/** What the shell's pill and header need from the session, and nothing more. */
export interface AskActivitySession {
  count: number;
  busy: boolean;
  answer: boolean;
  text: string;
  newChat: () => void;
}

/** An answer's Markdown as one line of plain words, for the pill. */
function plain(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s*(?:#+|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The conversation in one line: what the agent is doing while it works (the
 * step it is on), and the answer's first words once it has some. `answer`
 * sets the words in the ink; a status stays on the label's rung.
 */
function lineOf(
  messages: AskUIMessage[],
  status: ChatStatus,
  s: ReturnType<typeof askStrings>,
): { text: string; answer: boolean } {
  const last = messages.at(-1);
  if (status === "error") return { text: s.error, answer: false };
  if (last?.role !== "assistant") {
    const asked = last?.parts.find((p) => p.type === "text")?.text ?? "";
    return { text: status === "ready" ? plain(asked) : s.thinking, answer: false };
  }
  // The newest part that says something: a step under way, or words.
  const part = last.parts.findLast(
    (p) => (p.type === "text" && p.text.trim()) || p.type === "tool-search_site" || p.type === "tool-read",
  );
  if (part?.type === "text") return { text: plain(part.text), answer: true };
  if (part?.type === "tool-search_site") {
    return { text: s.searching(part.input?.query ?? "…"), answer: false };
  }
  if (part?.type === "tool-read") {
    const out = part.state === "output-available" ? part.output : null;
    return { text: s.reading(out && "title" in out ? out.title : (part.input?.id ?? "…")), answer: false };
  }
  return { text: s.thinking, answer: false };
}

export function AskSessionBridge({
  placed,
  askRequest,
  onSession,
}: {
  placed: boolean;
  askRequest: { text: string; n: number } | null;
  onSession: (session: AskActivitySession) => void;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { messages, status, busy, newChat } = useAskSession();
  // The question is this place's to send only while Ask is here.
  useAskRequest(placed ? askRequest : null);
  const line = lineOf(messages, status, s);

  useEffect(() => {
    onSession({ count: messages.length, busy, answer: line.answer, text: line.text, newChat });
  }, [messages.length, busy, line.answer, line.text, newChat, onSession]);

  return null;
}

export function AskActivityView({
  showHistory,
  onCloseHistory,
}: {
  showHistory: boolean;
  onCloseHistory: () => void;
}) {
  const router = useTransitionRouter();
  const { close } = useDock();

  return (
    <>
      {showHistory ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <AskHistory onOpen={onCloseHistory} />
        </div>
      ) : (
        <AskMessages
          onNavigate={(href) => {
            followHref(href, (to) => router.push(to));
            // A link to the page already open (an anchor on it) is no
            // route change, so the Dock would not collapse by itself.
            close();
          }}
        />
      )}
      <div className="shrink-0 px-3 pt-1 pb-1.5">
        {/* Focused to write in, unless on a touch screen there is an
            answer to read (the composer's own rule). */}
        <AskComposer />
      </div>
    </>
  );
}
