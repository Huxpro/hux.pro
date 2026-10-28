"use client";

import { prepareAskChat } from "@/systems/ask/lib/chat";
import { askConfigNow, askPlatformNow, type AskConfig } from "@/systems/ask/lib/config";
import { readJSON, writeJSON } from "@/systems/ask/lib/storage";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
import {
  canUseAskSide,
  INITIAL_COMMAND_ASK_STATE,
  isAskPlacement,
  reduceCommandAsk,
  visibleAskPlacement,
  type AskEntry,
  type AskParkTarget,
  type AskPlacement,
  type AskPlacementProvenance,
} from "./ask-state";

export {
  ASK_PLACEMENTS,
  canUseAskSide,
  isAskPlacement,
  type AskEntry,
  type AskPlacement,
  type AskPlacementProvenance,
} from "./ask-state";

// =============================================================================
// Command System Provider
// Controls the command palette open/close state and mode
//
// It also holds where Ask (systems/ask) is. Ask is one conversation that can
// sit in three places (`AskPlacement`), and be put away into the Dock:
//
//   center  the palette, widened into a chat (the palette's Ask mode)
//   side    a panel docked at the trailing edge, beside the page
//   top     the Dock's panel, hanging from the top of the screen
//   pill    not a place: the conversation minimized to a pill in the Dock
//
// Where it opens is the moment. Asking from the palette (the Ask row, Tab,
// `/` `K`) morphs the card into the center chat, unless Ask is already open
// somewhere else, which then takes the question. A call with nothing typed
// (K, the Ask button) opens beside a page being read, and in the center
// elsewhere. Dragging the header or using its placement menu makes a manual
// choice for this page context; automatic moves yield to it until navigation
// starts a new context. Those are the desk's preset; where each opens, and
// what minimize does, are settings (systems/ask/lib/config.ts), read as each
// call is made.
//
// The center and, on a desk, the dock sit where the palette sits. ⌘K, or `/`
// pressed outside a field, parks Ask out of the way (the side when it fits,
// a pill on a narrower desk, the dock on a phone) and opens the palette, so
// the chat and the command are both available. The side panel already shares
// the screen with the card.
//
// A phone has no room for a side panel, and no use for a palette under a
// conversation: there the center is a bottom drawer of Ask's own (the
// `sheet` surface), and side is the same drawer. Its preset is the drawer
// alone: no pill, and minimize is close.
// =============================================================================

/**
 * Pages read rather than used: Ask opens beside them on a desk (the
 * `onReadingPage` setting), so the page stays in view while you ask about it.
 */
export function isReadingPage(pathname: string): boolean {
  return /^\/(writing|works|prompt|about|docs)(\/|$)/.test(pathname);
}

/**
 * Where a fresh open lands. From the palette, the card morphs into the
 * center chat, even on a page being read. A call on a page to read is the
 * side, so the page stays in view; a saved place does not override that. A
 * call elsewhere follows `fromCall`.
 */
export function askOpenTarget({
  from,
  reading,
  config,
  chosen,
}: {
  from: "search" | "palette" | "call";
  reading: boolean;
  config: Pick<AskConfig, "fromSearch" | "fromCall" | "onReadingPage">;
  chosen?: AskPlacement;
}): AskPlacement {
  if (from !== "call") return config.fromSearch;
  if (reading && config.onReadingPage === "side") return "side";
  if (config.fromCall === "last") return chosen ?? "center";
  return config.fromCall;
}

/**
 * Where Ask steps aside so the palette can take the middle. A roomy desk has
 * the side panel, a narrower desk uses the pill rather than crowding two wide
 * panes, and a phone has no side: the dock sits above the sheet.
 */
export function askParkPlacement(
  platform: "desk" | "phone",
  canSide = typeof window !== "undefined" && canUseAskSide(window.innerWidth),
): AskParkTarget {
  if (platform === "phone") return "top";
  return canSide ? "side" : "pill";
}

/**
 * True when Ask is standing where the palette needs to be: the center, and
 * on a desk the dock (it hangs over the card). The side panel does not.
 */
export function askBlocksCommand(
  placement: AskPlacement | null,
  platform: "desk" | "phone",
): boolean {
  if (placement === "center") return true;
  return placement === "top" && platform === "desk";
}

const ASK_PLACEMENT_KEY = "hux_ask_placement";

/**
 * Where the visitor has put Ask, by hand (a place button, a drop), for each
 * kind of page: pages to read and the rest. Each kind has its own default
 * (beside a page to read, the settings' elsewhere); a choice made by hand is
 * the only thing that overrides it, and only for that kind of page. Opening
 * beside a post is a default, not a choice, so the home keeps its own.
 */
