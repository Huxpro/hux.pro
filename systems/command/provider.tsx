"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Command System Provider
// Controls the command palette open/close state and mode
// =============================================================================

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
  /** Into Ask, sending `text` if there is any; out of it with setAskMode(false). */
  openAsk: (text?: string) => void;
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

  const openAsk = useCallback((text?: string) => {
    setIsOpen(true);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
    setIsAskMode(true);
    const question = text?.trim();
    if (question) setAskRequest((prev) => ({ text: question, n: (prev?.n ?? 0) + 1 }));
  }, []);

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
  }, [isOpen, isLoadBundleMode, isAskMode, toggle, close, open]);

  return (
    <CommandContext.Provider
      value={{
        isOpen,
        isSlashCommandsMode,
        isLoadBundleMode,
        isAskMode,
        askRequest,
        open,
        close,
        toggle,
        setSlashCommandsMode,
        openLoadBundle,
        setLoadBundleMode,
        openAsk,
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
