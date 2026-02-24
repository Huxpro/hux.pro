"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// =============================================================================
// Devtool System Provider
// Controls the debug FAB and panel visibility
// Manages override state for debugging any subsystem
// =============================================================================

const DEVTOOL_STORAGE_KEY = "hux_devtool";

// =============================================================================
// Draggable Instance Config
// =============================================================================

export interface DraggableInstanceConfig {
  draggable: boolean;
  persist: boolean;
}

export const DRAGGABLE_DEFAULTS: Record<string, DraggableInstanceConfig> = {
  // Persistent tool panel — draggable and remembers position across sessions
  devtool: { draggable: true, persist: true },
  // Well-positioned by design — not draggable by default, but persist is pre-armed
  // so enabling drag via devtools automatically remembers position
  "command-fab": { draggable: false, persist: true },
  // Transient overlay — draggable for convenience, but resets to center on each open
  "command-palette": { draggable: true, persist: false },
};

export const DRAGGABLE_INSTANCES = [
  { id: "devtool", labelEn: "Debug Panel", labelZh: "调试面板" },
  { id: "command-fab", labelEn: "Search Button", labelZh: "搜索按钮" },
  { id: "command-palette", labelEn: "Command Palette", labelZh: "命令面板" },
] as const;

// =============================================================================
// Settings persistence
// =============================================================================

interface DevtoolSettings {
  fabEnabled: boolean;
  draggable: Record<string, Partial<DraggableInstanceConfig>>;
}

function getDevtoolSettings(): DevtoolSettings {
  if (typeof window === "undefined") return { fabEnabled: false, draggable: {} };
  try {
    const stored = localStorage.getItem(DEVTOOL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate from old format
      if ("commandFabDraggable" in parsed && !("draggable" in parsed)) {
        return {
          fabEnabled: parsed.fabEnabled ?? false,
          draggable: parsed.commandFabDraggable
            ? { "command-fab": { draggable: true } }
            : {},
        };
      }
      return {
        fabEnabled: parsed.fabEnabled ?? false,
        draggable: parsed.draggable ?? {},
      };
    }
  } catch {
    // Ignore
  }
  return { fabEnabled: false, draggable: {} };
}

function setDevtoolSettings(settings: Partial<DevtoolSettings>): void {
  if (typeof window === "undefined") return;
  const current = getDevtoolSettings();
  localStorage.setItem(
    DEVTOOL_STORAGE_KEY,
    JSON.stringify({ ...current, ...settings })
  );
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
  /** Get draggable config for an instance (merged defaults + overrides) */
  getDraggableConfig: (id: string) => DraggableInstanceConfig;
  /** Set a single draggable config option for an instance */
  setDraggableConfig: (
    id: string,
    key: keyof DraggableInstanceConfig,
    value: boolean
  ) => void;
  /** Get the reset counter for a draggable instance (used by useDraggable) */
  getDragResetCounter: (id: string) => number;
  /** Signal that a draggable instance should reset position (if persist is off) */
  signalDragReset: (id: string) => void;
}

const DevtoolContext = createContext<DevtoolContextType | undefined>(undefined);

export function useDevtool() {
  const context = useContext(DevtoolContext);
  if (!context) throw new Error("useDevtool must be used within DevtoolProvider");
  return context;
}

export function useOptionalDevtool() {
  return useContext(DevtoolContext);
}

interface DevtoolProviderProps {
  children: React.ReactNode;
  /** Whether the command palette is open (to disable 'D' shortcut) */
  isCommandOpen?: boolean;
}

export function DevtoolProvider({ children, isCommandOpen = false }: DevtoolProviderProps) {
  const [isEnabled, setIsEnabledState] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [draggableOverrides, setDraggableOverrides] = useState<
    Record<string, Partial<DraggableInstanceConfig>>
  >({});
  const [dragResetCounters, setDragResetCounters] = useState<Record<string, number>>({});

  // Load state from localStorage on mount
  useEffect(() => {
    const settings = getDevtoolSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setIsEnabledState(settings.fabEnabled);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setDraggableOverrides(settings.draggable);
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

  const getDraggableConfig = useCallback(
    (id: string): DraggableInstanceConfig => {
      const defaults = DRAGGABLE_DEFAULTS[id] || {
        draggable: false,
        persist: false,
      };
      const overrides = draggableOverrides[id] || {};
      return { ...defaults, ...overrides };
    },
    [draggableOverrides]
  );

  const setDraggableConfig = useCallback(
    (id: string, key: keyof DraggableInstanceConfig, value: boolean) => {
      setDraggableOverrides((prev) => {
        const next = { ...prev, [id]: { ...prev[id], [key]: value } };
        setDevtoolSettings({ draggable: next });
        return next;
      });
    },
    []
  );

  const getDragResetCounter = useCallback(
    (id: string) => dragResetCounters[id] ?? 0,
    [dragResetCounters]
  );

  const signalDragReset = useCallback((id: string) => {
    setDragResetCounters((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
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
        getDraggableConfig,
        setDraggableConfig,
        getDragResetCounter,
        signalDragReset,
      }}
    >
      {children}
    </DevtoolContext.Provider>
  );
}