type PageKind = "reading" | "other";
type Chosen = Partial<Record<PageKind, AskPlacement>>;

function readChosen(): Chosen {
  const raw = readJSON(ASK_PLACEMENT_KEY);
  // The old single choice, from before there were two kinds of page.
  if (isAskPlacement(raw)) return { other: raw };
  const v = (raw ?? {}) as Record<string, unknown>;
  return {
    ...(isAskPlacement(v.reading) ? { reading: v.reading } : {}),
    ...(isAskPlacement(v.other) ? { other: v.other } : {}),
  };
}

function writeChosen(kind: PageKind, placement: AskPlacement) {
  writeJSON(ASK_PLACEMENT_KEY, { ...readChosen(), [kind]: placement });
}

/** The kind of the page now, read when Ask is called (not a render input,
 *  so a navigation re-renders nothing here). */
function pageKindNow(): PageKind {
  return isReadingPage(window.location.pathname) ? "reading" : "other";
}

/** Room for a panel beside the page: a desk, as Ask's settings count it. */
function hasRoomBeside(): boolean {
  return typeof window !== "undefined" && canUseAskSide(window.innerWidth);
}

interface CommandContextType {
  isOpen: boolean;
  isSlashCommandsMode: boolean;
  isLoadBundleMode: boolean;
  /** The palette is a conversation (systems/ask) rather than a search. */
  isAskMode: boolean;
  /**
   * The question Ask was opened with, waiting to be sent. A counter with it,
   * as with `voiceRequest`: the chat sends each one once, so asking the same
   * thing twice asks twice.
   */
  askRequest: { text: string; n: number } | null;
  open: (slashCommandsMode?: boolean) => void;
  close: () => void;
  toggle: () => void;
  setSlashCommandsMode: (mode: boolean) => void;
  openLoadBundle: () => void;
  setLoadBundleMode: (mode: boolean) => void;
  /** Where Ask is open, or null when it is closed or only a pill. */
  askPlacement: AskPlacement | null;
  /** Ask has been called at least once: its surfaces may load. */
  askStarted: boolean;
  /** The conversation is minimized to a pill in the Dock. */
  askPill: boolean;
  /**
   * Open Ask, sending `text` if there is any. `from: "search"` (the palette's
   * Ask row, Tab) lands where asking from search goes; `"palette"` (a command
   * in the palette, `/` `K`) and `"call"` (K, the Ask ball) where a call
   * goes; the first two count as reached from the palette.
   */
  openAsk: (text?: string, from?: "search" | "palette" | "call") => void;
  /**
   * Move Ask to another place, the conversation with it. A user-origin move
   * wins over automatic placement for this page; `remember` additionally
   * keeps a menu choice as the configured default for later visits.
   */
  moveAsk: (
    placement: AskPlacement,
    entry?: AskEntry,
    options?: { provenance?: AskPlacementProvenance; remember?: boolean },
  ) => void;
  /** How Ask was reached (see `AskEntry`). */
  askEntry: AskEntry;
  /** Close Ask wherever it is (a reply still being written leaves a pill). */
  closeAsk: () => void;
  /** Put Ask away into the Dock as a pill (where minimize is on; else close). */
  minimizeAsk: () => void;
  /** The palette's Ask mode on and off; off is back to search. */
  setAskMode: (mode: boolean) => void;
  /**
   * Ask the palette's field to start listening (systems/voice). A counter,
   * not a flag: the field starts a session each time it changes, so asking
   * twice asks twice. The `/` `V` command sets it.
   */
  voiceRequest: number;
  /** The key that made the request, while it may still be held: the field
   *  listens for its release (push-to-talk). Null for a press or a click. */
  voiceHoldKey: string | null;
  requestVoice: (holdKey?: string) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export function useCommand() {
  const context = useContext(CommandContext);
  if (!context) throw new Error("useCommand must be used within CommandProvider");
  return context;
}

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [shell, dispatchShell] = useReducer(reduceCommandAsk, INITIAL_COMMAND_ASK_STATE);
  const [askRequest, setAskRequest] = useState<{ text: string; n: number } | null>(null);
  const [voiceRequest, setVoiceRequest] = useState(0);
  const [voiceHoldKey, setVoiceHoldKey] = useState<string | null>(null);

