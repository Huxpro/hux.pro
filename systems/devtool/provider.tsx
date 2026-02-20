"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Devtool System Provider
// Controls the debug FAB and panel visibility
// Manages override state for debugging any subsystem
// =============================================================================

const DEVTOOL_STORAGE_KEY = "hux_devtool";

interface DevtoolSettings {
  fabEnabled: boolean;
}

function getDevtoolSettings(): DevtoolSettings {
  if (typeof window === "undefined") return { fabEnabled: false };
  try {
    const stored = localStorage.getItem(DEVTOOL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore
  }
  return { fabEnabled: false };
}

function setDevtoolSettings(settings: DevtoolSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEVTOOL_STORAGE_KEY, JSON.stringify(settings));
}

// =============================================================================
// Devtool Context
// =============================================================================

interface DevtoolContextType {
  /** Whether devtool is enabled (FAB visible, overrides active) */
  isEnabled: boolean;
  /** Whether the devtool panel is currently open */
  isOpen: boolean;
  /** Toggle panel open/close */
  toggle: () => void;
  /** Open the panel */
  open: () => void;
  /** Close the panel */
  close: () => void;
  /** Toggle devtool enabled state */
  toggleEnabled: () => void;
  /** Set devtool enabled state directly */
  setEnabled: (enabled: boolean) => void;
}

const DevtoolContext = createContext<DevtoolContextType | undefined>(undefined);

export function useDevtool() {
  const context = useContext(DevtoolContext);
  if (!context) throw new Error("useDevtool must be used within DevtoolProvider");
  return context;
}

interface DevtoolProviderProps {
  children: React.ReactNode;
  /** Whether the command palette is open (to disable 'D' shortcut) */
  isCommandOpen?: boolean;
}

export function DevtoolProvider({ children, isCommandOpen = false }: DevtoolProviderProps) {
  const [isEnabled, setIsEnabledState] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Load enabled state from localStorage on mount
  useEffect(() => {
    const settings = getDevtoolSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setIsEnabledState(settings.fabEnabled);
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    setDevtoolSettings({ fabEnabled: enabled });
    if (!enabled) setIsOpen(false);
  }, []);

  const toggleEnabled = useCallback(() => {
    setIsEnabledState((prev) => {
      const newEnabled = !prev;
      setDevtoolSettings({ fabEnabled: newEnabled });
      if (!newEnabled) setIsOpen(false);
      return newEnabled;
    });
  }, []);

  const toggle = useCallback(() => {
    if (isEnabled) {
      setIsOpen((prev) => !prev);
    }
  }, [isEnabled]);

  const open = useCallback(() => {
    if (isEnabled) {
      setIsOpen(true);
    }
  }, [isEnabled]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Keyboard shortcut: 'D' to toggle panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // "D" to toggle devtool panel (when not in input field and command palette is closed)
      if (
        (e.key === "d" || e.key === "D") &&
        !isInputField &&
        !isCommandOpen &&
        !(e.metaKey || e.ctrlKey || e.altKey)
      ) {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCommandOpen, toggle]);

  return (
    <DevtoolContext.Provider
      value={{
        isEnabled,
        isOpen,
        toggle,
        open,
        close,
        toggleEnabled,
        setEnabled,
      }}
    >
      {children}
    </DevtoolContext.Provider>
  );
}
