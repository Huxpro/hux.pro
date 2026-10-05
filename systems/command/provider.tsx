"use client";

import { prepareAskChat } from "@/systems/ask/lib/chat";
import { askConfigNow, askPlatformNow, type AskConfig } from "@/systems/ask/lib/config";
import { readJSON, writeJSON } from "@/systems/ask/lib/storage";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

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
// `/` `J`) morphs the card into the center chat, unless Ask is already open
// somewhere else, which then takes the question. A call with nothing typed
// (⌘J, the Ask button) opens beside a page being read, and in the center
// elsewhere. Dragging the header moves it for this visit; it is not a choice
// that sticks. Those are the desk's preset; where each opens, and what
// minimize does, are settings (systems/ask/lib/config.ts), read as each call
// is made.
//
// The center and, on a desk, the dock sit where the palette sits. ⌘K, or `/`
// pressed outside a field, parks Ask out of the way (the side on a desk, the
// dock on a phone) and opens the palette, so the chat and the command are
// both up. The side panel already shares the screen with the card.
//
// A phone has no room for a side panel, and no use for a palette under a
// conversation: there the center is a bottom drawer of Ask's own (the
// `sheet` surface), and side is the same drawer. Its preset is the drawer
// alone: no pill, and minimize is close.
// =============================================================================

/** Ask's places (see the note at the top). */
export const ASK_PLACEMENTS = ["center", "side", "top"] as const;
export type AskPlacement = (typeof ASK_PLACEMENTS)[number];

/**
 * How Ask was reached: from inside the palette (its Ask row, Tab, `/` `J`),
 * or directly (⌘J, the Ask ball, a move from another place). It decides what
 * leaving the center does: back to search when the palette was the way in,
 * closed altogether when it was not, since there is no search to go back to.
 */
export type AskEntry = "command" | "direct";

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
 * Where Ask steps aside so the palette can take the middle. A desk has the
 * side panel, which shares the screen with the card. A phone has no side:
 * the dock, above the sheet.
 */