  const isOpen = shell.palette !== "closed";
  const isSlashCommandsMode = shell.palette === "slash";
  const isLoadBundleMode = shell.palette === "bundle";
  const isAskMode = shell.palette === "ask";
  const askPlacement = visibleAskPlacement(shell);
  const { askPill, askStarted, askEntry } = shell;

  const close = useCallback(() => {
    dispatchShell({
      type: "CLOSE_PALETTE",
      platform: askPlatformNow(),
      canSide: hasRoomBeside(),
    });
  }, []);

  const parkAndOpen = useCallback((mode: "search" | "slash" | "bundle") => {
    const placement = visibleAskPlacement(shell);
    const platform = askPlatformNow();
    if (askBlocksCommand(placement, platform)) {
      dispatchShell({
        type: "PARK_AND_OPEN",
        mode,
        target: askParkPlacement(platform, hasRoomBeside()),
        returnTo: placement!,
        entry: shell.askEntry,
      });
      return;
    }
    dispatchShell({ type: "OPEN_PALETTE", mode });
  }, [shell]);

  const open = useCallback((slashCommandsMode = false) => {
    parkAndOpen(slashCommandsMode ? "slash" : "search");
  }, [parkAndOpen]);

  const toggle = useCallback(() => {
    if (shell.palette === "ask") parkAndOpen("search");
    else if (shell.palette !== "closed") close();
    else open(false);
  }, [shell.palette, parkAndOpen, close, open]);

  const setSlashCommandsMode = useCallback((mode: boolean) => {
    dispatchShell({ type: "SET_PALETTE_MODE", mode: mode ? "slash" : "search" });
  }, []);

  const setLoadBundleMode = useCallback((mode: boolean) => {
    dispatchShell({ type: "SET_PALETTE_MODE", mode: mode ? "bundle" : "search" });
  }, []);

  const setAskMode = useCallback((mode: boolean) => {
    dispatchShell({ type: "SET_PALETTE_MODE", mode: mode ? "ask" : "search" });
  }, []);

  const moveAsk = useCallback((
    placement: AskPlacement,
    entry: AskEntry = "direct",
    options: { provenance?: AskPlacementProvenance; remember?: boolean } = {},
  ) => {
    const roomy = hasRoomBeside();
    const target = placement === "side" && !roomy ? "center" : placement;
    const provenance = target === placement
      ? (options.provenance ?? "automatic")
      : "capacity";
    dispatchShell({
      type: "SHOW_ASK",
      placement: target,
      platform: askPlatformNow(),
      entry,
      provenance,
    });
    // Remembered only when the visitor put it there, and it went there: a
    // phone's sheet is not a vote against the side panel on the desk.
    if (options.remember && target === placement) writeChosen(pageKindNow(), target);
  }, []);

  const signalHandoff = useCallback((placement: AskPlacement) => {
    const root = document.documentElement;
    root.dataset.askHandoff = placement;
    window.setTimeout(() => {
      if (root.dataset.askHandoff === placement) delete root.dataset.askHandoff;
    }, 700);
  }, []);

  const openAsk = useCallback(
    (text?: string, from: "search" | "palette" | "call" = "call") => {
      // Another post is a new context, and so a new chat, before the surface
      // shows the previous one (systems/ask/lib/chat-continuity.ts).
      prepareAskChat();
      const question = text?.trim();
      if (question) setAskRequest((prev) => ({ text: question, n: (prev?.n ?? 0) + 1 }));
      const entry: AskEntry = from === "call" ? "direct" : "command";
      if (shell.askSurface) {
        // Already open beside the page, at the top or as a phone's sheet: it
        // takes the question.
        const target = shell.askSurface === "sheet" ? "center" : shell.askSurface;
        moveAsk(target, entry, {
          // A Command parking spot becomes an ordinary automatic handoff;
          // an actual user placement keeps being one.
          provenance: shell.askProvenance === "command-park"
            ? "automatic"
            : shell.askProvenance,
        });
        if (from !== "call") requestAnimationFrame(() => signalHandoff(target));
        return;
      }
      const config = askConfigNow();
      const reading = pageKindNow() === "reading";
      const chosen = readChosen()[reading ? "reading" : "other"];
      const contextual = from === "call" ? shell.manualPlacement ?? undefined : undefined;
      const target = contextual ?? askOpenTarget({ from, reading, config, chosen });
      moveAsk(target, entry, { provenance: contextual ? "user" : "automatic" });
    },
    [shell.askSurface, shell.askProvenance, shell.manualPlacement, moveAsk, signalHandoff]
  );

  const closeAsk = useCallback(() => {
    dispatchShell({ type: "CLOSE_ASK" });
  }, []);

