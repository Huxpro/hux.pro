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
  /**
   * The last call for Ask (systems/ask), which lives in the Dock as a Live
   * Activity rather than in the palette. A counter, as with `voiceRequest`:
   * the activity answers each call once. `toggle` (⌘J) puts an open Ask
   * away; anything else opens it. Null until the first call, and until then
   * nothing of Ask is loaded.
   */
  askCall: { n: number; toggle: boolean } | null;
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
  /** Close the palette and open Ask in the Dock, sending `text` if there is any. */
  openAsk: (text?: string) => void;
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
  const [askCall, setAskCall] = useState<{ n: number; toggle: boolean } | null>(null);
  const [askRequest, setAskRequest] = useState<{ text: string; n: number } | null>(null);
  const [voiceRequest, setVoiceRequest] = useState(0);
  const [voiceHoldKey, setVoiceHoldKey] = useState<string | null>(null);

  const open = useCallback((slashCommandsMode = false) => {
    setIsOpen(true);
    setIsSlashCommandsMode(slashCommandsMode);
    setIsLoadBundleMode(false);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) {
        setIsSlashCommandsMode(false);
        setIsLoadBundleMode(false);
      }
      return !prev;
    });
  }, []);

  const setSlashCommandsMode = useCallback((mode: boolean) => {
    setIsSlashCommandsMode(mode);
    if (mode) setIsLoadBundleMode(false);
  }, []);

  const setLoadBundleMode = useCallback((mode: boolean) => {
    setIsLoadBundleMode(mode);
    if (mode) setIsSlashCommandsMode(false);
  }, []);

  // Ask is not a mode of the palette: it is a Live Activity in the Dock
  // (systems/ask/components/activity.tsx), so calling it puts the palette
  // away and hands the activity the question. The page stays browsable
  // while it answers.
  const callAsk = useCallback((toggle: boolean) => {
    setAskCall((prev) => ({ n: (prev?.n ?? 0) + 1, toggle }));
  }, []);

  const openAsk = useCallback(
    (text?: string) => {
      close();
      callAsk(false);
      const question = text?.trim();
      if (question) setAskRequest((prev) => ({ text: question, n: (prev?.n ?? 0) + 1 }));
    },
    [close, callAsk],
  );

  // Voice: back to search (the field is where the words go) and listen.
  const requestVoice = useCallback((holdKey?: string) => {
    setVoiceHoldKey(holdKey ?? null);
    setIsOpen(true);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(false);
    setVoiceRequest((n) => n + 1);
  }, []);

  const openLoadBundle = useCallback(() => {
    setIsOpen(true);
    setIsSlashCommandsMode(false);
    setIsLoadBundleMode(true);
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

      // ⌘J: Ask (systems/ask), from anywhere; again to put it away. From an
      // open palette it always opens: the palette goes, Ask comes.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (isOpen) openAsk();
        else callAsk(true);
        return;
      }

      // "/" to open command palette in slash commands mode
      if (e.key === "/" && !isInputField && !isOpen) {
        e.preventDefault();
        open(true);
        return;
      }

      // Escape: load-bundle → back to search; otherwise close.
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
        // Handled: a surface under the palette (the About) leaves this one.
        e.preventDefault();
        close();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoadBundleMode, toggle, close, open, openAsk, callAsk]);

  return (
    <CommandContext.Provider
      value={{
        isOpen,
        isSlashCommandsMode,
        isLoadBundleMode,
        askCall,
        askRequest,
        open,
        close,
        toggle,
        setSlashCommandsMode,
        openLoadBundle,
        setLoadBundleMode,
        openAsk,
        voiceRequest,
        voiceHoldKey,
        requestVoice,
      }}
    >
      {children}
    </CommandContext.Provider>
  );
}
