"use client";

import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommand } from "@/systems/command";
import { LiveActivity, useDock } from "@/systems/dock";
import type { ChatStatus } from "ai";
import { History, Sparkles, SquarePen, X } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { AskUIMessage } from "../lib/tools";
import { useAskRequest, useAskSession } from "../lib/use-ask";
import { askStrings } from "../strings";
import { AskComposer } from "./composer";
import { AskHistory } from "./history";
import { AskMessages } from "./messages";
import { AskPlacementControls, useAskDragHandle } from "./placement";

// =============================================================================
// Ask in the Dock: the conversation as a Live Activity, the way iOS keeps a
// call or a timer at the top of the screen while you go on using the phone.
//
// Collapsed, it is a pill that says what the agent is doing ("Thinking…",
// "Searching “PWA”…", then the answer's first words), with the site's glow
// travelling its edge while it works. Expanded, it is the whole chat: the
// conversation or the history, and the composer. The page under it stays
// live, so a visitor can ask, put the panel away, read on, and come back to
// the answer; a link in an answer opens its page and puts the panel back to
// the pill.
//
// This is Ask's top place, and its pill. The command provider says where Ask
// is (`askPlacement`); the Dock says whether its panel is open (`openId`).
// The two are kept in step both ways:
//   - Ask placed at the top opens the panel; placed anywhere else, closes it.
//   - The panel collapsed from the Dock (its chevron, a swipe, a route
//     change) is Ask minimized to the pill; the pill tapped open is Ask
//     placed at the top.
// The pill shows while Ask is minimized, and while a reply is still being
// written after Ask was closed. Beside other activities (the music player)
// it is one more pill in the row, and opening one puts the other away, the
// Dock's rule for every activity.
//
// Loaded the first time Ask is called (../index.ts), with AI Elements and the
// AI SDK client: none of the page's business before that.
// =============================================================================

const ASK_ID = "ask";

/**
 * Wider than a player: an answer is paragraphs, and the composer's model and
 * thinking pickers sit on one line. On a phone, the Dock's usual margins.
 */
const PANEL_WIDTH = "min(92vw, 440px)";

/**
 * The conversation's height: as tall as a reply needs, and never past the
 * visible screen, which a phone's keyboard shortens (`--ask-viewport`, the
 * visual viewport's height). The panel hangs from the top, so a body that
 * ends above the keyboard is a composer that sits on it. Less the panel's own
 * header and grabber and a margin under it.
 */
const BODY_HEIGHT =
  "min(34rem, calc(var(--ask-viewport, 100dvh) - max(env(safe-area-inset-top), 0.5rem) - 6rem))";

const HEADER_BUTTON =
  "pressable inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground";

// ---- What the pill says -----------------------------------------------------

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

// ---- The keyboard's share of the screen -------------------------------------

function subscribeViewport(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  return () => viewport?.removeEventListener("resize", onChange);
}

function viewportHeight() {
  return window.visualViewport?.height ?? window.innerHeight;
}

/** A mouse or a trackpad: focusing the field costs nothing there. */
function finePointer() {
  return window.matchMedia("(pointer: fine)").matches;
}

// ---- The activity -------------------------------------------------------------

