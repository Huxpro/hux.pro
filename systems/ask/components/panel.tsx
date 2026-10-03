"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { HEADER_BUTTON, SurfaceBody } from "@/systems/surface";
import { Drawer } from "@base-ui/react/drawer";
import { History, Sparkles, SquarePen } from "lucide-react";
import { useState } from "react";
import { useAskRequest, useAskSession } from "../lib/use-ask";
import { askStrings } from "../strings";
import { AskComposer } from "./composer";
import { AskHistory } from "./history";
import { AskMessages } from "./messages";

// =============================================================================
// What Ask's panel holds: a title bar (history, new chat, close), the
// conversation, the composer. Assembled from the pieces every Ask surface uses
// (./messages, ./composer, ./history) inside the surface system's own chrome
// (SurfaceBody), so the panel reads as the same object as the playlist or the
// wallpaper picker. The state is the session's (../lib/chat), so closing the
// panel and opening it again, or navigating under it, keeps the conversation.
//
// The shell (../surface.tsx) loads this lazily, the first time Ask opens.
// =============================================================================

export interface AskPanelProps {
  /** A question to send on arrival, from the palette's field. */
  request: { text: string; n: number } | null;
  onClose: () => void;
  /** A link to a page on this site was followed. */
  onNavigate: (href: string) => void;
}

/** A header button that stays lit while the view it opens is showing. */
const TOGGLE = "aria-pressed:bg-accent/60 aria-pressed:text-foreground";

export default function AskPanel({ request, onClose, onNavigate }: AskPanelProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { messages, newChat } = useAskSession();
  const [showHistory, setShowHistory] = useState(false);
  useAskRequest(request);

  // A question handed over while the history is up is a question to watch
  // being answered: back to the conversation.
  const [seen, setSeen] = useState(request?.n);
  if (request?.n !== seen) {
    setSeen(request?.n);
    setShowHistory(false);
  }

  return (
    <SurfaceBody
      title={
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 shrink-0" />
          {showHistory ? s.history : s.ask}
        </span>
      }
      titleAs={Drawer.Title}
      actions={
        <>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-label={s.history}
            aria-pressed={showHistory}
            title={s.history}
            className={cn(HEADER_BUTTON, TOGGLE)}
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
        </>
      }
      closeLabel={s.close}
      onClose={onClose}
      // The conversation scrolls itself (it sticks to the bottom as a reply
      // streams in), so the body is a column, not a scroll area.
      contentClassName="flex min-h-0 flex-col overflow-hidden"
      footer={
        <div className="p-2 pt-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <AskComposer />
        </div>
      }
    >
      {showHistory ? (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <AskHistory onOpen={() => setShowHistory(false)} />
        </div>
      ) : (
        <AskMessages onNavigate={onNavigate} />
      )}
    </SurfaceBody>
  );
}
