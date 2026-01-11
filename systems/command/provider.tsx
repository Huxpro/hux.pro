"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Command System Provider
// Controls the command palette open/close state and mode
// =============================================================================

interface CommandContextType {
  isOpen: boolean;
  isActionMode: boolean;
  open: (actionMode?: boolean) => void;
  close: () => void;
  toggle: () => void;
  setActionMode: (mode: boolean) => void;
}

const CommandContext = createContext<CommandContextType | undefined>(undefined);

export function useCommand() {
  const context = useContext(CommandContext);
  if (!context) throw new Error("useCommand must be used within CommandProvider");
  return context;
}

// Legacy alias for backward compatibility
export const useCommandPalette = useCommand;

export function CommandProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isActionMode, setIsActionMode] = useState(false);

  const open = useCallback((actionMode = false) => {
    setIsOpen(true);
    setIsActionMode(actionMode);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsActionMode(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (prev) setIsActionMode(false);
      return !prev;
    });
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

      // "/" to open command palette in action mode
      if (e.key === "/" && !isInputField && !isOpen) {
        e.preventDefault();
        open(true);
        return;
      }

      // Escape to close command palette
      if (e.key === "Escape" && isOpen) {
        close();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, toggle, close, open]);

  return (
    <CommandContext.Provider
      value={{
        isOpen,
        isActionMode,
        open,
        close,
        toggle,
        setActionMode: setIsActionMode,
      }}
    >
      {children}
    </CommandContext.Provider>
  );
}