  const minimizeAsk = useCallback(() => {
    // Where nothing is put away into the Dock, minimize is close: the
    // conversation stays the session's either way.
    dispatchShell({
      type: "MINIMIZE_ASK",
      pill: askConfigNow().minimize === "dock",
    });
  }, []);

  // Voice: back to search (the field is where the words go) and listen.
  const requestVoice = useCallback((holdKey?: string) => {
    setVoiceHoldKey(holdKey ?? null);
    parkAndOpen("search");
    setVoiceRequest((n) => n + 1);
  }, [parkAndOpen]);

  const openLoadBundle = useCallback(() => {
    parkAndOpen("bundle");
  }, [parkAndOpen]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const isField = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };

    // Capture: the center chat stops every key but Escape on its way up
    // (chat.tsx), and ⌘K / `/` still have to park it.
    const onCapture = (e: KeyboardEvent) => {
      // K is the one-key Ask call, but never steals a letter from a field or
      // from the command palette. The latter leaves `/ K` to SlashShortcuts.
      if (
        e.key.toLowerCase() === "k" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey &&
        !isField(e.target) &&
        (!isOpen || isAskMode)
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (askPlacement) closeAsk();
        else openAsk();
        return;
      }

      // ⌘K toggles the palette. When Ask is standing where the card goes, it
      // steps aside first (the side on a desk, the dock on a phone) and the
      // palette opens in front of it: the chat and the command, both up.
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        toggle();
        return;
      }

      // "/" outside a field opens the slash list. The same yield as ⌘K when
      // Ask is in the palette's place, so the list and the chat both show.
      // In a field (the composer, the palette's own) it is a character.
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isField(e.target)) {
        if (!isOpen || askBlocksCommand(askPlacement, askPlatformNow())) {
          e.preventDefault();
          e.stopPropagation();
          open(true);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: load-bundle or Ask → back to search; otherwise close.
      // The branch is the desktop popover's: there the panel replaces the
      // card's body in place, so there is no dialog to pop and the field's own
      // Escape handler only fires while the field has focus. On a phone
      // load-bundle is a nested sheet and Base UI's dialog pops it itself.
      // An Escape something inside already handled (Ask's message editor,
      // cancelling) is not the palette's: React's listener is on the
      // document too, so stopping propagation does not hold this one back.
      if (e.key === "Escape" && isOpen && !e.defaultPrevented) {
        if (isLoadBundleMode) {
          e.preventDefault();
          setLoadBundleMode(false);
          return;
        }
        if (isAskMode) {
          e.preventDefault();
          // Back to search only if search was the way in.
          if (askEntry === "command") setAskMode(false);
          else close();
          return;
        }
        // Handled: a surface under the palette (the About) leaves this one.
        e.preventDefault();
        close();
        return;
      }
    };

    document.addEventListener("keydown", onCapture, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", onCapture, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isLoadBundleMode, isAskMode, askEntry, askPlacement, toggle, close, open, openAsk, closeAsk, moveAsk, setLoadBundleMode, setAskMode]);

  // A route change is an event in the shell state machine, not a state update
  // during render. It also commits a temporary Command parking decision: the
  // chat must not jump back over a different page when the palette closes.
  const seenPath = useRef(pathname);
  useEffect(() => {
    if (seenPath.current === pathname) return;
    seenPath.current = pathname;
    dispatchShell({
      type: "NAVIGATE",
      reading: isReadingPage(pathname),
      platform: askPlatformNow(),
      canSide: hasRoomBeside(),
    });
  }, [pathname]);

  // Capacity, not the phone breakpoint, decides whether the 440px panel can
  // coexist with a reading column or command card. A resized split view moves
  // an open side chat to the center (or its pill while Command owns center).
  useEffect(() => {
    const onResize = () => dispatchShell({
      type: "VIEWPORT",
      platform: askPlatformNow(),
      canSide: hasRoomBeside(),
    });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <CommandContext.Provider
      value={{
        isOpen,
        isSlashCommandsMode,
        isLoadBundleMode,
        isAskMode,
        askRequest,
        askPlacement,
        askStarted,
        askPill,
        open,
        close,
        toggle,
        setSlashCommandsMode,
        openLoadBundle,
        setLoadBundleMode,
        openAsk,
        moveAsk,
        askEntry,
        closeAsk,
        minimizeAsk,
        setAskMode,
        voiceRequest,
        voiceHoldKey,
        requestVoice,
      }}
    >
      {children}
    </CommandContext.Provider>
  );
}