export default function AskActivity() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const router = useTransitionRouter();
  const { askPlacement, askPill, askRequest, moveAsk, minimizeAsk, closeAsk } = useCommand();
  const { openId, open, close } = useDock();
  const { messages, status, busy, newChat } = useAskSession();
  const [showHistory, setShowHistory] = useState(false);
  const viewport = useSyncExternalStore(subscribeViewport, viewportHeight, () => 0);
  const handle = useAskDragHandle("top");
  const expanded = openId === ASK_ID;
  const placed = askPlacement === "top";
  // The question is this place's to send only while Ask is here.
  useAskRequest(placed ? askRequest : null);

  // Placed at the top: open the panel. Opening takes two steps: the activity
  // is mounted collapsed first and opened a frame later. A Live Activity that
  // unmounts while open closes the Dock (`registerActivity`), and React's
  // development double-mount unmounts a new one once on arrival, after every
  // effect of that commit has run; opened in the same commit, the panel was
  // closed again before it was ever seen.
  useEffect(() => {
    if (!placed || expanded) return;
    const frame = requestAnimationFrame(() => open(ASK_ID));
    return () => cancelAnimationFrame(frame);
  }, [placed, expanded, open]);

  // Afterwards, each side follows the other, told apart by which one moved:
  //   - the provider moved Ask (`placed` changed): away from the top puts
  //     the panel away (opening is the effect above);
  //   - the Dock moved (`expanded` changed, `placed` did not): a collapse
  //     (its chevron, a swipe, a route change) is a minimize, and the pill
  //     tapped open is Ask placed at the top.
  // Compared with the last pair seen rather than reacted to one at a time:
  // the pill's tap opens the Dock a render before the provider hears of it,
  // and "not placed, but open" in that render is the visitor, not a cue to
  // close.
  const [last, setLast] = useState({ placed, expanded });
  useEffect(() => {
    if (last.placed === placed && last.expanded === expanded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tracking what changed since the last render
    setLast({ placed, expanded });
    if (!expanded) setShowHistory(false);
    if (placed !== last.placed) {
      if (!placed && expanded) close();
      return;
    }
    if (expanded && !placed) moveAsk("top");
    else if (!expanded && placed) minimizeAsk();
  }, [placed, expanded, last, close, moveAsk, minimizeAsk]);

  // Nothing to show unless Ask is here, minimized here, or still writing a
  // reply after it was closed.
  const pill = askPill || (busy && askPlacement === null && messages.length > 0);
  if (!placed && !expanded && !pill) return null;

  const line = lineOf(messages, status, s);

  return (
    <LiveActivity
      id={ASK_ID}
      openLabel={s.openAsk}
      collapseLabel={s.collapse}
      panelWidth={PANEL_WIDTH}
      working={busy}
      // The composer focuses its own field, when it should (below).
      moveFocus={false}
      pill={
        <>
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
            <Sparkles className="h-3.5 w-3.5 text-foreground" />
          </span>
          <span
            className={cn(
              "max-w-[min(13rem,50vw)] truncate",
              line.answer ? "text-xs text-foreground" : TYPE.label,
            )}
          >
            {line.text}
          </span>
        </>
      }
      title={
        // The handle for a drag to the center or the side; the Dock's own
        // swipe leaves it alone.
        <span
          data-base-ui-swipe-ignore=""
          onPointerDown={handle.onPointerDown}
          className={cn("flex min-w-0 flex-1 items-center gap-1.5", handle.className)}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className={cn(TYPE.label, "truncate")}>{showHistory ? s.history : s.ask}</span>
        </span>
      }
      actions={
        <>
          {/* Minimize is the Dock's own chevron here. */}
          <AskPlacementControls current="top" minimize={false} className="mr-0.5" />
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
          <button type="button" onClick={closeAsk} aria-label={s.close} title={s.close} className={HEADER_BUTTON}>
            <X className="h-4 w-4" />
          </button>
        </>
      }
    >
      {/* The conversation scrolls on its own: a drag in it is a scroll, not
          the panel being put away (Base UI's swipe-ignore). The header and
          the grabber are still the handle. */}
      <div
        data-base-ui-swipe-ignore=""
        data-ask-top=""
        className="flex flex-col border-t border-border/50"
        style={
          {
            height: BODY_HEIGHT,
            ...(viewport ? { "--ask-viewport": `${viewport}px` } : {}),
          } as React.CSSProperties
        }
      >
        {showHistory ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <AskHistory onOpen={() => setShowHistory(false)} />
          </div>
        ) : (
          <AskMessages
            onNavigate={(href) => {
              router.push(href);
              // A link to the page already open (an anchor on it) is no
              // route change, so the Dock would not collapse by itself.
              close();
            }}
          />
        )}
        <div className="shrink-0 px-3 pt-1 pb-1.5">
          {/* Focused to write in: always with a mouse, and on a touch screen
              only when there is nothing yet to read, so a tap on the pill
              to see an answer does not raise the keyboard over it. */}
          <AskComposer autoFocus={!messages.length || finePointer()} />
        </div>
      </div>
    </LiveActivity>
  );
}
