"use client";

import { askConfigNow } from "@/systems/ask/lib/config";
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
// Asking from search (the Ask row, Tab) lands in the center, unless Ask is
// already open somewhere else, which then takes the question. A call with
// nothing typed (⌘J, `/` `J`) opens Ask where the visitor last put it.
// Those are the desk's preset; where each opens, and what minimize does, are
// settings (systems/ask/lib/config.ts), read as each call is made.
//
// A phone has no room for a side panel, and no use for a palette under a
// conversation: there the center is a bottom drawer of Ask's own (the
// `sheet` surface), and side is the same drawer. Its preset is the drawer
// alone: no pill, and minimize is close.
// =============================================================================

export type AskPlacement = "center" | "side" | "top";

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

const ASK_PLACEMENT_KEY = "hux_ask_placement";

function isAskPlacement(value: unknown): value is AskPlacement {
  return value === "center" || value === "side" || value === "top";
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
  try {
    const raw = localStorage.getItem(ASK_PLACEMENT_KEY);
    if (!raw) return {};
    // The old single choice, from before there were two kinds of page.
    if (isAskPlacement(raw)) return { other: raw };
    const v = JSON.parse(raw) as Record<string, unknown>;
    return {
      ...(isAskPlacement(v.reading) ? { reading: v.reading } : {}),
      ...(isAskPlacement(v.other) ? { other: v.other } : {}),
    };
  } catch {
    return {};
  }
}

function writeChosen(kind: PageKind, placement: AskPlacement) {
  try {
    localStorage.setItem(ASK_PLACEMENT_KEY, JSON.stringify({ ...readChosen(), [kind]: placement }));
  } catch {
    // Storage unavailable: the choice lasts the page.
  }
}

/** Room for a panel beside the page: the surfaces' `sm`. */
function hasRoomBeside(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;
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
   * visitor put it there by hand (a place button, a drop), which makes it
   * the default for this kind of page.
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
  const [isOpen, setIsOpen] = useState(false);
  const [isSlashCommandsMode, setIsSlashCommandsMode] = useState(false);
  const [isLoadBundleMode, setIsLoadBundleMode] = useState(false);
  const [isAskMode, setIsAskMode] = useState(false);
  const [askRequest, setAskRequest] = useState<{ text: string; n: number } | null>(null);
  const [askSurface, setAskSurface] = useState<"side" | "top" | "sheet" | null>(null);
  const [askPill, setAskPill] = useState(false);
  const [askStarted, setAskStarted] = useState(false);
  const [askEntry, setAskEntry] = useState<AskEntry>("direct");
  const pathname = usePathname();
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
    if (chosen && target === placement) writeChosen(isReadingPage(pathname) ? "reading" : "other", target);
  }, [pathname]);

  const openAsk = useCallback(
    (text?: string, from: "search" | "palette" | "call" = "call") => {
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
      const reading = isReadingPage(pathname);
      const chosen = readChosen()[reading ? "reading" : "other"];
      // A page to read stays in view: Ask opens beside it, unless the visitor
      // put it elsewhere on such a page. Elsewhere, asking from search lands
      // in the search's own place; a call where Ask was last put by hand.
      const target: AskPlacement =
        reading && config.onReadingPage === "side"
          ? (chosen ?? "side")
          : from === "search"
            ? config.fromSearch
            : config.fromCall === "last"
              ? (chosen ?? "center")
              : config.fromCall;
      moveAsk(target, entry);
    },
    [askSurface, moveAsk, pathname]
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
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // ⌘K to toggle command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
        return;
      }

      // ⌘J: straight into Ask (systems/ask), from anywhere, where it was
      // last put; again to close it.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (askPlacement) closeAsk();
        else openAsk();
        return;
      }

      // "/" to open command palette in slash commands mode
      if (e.key === "/" && !isInputField && !isOpen) {
        e.preventDefault();
        open(true);
        return;
      }

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

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoadBundleMode, isAskMode, askEntry, askPlacement, toggle, close, open, openAsk, closeAsk]);

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
