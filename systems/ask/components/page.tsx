"use client";

import { TITLE_POETIC } from "@/components/ui/header-zone";
import { SystemNav } from "@/components/ui/system-nav";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useInputCapability, useLocale } from "@/services";
import { HEADER_BUTTON, SHEET_DETENTS, SurfaceBody, SurfaceSheet } from "@/systems/surface";
import { ArrowUpRight, History, SquarePen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAskHistory, useAskRequest, useAskSession } from "../lib/use-ask";
import { askStrings } from "../strings";
import { AskComposer } from "./composer";
import { AskHistory } from "./history";
import { AskMessages } from "./messages";

// =============================================================================
// Ask as a page of its own, /ask: the app the Personal OS has for talking to
// it. Assembled from the pieces every Ask surface uses (./messages,
// ./composer, ./history); the state is the session's (../lib/chat), so this
// is the same conversation wherever else it shows.
//
//   desktop   history in a glass sidebar on the left, new chat on top; the
//             conversation in the site's reading column, the composer pinned
//             under it
//   phone     one column; history in a sheet behind the header's clock
//
// The palette hands questions here (`/ask?q=…`, systems/command/provider.tsx);
// app/ask/view.tsx reads the address and loads this lazily.
// =============================================================================

export interface AskPageProps {
  /** A question from the address (`/ask?q=…`), to send on arrival. */
  question: string | null;
  /** The question has been taken: the address can drop it. */
  onQuestionTaken: () => void;
  /** A link to a page on this site was followed. */
  onNavigate: (href: string) => void;
}

/** Below Tailwind's `md`, where the sidebar gives way to the sheet. */
const COMPACT_QUERY = "(max-width: 767px)";

/** Questions taken from the address, counted across visits: useAskRequest
 *  sends each number once, and remembers the last one past an unmount. */
let arrivals = 0;

/** A row in the sidebar or the sheet: new chat, above the conversations. */
const ROW =
  "pressable flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent/40 active:bg-accent/60";

/** The empty page: what Hux asks first, and some questions to start from. */
function Welcome() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { send } = useAskSession();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
      <div className="mx-auto my-auto w-full max-w-[var(--page-col)] px-[var(--page-gutter)] py-10">
        <h1 className={cn(TITLE_POETIC, "text-foreground")}>{s.welcome}</h1>
        <p className={cn(TYPE.body, "mt-3 max-w-md")}>{s.emptyHint}</p>
        <ul className="-mx-3 mt-8 flex flex-col gap-0.5">
          {s.suggestions.map((q) => (
            <li key={q}>
              <button
                type="button"
                onClick={() => send(q)}
                className={cn(ROW, "group/suggestion justify-between py-2.5 text-reading-foreground")}
              >
                <span className="min-w-0">{q}</span>
                <ArrowUpRight className="size-4 shrink-0 text-tertiary-foreground transition-colors group-hover/suggestion:text-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** New chat, then the conversations: the sidebar's body and the sheet's. */
function HistoryList({ onDone }: { onDone?: () => void }) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { messages, newChat } = useAskSession();
  const { conversations } = useAskHistory();
  return (
    <>
      <div className="px-2">
        <button
          type="button"
          onClick={() => {
            // An empty conversation is already a new one.
            if (messages.length) newChat();
            onDone?.();
          }}
          className={ROW}
        >
          <SquarePen className="size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">{s.newChat}</span>
        </button>
      </div>
      <p className={cn(TYPE.label, "px-5 pb-1 pt-4")}>{s.history}</p>
      {conversations.length ? (
        <AskHistory onOpen={onDone} className="pt-0" />
      ) : (
        // A line under the label, rather than the list's centred placeholder.
        <p className={cn(TYPE.caption, "px-5 py-1")}>{s.noHistory}</p>
      )}
    </>
  );
}

export default function AskPage({ question, onQuestionTaken, onNavigate }: AskPageProps) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { chat, messages, newChat } = useAskSession();
  const { conversations } = useAskHistory();
  const compact = useMediaQuery(COMPACT_QUERY);
  // A keyboard is there to type with; a phone's would cover the welcome.
  const { hasFineHoverPointer } = useInputCapability();
  const [historyOpen, setHistoryOpen] = useState(false);
  const columnRef = useRef<HTMLDivElement>(null);

  // A question in the address is asked once, then taken off it, so a reload
  // or a shared link of the conversation does not ask it again.
  const [request, setRequest] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    const text = question?.trim();
    if (!text) return;
    setRequest({ text, n: ++arrivals });
    onQuestionTaken();
  }, [question, onQuestionTaken]);
  useAskRequest(request);

  // ⌘J on this page means the field (the provider leaves it to us here).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "j") return;
      columnRef.current?.querySelector("textarea")?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const title = conversations.find((c) => c.id === chat.id)?.title;

  return (
    <div className="flex h-dvh w-full">
      <aside className="hidden w-72 shrink-0 p-3 pr-0 md:flex lg:w-80" aria-label={s.history}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/50 bg-glass shadow-raised backdrop-blur-xl">
          <div className="flex h-14 shrink-0 items-center px-5">
            <SystemNav href="/" path="λhux" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            <HistoryList />
          </div>
        </div>
      </aside>

      <main ref={columnRef} className="relative flex min-w-0 flex-1 flex-col">
        {/* Phone: the way home, what this conversation is, and its history. */}
        <header className="flex h-14 shrink-0 items-center gap-1 px-[var(--page-gutter)] md:hidden">
          <SystemNav href="/" path="λhux" />
          <span className={cn(TYPE.label, "min-w-0 flex-1 truncate px-2 text-center")}>
            {messages.length ? (title ?? s.ask) : s.ask}
          </span>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label={s.history}
            title={s.history}
            className={HEADER_BUTTON}
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => newChat()}
            disabled={!messages.length}
            aria-label={s.newChat}
            title={s.newChat}
            className={cn(HEADER_BUTTON, "-mr-2 disabled:opacity-40")}
          >
            <SquarePen className="h-4 w-4" />
          </button>
        </header>

        {messages.length === 0 ? (
          <Welcome />
        ) : (
          <AskMessages
            onNavigate={onNavigate}
            contentClassName="mx-auto w-full max-w-[var(--page-col)] gap-8 px-[var(--page-gutter)] pt-4 pb-8 md:pt-12"
          />
        )}

        <div className="mx-auto w-full max-w-[var(--page-col)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-[var(--page-gutter)] md:pb-6">
          {/* Glass under the field's own border, so the page shows through
              the composer the way it does through the palette. */}
          <div className="rounded-xl bg-glass-popover shadow-raised backdrop-blur-xl">
            <AskComposer autoFocus={hasFineHoverPointer} />
          </div>
        </div>
      </main>

      <SurfaceSheet
        id="ask-history"
        open={historyOpen && compact}
        onOpenChange={setHistoryOpen}
        snapPoints={SHEET_DETENTS}
        label={s.history}
      >
        <SurfaceBody
          title={s.ask}
          closeLabel={s.close}
          onClose={() => setHistoryOpen(false)}
          contentClassName="pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          <HistoryList onDone={() => setHistoryOpen(false)} />
        </SurfaceBody>
      </SurfaceSheet>
    </div>
  );
}
