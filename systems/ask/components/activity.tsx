"use client";

import { followHref } from "@/lib/follow-href";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommand } from "@/systems/command";
import { LiveActivity, useDock } from "@/systems/dock";
import type { ChatStatus } from "ai";
import { History, Sparkles, SquarePen, X } from "lucide-react";
import { useTransitionRouter } from "next-view-transitions";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useAskConfig } from "../lib/config";
import type { AskUIMessage } from "../lib/tools";
import { useAskContinuity, useAskRequest, useAskSession } from "../lib/use-ask";
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
// written after Ask was closed (where the settings have either: the desk's
// preset does, a phone's has neither, ../lib/config.ts). Beside other activities (the music player)
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
  const config = useAskConfig();
  const expanded = openId === ASK_ID;
  const placed = askPlacement === "top";
  // Opening the panel on another post starts a new chat. The pill does not.
  useAskContinuity(placed && expanded);
  // The question is this place's to send only while Ask is here.
  useAskRequest(placed ? askRequest : null);

  // The provider and the Dock follow each other, told apart by which one
  // moved since the last render:
  //   - the provider moved Ask (`placed` changed): to the top opens the
  //     panel, away from it puts the panel away;
  //   - the Dock moved (`expanded` changed, `placed` did not): a collapse
  //     (its chevron, a swipe, a route change) is a minimize, and the pill
  //     tapped open is Ask placed at the top.
  // Reacting to the pair as it stands instead ("placed but closed: open")
  // fought the visitor: a swipe that collapses the panel leaves exactly that
  // pair for a render, before the minimize lands, and the panel came back.
  // The first render counts as a move of the provider's, so an activity
  // mounted with Ask already at the top opens.
  const [last, setLast] = useState({ placed: false, expanded });
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    if (last.placed === placed && last.expanded === expanded) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tracking what changed since the last render
    setLast({ placed, expanded });
    if (!expanded) setShowHistory(false);
    if (placed !== last.placed) {
      if (placed && !expanded) setOpening(true);
      else if (!placed && expanded) close();
      return;
    }
    if (expanded && !placed) moveAsk("top");
    else if (!expanded && placed) minimizeAsk();
  }, [placed, expanded, last, close, moveAsk, minimizeAsk]);

  // Opening takes a frame: the activity may have just mounted, and a Live
  // Activity that unmounts while open closes the Dock (`registerActivity`);
  // React's development double-mount unmounts a new one once on arrival,
  // after every effect of that commit, so a panel opened in the same commit
  // was closed again before it was ever seen.
  useEffect(() => {
    if (!opening) return;
    const frame = requestAnimationFrame(() => {
      setOpening(false);
      open(ASK_ID);
    });
    return () => cancelAnimationFrame(frame);
  }, [opening, open]);

  // Nothing to show unless Ask is here, minimized here, or still writing a
  // reply after it was closed.
  const pill = askPill || (config.backgroundPill && busy && askPlacement === null && messages.length > 0);
  if (!placed && !expanded && !pill && !opening) return null;

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
        // The handle for a mouse's drag. The panel follows; letting go in the
        // middle makes it the center chat, in the trailing column the side
        // (which stops the press from reaching the drawer). To a finger it
        // is the header, and swiping it up puts the panel back to the pill.
        <span
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
      </div>
    </LiveActivity>
  );
}
