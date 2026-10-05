"use client";

import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { ChevronLeft, History, PanelLeft, SquarePen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAskHistory, useAskRequest, useAskSession } from "../lib/use-ask";
import { askStrings } from "../strings";
import { AskComposer } from "./composer";
import { AskHistory } from "./history";
import { AskMessages } from "./messages";
import { AskPlacementControls, useAskDragHandle } from "./placement";

// =============================================================================
// Ask in the command palette: a header (back to search, history, new chat),
// the conversation, the composer. Assembled from the pieces every Ask surface
// uses (./messages, ./composer, ./history); the state is the session's
// (../lib/chat), so the conversation is the same one any other surface shows.
//
// The palette (systems/command/popover.tsx) loads this lazily, the
// first time Ask opens.
//
// It opens the size of the palette it came from, the command card turned
// into a chat. The sidebar button (from `sm` up) opens the past
// conversations beside it, and the shell widens the card for them: a chat
// app with its history in view (`railOpen`, the shell's state). Below `sm`
// (the popover at a phone's width) the clock shows the history in turn, as
// the phone sheet always has it.
//
// Back to search is there only when search was the way in (`onBack`); Ask
// reached directly has no search behind it.
//
// This is Ask's center place. Its headers drag the window: let go in the
// middle and it stays, up in the top band and it docks, in the trailing
// column and it becomes the side panel (./placement).
// =============================================================================

export interface AskChatProps {
  /** A question to send on arrival, from the palette's field. */
  request: { text: string; n: number } | null;
  /** Back to search; absent when Ask was not reached from it. */
  onBack?: () => void;
  /** A link to a page on this site was followed. */
  onNavigate: (href: string) => void;
  /** The shell's own controls at the end of the header (a close button). */
  trailing?: ReactNode;
  /** The history sidebar is open (from `sm` up). */
  railOpen: boolean;
  /** Open or close the history sidebar. */
  onToggleRail: () => void;
  className?: string;
}

const HEADER_BUTTON =
  "pressable flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground";

// Both headers, the rail's and the conversation's, are this row: one height,
// so they meet in a single line across the card.
const HEADER_ROW = "relative flex h-11 shrink-0 items-center gap-1 border-b border-border/50 px-2";

export default function AskChat({
  request,
  onBack,
  onNavigate,
  trailing,
  railOpen: rail,
  onToggleRail,
  className,
}: AskChatProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { messages, chat, newChat } = useAskSession();
  const { conversations } = useAskHistory();
  const [showHistory, setShowHistory] = useState(false);
  useAskRequest(request);
  const handle = useAskDragHandle("center");

  // Beside the rail the header names the conversation, as a chat app's
  // title bar does; the rail already says it is Ask.
  const title = conversations.find((c) => c.id === chat.id)?.title;
  // What the rail takes over from `sm` up: back, the clock, ✎.
  const railed = rail && "sm:hidden";
  // The sidebar button, from `sm` up; the clock stands in for it below.
  const sidebar = (
    <button
      type="button"
      onClick={onToggleRail}
      aria-label={s.sidebar}
      aria-pressed={rail}
      title={s.sidebar}
      className={cn(HEADER_BUTTON, "hidden sm:flex")}
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
  const back = onBack && (
    <button type="button" onClick={onBack} aria-label={s.backToSearch} title={s.backToSearch} className={HEADER_BUTTON}>
      <ChevronLeft className="h-4 w-4" />
    </button>
  );

  return (
    // The chat sits inside the palette's cmdk root, which takes ↑ ↓ ↵ Home
    // End for its list. In here they belong to the text: only Escape (back
    // to search, handled by the palette) goes on up.
    <div
      data-ask-center=""
      className={cn("flex min-h-0", className)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") e.stopPropagation();
      }}
    >
      {rail && (
        <aside className="hidden w-60 shrink-0 flex-col border-r border-border/50 bg-muted sm:flex">
          <div {...handle.dataAttrs} onPointerDown={handle.onPointerDown} className={cn(HEADER_ROW, handle.className)}>
            {sidebar}
            {back}
            <span className="flex-1 px-1 font-sans text-sm font-medium text-muted-foreground">{s.ask}</span>
          </div>
          <div className="shrink-0 px-2 pt-2">
            <button
              type="button"
              onClick={newChat}
              disabled={messages.length === 0}
              className={cn(
                "pressable flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                "hover:bg-accent/40 disabled:pointer-events-none disabled:text-muted-foreground",
              )}
            >
              <SquarePen className="size-4 shrink-0 text-muted-foreground" />
              {s.newChat}
            </button>
          </div>
          <p className={cn(TYPE.label, "shrink-0 px-5 pt-4 pb-1")}>{s.history}</p>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <AskHistory dense className="pt-0" />
          </div>
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div {...handle.dataAttrs} onPointerDown={handle.onPointerDown} className={cn(HEADER_ROW, handle.className)}>
          {!rail && sidebar}
          {back && <span className={cn("contents", railed)}>{back}</span>}
          <span className={cn("flex-1 px-1 font-sans text-sm font-medium text-muted-foreground", railed)}>
            {showHistory ? s.history : s.ask}
          </span>
          {rail && (
            <span className="hidden min-w-0 flex-1 truncate px-2 font-sans text-sm font-medium sm:block">
              {title ?? s.newChat}
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            aria-label={s.history}
            aria-pressed={showHistory}
            title={s.history}
            className={cn(HEADER_BUTTON, "sm:hidden")}
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
              className={cn(HEADER_BUTTON, railed)}
            >
              <SquarePen className="h-4 w-4" />
            </button>
          )}
          <AskPlacementControls current="center" className="mx-1" />
          {trailing}
        </div>

        {/* The clock's view; with the rail in view (from `sm` up) it never
            takes the messages' place. */}
        {showHistory && (
          <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", railed)}>
            <AskHistory onOpen={() => setShowHistory(false)} />
          </div>
        )}
        <AskMessages onNavigate={onNavigate} className={cn(showHistory && "hidden", showHistory && rail && "sm:block")} />

        <div className="shrink-0 p-2 pt-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <AskComposer />
        </div>
      </div>
    </div>
  );
}