export function askParkPlacement(platform: "desk" | "phone"): AskPlacement {
  return platform === "desk" ? "side" : "top";
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

export function isAskPlacement(value: unknown): value is AskPlacement {
  return (ASK_PLACEMENTS as readonly unknown[]).includes(value);
}

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
  return typeof window !== "undefined" && askPlatformNow() === "desk";
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
   * in the palette, `/` `J`) and `"call"` (⌘J, the Ask ball) where a call
   * goes; the first two count as reached from the palette.
   */
  openAsk: (text?: string, from?: "search" | "palette" | "call") => void;
  /**
   * Move Ask to another place, the conversation with it. `chosen`: the
   * visitor put it there with a place button (when those are on), which is
   * remembered for a call on a page that is not being read. A drag is not
   * one: the next open follows the moment again.
   */
  moveAsk: (placement: AskPlacement, entry?: AskEntry, chosen?: boolean) => void;
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
  const [isOpen, setIsOpen] = useState(false);
  const [isSlashCommandsMode, setIsSlashCommandsMode] = useState(false);
  const [isLoadBundleMode, setIsLoadBundleMode] = useState(false);
  const [isAskMode, setIsAskMode] = useState(false);
  const [askRequest, setAskRequest] = useState<{ text: string; n: number } | null>(null);
  const [askSurface, setAskSurface] = useState<"side" | "top" | "sheet" | null>(null);
  const [askPill, setAskPill] = useState(false);
  const [askStarted, setAskStarted] = useState(false);
  const [askEntry, setAskEntry] = useState<AskEntry>("direct");
  const [voiceRequest, setVoiceRequest] = useState(0);
  const [voiceHoldKey, setVoiceHoldKey] = useState<string | null>(null);

  const open = useCallback((slashCommandsMode = false) => {
    setIsOpen(true);
    setIsSlashCommandsMode(slashCommandsMode);
    setIsLoadBundleMode(false);
    setIsAskMode(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
    setIsAskMode(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setIsSlashCommandsMode(false);
        setIsLoadBundleMode(false);
        setIsAskMode(false);
      }
      return !prev;
    });
  }, []);

  const setSlashCommandsMode = useCallback((mode: boolean) => {
    setIsSlashCommandsMode(mode);
    if (mode) {
      setIsLoadBundleMode(false);
      setIsAskMode(false);
    }
  }, []);

  const setLoadBundleMode = useCallback((mode: boolean) => {
    setIsLoadBundleMode(mode);
    if (mode) {
      setIsSlashCommandsMode(false);
      setIsAskMode(false);
    }
  }, []);

  const setAskMode = useCallback((mode: boolean) => {
    setIsAskMode(mode);
    if (mode) {
      setIsSlashCommandsMode(false);
      setIsLoadBundleMode(false);
    }
  }, []);

  const askPlacement: AskPlacement | null =
    isOpen && isAskMode ? "center" : askSurface === "sheet" ? "center" : askSurface;

  const moveAsk = useCallback((placement: AskPlacement, entry: AskEntry = "direct", chosen = false) => {
    const roomy = hasRoomBeside();
    setAskEntry(entry);
    const target = placement === "side" && !roomy ? "center" : placement;
    setAskStarted(true);
    setAskPill(false);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
    if (target === "center" && roomy) {
      setAskSurface(null);
      setIsOpen(true);
      setIsAskMode(true);
    } else if (target === "center") {
      setIsOpen(false);
      setIsAskMode(false);
      setAskSurface("sheet");
    } else {
      setIsOpen(false);
      setIsAskMode(false);
      setAskSurface(target);
    }
    // Remembered only when the visitor put it there, and it went there: a
    // phone's sheet is not a vote against the side panel on the desk.
    if (chosen && target === placement) writeChosen(pageKindNow(), target);
  }, []);

  const openAsk = useCallback(
    (text?: string, from: "search" | "palette" | "call" = "call") => {
      // Another post is a new context, and so a new chat, before the surface
      // shows the previous one (systems/ask/lib/chat-continuity.ts).
      prepareAskChat();
      const question = text?.trim();
      if (question) setAskRequest((prev) => ({ text: question, n: (prev?.n ?? 0) + 1 }));
      const entry: AskEntry = from === "call" ? "direct" : "command";
      if (askSurface) {
        // Already open beside the page, at the top or as a phone's sheet: it
        // takes the question.
        moveAsk(askSurface === "sheet" ? "center" : askSurface, entry);
        return;
      }
      const config = askConfigNow();
      const reading = pageKindNow() === "reading";
      const chosen = readChosen()[reading ? "reading" : "other"];
      const target = askOpenTarget({ from, reading, config, chosen });
      moveAsk(target, entry);
    },
    [askSurface, moveAsk]
  );

  const closeAsk = useCallback(() => {
    setAskSurface(null);
    setAskPill(false);
    if (isAskMode) {
      setIsOpen(false);
      setIsAskMode(false);
    }
  }, [isAskMode]);

  const minimizeAsk = useCallback(() => {
    closeAsk();
    // Where nothing is put away into the Dock, minimize is close: the
    // conversation stays the session's either way.
    if (askConfigNow().minimize === "dock") setAskPill(true);
  }, [closeAsk]);

  // Voice: back to search (the field is where the words go) and listen.
  const requestVoice = useCallback((holdKey?: string) => {
    setVoiceHoldKey(holdKey ?? null);
    setIsOpen(true);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
    setIsAskMode(false);
    setVoiceRequest((n) => n + 1);
  }, []);

  const openLoadBundle = useCallback(() => {
    setIsOpen(true);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(true);
    setIsAskMode(false);
  }, []);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const isField = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    };

    // Capture: the center chat stops every key but Escape on its way up
    // (chat.tsx), and ⌘K / `/` still have to park it. ⌘J too, so it works
    // from the composer.
    const onCapture = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
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
        const platform = askPlatformNow();
        if (askBlocksCommand(askPlacement, platform)) {
          moveAsk(askParkPlacement(platform), askEntry, false);
          open(false);
          return;
        }
        toggle();
        return;
      }

      // "/" outside a field opens the slash list. The same yield as ⌘K when
      // Ask is in the palette's place, so the list and the chat both show.
      // In a field (the composer, the palette's own) it is a character.
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isField(e.target)) {
        const platform = askPlatformNow();
        if (askBlocksCommand(askPlacement, platform)) {
          e.preventDefault();
          e.stopPropagation();
          moveAsk(askParkPlacement(platform), askEntry, false);
          open(true);
          return;
        }
        if (!isOpen) {
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
          setIsLoadBundleMode(false);
          return;
        }
        if (isAskMode) {
          e.preventDefault();
          // Back to search only if search was the way in.
          if (askEntry === "command") setIsAskMode(false);
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
  }, [isOpen, isLoadBundleMode, isAskMode, askEntry, askPlacement, toggle, close, open, openAsk, closeAsk, moveAsk]);

  // Navigating to a page to read with the center chat up: it becomes the side
  // panel, so the page is read beside the conversation. Opening from the
  // palette on the page already open stays the morph (the path did not
  // change). Leaving a reading page leaves Ask where it is. Adjusted while
  // rendering, the same way a state is derived from a changed prop.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (
      askPlacement === "center" &&
      askPlatformNow() === "desk" &&
      isReadingPage(pathname)
    ) {
      moveAsk("side", askEntry, false);
    }
  }

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
