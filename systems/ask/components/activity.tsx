"use client";

import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { useCommand } from "@/systems/command";
import { LiveActivity, useDock } from "@/systems/dock";
import { History, Sparkles, SquarePen, X } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useAskConfig } from "../lib/config";
import { askStrings } from "../strings";
import { FadeSlot } from "./lazy-view";
import { AskPlacementControls, useAskDragHandle } from "./placement";
import { AskLoadError, AskSkeleton } from "./skeleton";

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
// The panel is this file, so it can come down the moment Ask is called. The
// conversation (AI Elements, the AI SDK client) loads into it and fades in
// (./activity-body.tsx). The bridge half of that module stays mounted after,
// so the pill still knows a reply is being written once the panel is gone.
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

/** What the pill and the header need from the session, once it has loaded. */
type AskActivitySession = {
  count: number;
  busy: boolean;
  answer: boolean;
  text: string;
  newChat: () => void;
};

type BodyModule = typeof import("./activity-body");

let bodyModule: BodyModule | null = null;
let bodyPending: Promise<BodyModule> | null = null;

function loadBody() {
  if (bodyModule) return Promise.resolve(bodyModule);
  bodyPending ??= import("./activity-body").then((mod) => {
    bodyModule = mod;
    return mod;
  }).catch((error: unknown) => {
    bodyPending = null;
    throw error;
  });
  return bodyPending;
}

function subscribeViewport(onChange: () => void) {
  const viewport = window.visualViewport;
  viewport?.addEventListener("resize", onChange);
  return () => viewport?.removeEventListener("resize", onChange);
}

function viewportHeight() {
  return window.visualViewport?.height ?? window.innerHeight;
}

export function AskActivity() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const { askPlacement, askPill, askRequest, moveAsk, minimizeAsk, closeAsk } = useCommand();
  const { openId, open, close } = useDock();
  const [showHistory, setShowHistory] = useState(false);
  const [session, setSession] = useState<AskActivitySession | null>(null);
  const [body, setBody] = useState<BodyModule | null>(() => bodyModule);
  const [bodyFailed, setBodyFailed] = useState(false);
  const viewport = useSyncExternalStore(subscribeViewport, viewportHeight, () => 0);
  const handle = useAskDragHandle("top");
  const config = useAskConfig();
  const expanded = openId === ASK_ID;
  const placed = askPlacement === "top";
  const onSession = useCallback((next: AskActivitySession) => {
    setSession((prev) =>
      prev &&
      prev.count === next.count &&
      prev.busy === next.busy &&
      prev.answer === next.answer &&
      prev.text === next.text
        ? prev
        : next,
    );
  }, []);

  useEffect(() => {
    if (body) return;
    let live = true;
    loadBody().then((mod) => {
      if (live) setBody(mod);
    }).catch(() => {
      if (live) setBodyFailed(true);
    });
    return () => {
      live = false;
    };
  }, [body]);

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

  const Bridge = body?.AskSessionBridge;
  const View = body?.AskActivityView;
  // Nothing to show unless Ask is here, minimized here, or still writing a
  // reply after it was closed. The bridge stays either way: it is how a
  // reply still being written becomes a pill.
  const show =
    placed ||
    expanded ||
    opening ||
    askPill ||
    (config.backgroundPill && !!session?.busy && askPlacement === null && (session?.count ?? 0) > 0);

  return (
    <>
      {Bridge && <Bridge placed={placed} expanded={expanded} askRequest={askRequest} onSession={onSession} />}
      {show && (
        <LiveActivity
          id={ASK_ID}
          openLabel={s.openAsk}
          collapseLabel={s.collapse}
          panelWidth={PANEL_WIDTH}
          working={session?.busy ?? false}
          // The composer focuses its own field, when it should.
          moveFocus={false}
          pill={
            <>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                <Sparkles className="h-3.5 w-3.5 text-foreground" />
              </span>
              <span
                className={cn(
                  "max-w-[min(13rem,50vw)] truncate",
                  session?.answer ? "text-xs text-foreground" : TYPE.label,
                )}
              >
                {session?.text || s.ask}
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
              {session && session.count > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    session.newChat();
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
            className="flex min-h-0 flex-col border-t border-border/50"
            style={
              {
                height: BODY_HEIGHT,
                ...(viewport ? { "--ask-viewport": `${viewport}px` } : {}),
              } as React.CSSProperties
            }
          >
            <FadeSlot ready={View !== undefined} fallback={bodyFailed ? <AskLoadError /> : <AskSkeleton kind="dock" />}>
              {View && <View showHistory={showHistory} onCloseHistory={() => setShowHistory(false)} />}
            </FadeSlot>
          </div>
        </LiveActivity>
      )}
    </>
  );
}
