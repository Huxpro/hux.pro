"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

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
// nothing typed (⌘J, `/` `J`) opens Ask where the visitor last put it. A
// phone has no room for a side panel; there, side is the center's sheet.
// =============================================================================

export type AskPlacement = "center" | "side" | "top";

const ASK_PLACEMENT_KEY = "hux_ask_placement";

function isAskPlacement(value: unknown): value is AskPlacement {
  return value === "center" || value === "side" || value === "top";
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
   * Ask row, Tab) lands in the center; a call opens where Ask was last.
   */
  openAsk: (text?: string, from?: "search" | "call") => void;
  /** Move Ask to another place, the conversation with it. */
  moveAsk: (placement: AskPlacement) => void;
  /** Close Ask wherever it is (a reply still being written leaves a pill). */
  closeAsk: () => void;
  /** Put Ask away into the Dock as a pill. */
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
  const [askSurface, setAskSurface] = useState<"side" | "top" | null>(null);
  const [askPill, setAskPill] = useState(false);
  const [askStarted, setAskStarted] = useState(false);
  // Where the visitor last put Ask: a per-viewer convenience, read on the
  // first call.
  const preferredPlacement = useRef<AskPlacement | null>(null);
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

  const askPlacement: AskPlacement | null = isOpen && isAskMode ? "center" : askSurface;

  const moveAsk = useCallback((placement: AskPlacement) => {
    const target = placement === "side" && !hasRoomBeside() ? "center" : placement;
    setAskStarted(true);
    setAskPill(false);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
    if (target === "center") {
      setAskSurface(null);
      setIsOpen(true);
      setIsAskMode(true);
    } else {
      setIsOpen(false);
      setIsAskMode(false);
      setAskSurface(target);
    }
    // Remembered only when it is where the visitor chose: a phone's sheet is
    // not a vote against the side panel on the desk.
    if (target === placement) {
      preferredPlacement.current = target;
      try {
        localStorage.setItem(ASK_PLACEMENT_KEY, target);
      } catch {
        // Storage unavailable: the choice lasts the page.
      }
    }
  }, []);

  const openAsk = useCallback(
    (text?: string, from: "search" | "call" = "call") => {
      const question = text?.trim();
      if (question) setAskRequest((prev) => ({ text: question, n: (prev?.n ?? 0) + 1 }));
      if (askSurface) {
        // Already open beside the page or at the top: it takes the question.
        moveAsk(askSurface);
        return;
      }
      if (from === "search") {
        moveAsk("center");
        return;
      }
      if (preferredPlacement.current === null) {
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(ASK_PLACEMENT_KEY);
        } catch {
          // Storage unavailable: the center.
        }
        preferredPlacement.current = isAskPlacement(saved) ? saved : "center";
      }
      moveAsk(preferredPlacement.current);
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
    setAskPill(true);
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
      if (e.key === "Escape" && isOpen) {
        if (isLoadBundleMode) {
          e.preventDefault();
          setIsLoadBundleMode(false);
          return;
        }
        if (isAskMode) {
          e.preventDefault();
          setIsAskMode(false);
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
  }, [isOpen, isLoadBundleMode, isAskMode, askPlacement, toggle, close, open, openAsk, closeAsk]);

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
