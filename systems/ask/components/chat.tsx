"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { ChevronLeft, History, SquarePen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAskRequest, useAskSession } from "../lib/use-ask";
import { askStrings } from "../strings";
import { AskComposer } from "./composer";
import { AskHistory } from "./history";
import { AskMessages } from "./messages";

// =============================================================================
// Ask in the command palette: a header (back to search, history, new chat),
// the conversation, the composer. Assembled from the pieces every Ask surface
// uses (./messages, ./composer, ./history); the state is the session's
// (../lib/chat), so the conversation is the same one any other surface shows.
//
// The shells (systems/command/popover.tsx, sheet.tsx) load this lazily, the
// first time Ask opens.
// =============================================================================

export interface AskChatProps {
  /** A question to send on arrival, from the palette's field. */
  request: { text: string; n: number } | null;
  onBack: () => void;
  /** A link to a page on this site was followed. */
  onNavigate: (href: string) => void;
  /** The shell's own controls at the end of the header (a close button). */
  trailing?: ReactNode;
  className?: string;
}

const HEADER_BUTTON =
  "pressable flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground";

export default function AskChat({ request, onBack, onNavigate, trailing, className }: AskChatProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { messages, newChat } = useAskSession();
  const [showHistory, setShowHistory] = useState(false);
  useAskRequest(request);

  return (
    // The chat sits inside the palette's cmdk root, which takes ↑ ↓ ↵ Home
    // End for its list. In here they belong to the text: only Escape (back
    // to search, handled by the palette) goes on up.
    <div
      className={cn("flex min-h-0 flex-col", className)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") e.stopPropagation();
      }}
    >
      <div className="relative flex shrink-0 items-center gap-1 border-b border-border/50 px-2 py-1.5">
        <button
          type="button"
          onClick={onBack}
          aria-label={s.backToSearch}
          title={s.backToSearch}
          className={HEADER_BUTTON}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="flex-1 px-1 font-sans text-sm font-medium text-muted-foreground">
          {showHistory ? s.history : s.ask}
        </span>
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          aria-label={s.history}
          aria-pressed={showHistory}
          title={s.history}
          className={HEADER_BUTTON}
        >
          <History className="h-4 w-4" />
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              newChat();
              setShowHistory(false);
            }}
            aria-label={s.newChat}
            title={s.newChat}
            className={HEADER_BUTTON}
          >
            <SquarePen className="h-4 w-4" />
          </button>
        )}
        {trailing}
      </div>

      {showHistory ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <AskHistory onOpen={() => setShowHistory(false)} />
        </div>
      ) : (
        <AskMessages onNavigate={onNavigate} />
      )}

      <div className="shrink-0 p-2 pt-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <AskComposer />
      </div>
    </div>
  );
}
