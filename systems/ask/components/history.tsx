"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { LoaderCircle, MessageSquare, X } from "lucide-react";
import { useAskHistory, useAskRunning, useAskSession } from "../lib/use-ask";
import { askStrings } from "../strings";

// =============================================================================
// Past conversations (kept in this browser, ./lib/history.ts): pick one to
// make it current, or delete it. A conversation still being answered (in the
// background, see ../lib/chat.ts) turns its icon into a spinner. One piece of
// every surface that shows Ask;
// where it sits (a view in place of the messages, a sidebar, a menu) is the
// surface's call.
// =============================================================================

function when(at: number, locale: string): string {
  const d = new Date(at);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export interface AskHistoryProps {
  /** A conversation was picked (after it became current). */
  onOpen?: () => void;
  /** A sidebar's rows: the title alone, its time left to the full list. */
  dense?: boolean;
  className?: string;
}

export function AskHistory({ onOpen, dense = false, className }: AskHistoryProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { conversations, deleteConversation } = useAskHistory();
  const { chat, openConversation } = useAskSession();
  const running = useAskRunning();

  if (!conversations.length) {
    return (
      <p
        className={cn(
          dense ? "px-5 py-2 text-xs text-tertiary-foreground" : "px-4 py-6 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {s.noHistory}
      </p>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-0.5 p-2", className)} aria-label={s.history}>
      {conversations.map((c) => (
        <li key={c.id} className="group/row relative">
          <button
            type="button"
            onClick={() => {
              openConversation(c.id);
              onOpen?.();
            }}
            aria-current={c.id === chat.id || undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 pr-9 text-left text-sm transition-colors",
              "hover:bg-accent/40 aria-[current]:bg-accent/50",
              // Beside the conversation it names, the current row has to
              // read as the selection, not as a hover that stayed.
              dense && "aria-[current]:bg-accent aria-[current]:font-medium",
            )}
          >
            {running.has(c.id) ? (
              <LoaderCircle aria-label={s.thinking} className="size-4 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate">{c.title}</span>
            {!dense && <span className="shrink-0 text-xs text-tertiary-foreground">{when(c.updatedAt, locale)}</span>}
          </button>
          <button
            type="button"
            onClick={() => deleteConversation(c.id)}
            aria-label={s.deleteChat}
            title={s.deleteChat}
            className={cn(
              "absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md",
              "text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground",
              "group-hover/row:opacity-100 focus-visible:opacity-100",
            )}
          >
            <X className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
