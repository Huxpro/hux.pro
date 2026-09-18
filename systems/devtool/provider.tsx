"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
// Deep import on purpose: the surface barrel reaches back here through
// `systems/draggable`, and presentation.ts depends on nothing but React.
import { useBreakpointValue } from "@/systems/surface/presentation";

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
  // The floating devtool — pill and window are two sizes of one object, so
  // they share an instance and stay anchored by the same corner. Persisted,
  // which is also how the window finds where the pill was left.
  devtool: { draggable: true, persist: true },
  // Well-positioned by design — not draggable by default, but persist is pre-armed
  // so enabling drag via devtools automatically remembers position
  "command-fab": { draggable: false, persist: true },
  // Transient overlay — draggable for convenience, but resets to center on each open
  "command-palette": { draggable: true, persist: false },
  // Adaptive surfaces in their desktop "window" shape. Same posture as the
  // palette: drag it out of the way while you work, back to centre next open.
  "surface-wallpaper": { draggable: true, persist: false },
  "surface-playlist": { draggable: true, persist: false },
};

export const DRAGGABLE_INSTANCES = [
  { id: "devtool", labelEn: "Debug Panel", labelZh: "调试面板" },
  { id: "command-fab", labelEn: "Search Button", labelZh: "搜索按钮" },
  { id: "command-palette", labelEn: "Command Palette", labelZh: "命令面板" },
  // Adaptive surfaces are only draggable in their desktop "window" shape; the
  // sheet and panel shapes ignore these entries.
  { id: "surface-wallpaper", labelEn: "Wallpaper Window", labelZh: "壁纸窗口" },
  { id: "surface-playlist", labelEn: "Playlist Window", labelZh: "播放列表窗口" },
] as const;

// =============================================================================
// Phone palette
// The command palette's shape on a phone: the sheet it is now, or the popover
// it was — the desktop card at phone width, kept whole for comparison.
// =============================================================================

export type PhonePalette = "sheet" | "popover";
export const PHONE_PALETTE_DEFAULT: PhonePalette = "sheet";

/**
 * How the hero leaves as the page scrolls. The platform picks a default;
 * the DevTool can pin either for the session. See `defaultHeroExit`.
 *
 *   scroll  in flow: the hero rides the page up and off.
 *   fade    sticky: the hero holds and phases out while content slides over it.
 */
export type HeroExit = "scroll" | "fade";

/**
 * Whether this viewport has a bottom edge worth docking to. Tailwind's `sm`,
 * the same width at which every other surface stops being a bottom sheet.
 */
const CAN_DOCK = { base: true, sm: false };

// =============================================================================
// Docking
// Where the devtool lives. Two booleans rather than a list of shapes, because
// neither of them is the viewport's business:
//
//   isDetached  false — docked to an edge.   true — floating free.
//   isOpen      false — collapsed to a pill. true — the panel is showing.
//
// The viewport turns that into a shape (systems/devtool/dock.tsx): docked and
// open is a bottom sheet, floating and open is a window, floating and closed is
// the pill. Docked and closed is nothing at all — the way back is `D` or the
// command palette. A desktop has no bottom edge worth docking to, so it reads
// as floating whatever this says, which is exactly how it has always behaved.
//
// `isFloating` therefore belongs here rather than in the dock: the palette's
// switch needs the same answer, and two places deciding it is two places to
// drift apart.
//
// ON AND OFF ARE NOT `isEnabled`. What a person means by "the devtool is on"
// is "there is some of it on screen", and the two dockings answer that
// differently:
//
//   floating   the pill stands by whenever it is enabled, so on = `isEnabled`.
//   docked     there is no pill. Nothing is left behind when the drawer goes
//              down, so on = `isOpen` — swiping the drawer away IS off, and
//              must not take two presses to undo.
//
// That is `isShowing`, and `toggleShowing` is the switch built on it. Off in
// the docked case closes the drawer without disabling: `isEnabled` is also
// what keeps the ambient overrides live (see systems/ambient/provider.tsx),
// and putting a panel away is not the same as throwing its state away.
// =============================================================================

// =============================================================================
// Settings persistence
// =============================================================================

interface DevtoolSettings {
  fabEnabled: boolean;
  draggable: Record<string, Partial<DraggableInstanceConfig>>;
  /** Per-section collapsed state, keyed by the section's stable id. */
  collapsed: Record<string, boolean>;
  phonePalette: PhonePalette;
  /** Pulled off the edge into a floating pill, and kept that way. */
  detached: boolean;
}

const SETTINGS_DEFAULTS: DevtoolSettings = {
  fabEnabled: false,
  draggable: {},
  collapsed: {},
  phonePalette: PHONE_PALETTE_DEFAULT,
  detached: false,
};

function getDevtoolSettings(): DevtoolSettings {
  if (typeof window === "undefined") return SETTINGS_DEFAULTS;
  try {
    const stored = localStorage.getItem(DEVTOOL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate from old format
      if ("commandFabDraggable" in parsed && !("draggable" in parsed)) {
        return {
          ...SETTINGS_DEFAULTS,
          fabEnabled: parsed.fabEnabled ?? false,
          draggable: parsed.commandFabDraggable
            ? { "command-fab": { draggable: true } }
            : {},
          collapsed: parsed.collapsed ?? {},
        };
      }
      return {
        fabEnabled: parsed.fabEnabled ?? false,
        draggable: parsed.draggable ?? {},
        collapsed: parsed.collapsed ?? {},
        phonePalette:
          parsed.phonePalette === "popover" ? "popover" : PHONE_PALETTE_DEFAULT,
        detached: parsed.detached === true,
      };
    }
  } catch {
    // Ignore
  }
  return SETTINGS_DEFAULTS;
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
  /**
   * Turn the devtool on if it is off, and show the panel — one action, because
   * `open()` is gated on `isEnabled` and a caller cannot flip both in a tick.
   * What the command palette runs.
   */
  summon: () => void;
  /** Close the panel */
  close: () => void;
  /** Whether this viewport has a bottom edge worth docking to. */
  canDock: boolean;
  /** Detached, or on a viewport with nowhere to dock. The shape-deciding one. */
  isFloating: boolean;
  /**
   * Is any of the devtool on screen? Floating: the pill stands by, so this is
   * `isEnabled`. Docked: there is no pill, so this is `isOpen`. What the
   * command palette's On / Off reports.
   */
  isShowing: boolean;
  /** The palette's switch: put the devtool on screen, or take it off. */
  toggleShowing: () => void;
  /** Lift the devtool off the edge — it collapses to the floating pill. */
  detach: () => void;
  /** Put it back on the edge — it reopens as the sheet. */
  dock: () => void;
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
  /** Frontmatter of the current route, or null when not on an inspectable page. */
  pageMeta: DevtoolPageMeta | null;
  /** Register / clear the current route's frontmatter (called by DevtoolPageMeta). */
  setPageMeta: (meta: DevtoolPageMeta | null) => void;
  /** Whether a panel section is collapsed. `fallback` applies when unset. */
  isSectionCollapsed: (id: string, fallback?: boolean) => boolean;
  /** Persist a section's collapsed state (survives reload). */
  setSectionCollapsed: (id: string, collapsed: boolean) => void;
  /** The command palette's shape on a phone. A saved setting. */
  phonePalette: PhonePalette;
  setPhonePalette: (shape: PhonePalette) => void;
  /**
   * Pin how the hero leaves as the page scrolls, for this session.
   * `undefined` is the platform default (`defaultHeroExit`).
   */
  heroExitOverride: HeroExit | undefined;
  setHeroExitOverride: (value: HeroExit | undefined) => void;
}

// =============================================================================
// Page Frontmatter channel
// The current route can register its parsed frontmatter so the panel's
// inspector can display it. Populated by <DevtoolPageMeta> on blog pages;
// null everywhere else.
// =============================================================================

export interface DevtoolPageMeta {
  /** Route context — e.g. blog slug + rendered locale. */
  slug: string;
  lang: string;
  /** The post's language scope (`en` / `zh` / `both`), for the header badge. */
  language?: string;
  /** Verbatim frontmatter of the file rendered for this route. */
  frontmatter: Record<string, unknown>;
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
  /**
   * Close the command palette. Detaching the devtool dismisses it: the palette
   * is how the devtool was summoned, and pulling the devtool off the edge says
   * the page is what you want to see now.
   */
  closeCommand?: () => void;
}

export function DevtoolProvider({
  children,
  isCommandOpen = false,
  closeCommand,
}: DevtoolProviderProps) {
  const [isEnabled, setIsEnabledState] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDetached, setIsDetached] = useState(false);
  const [draggableOverrides, setDraggableOverrides] = useState<
    Record<string, Partial<DraggableInstanceConfig>>
  >({});
  const [dragResetCounters, setDragResetCounters] = useState<Record<string, number>>({});
  const [pageMeta, setPageMeta] = useState<DevtoolPageMeta | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [phonePalette, setPhonePaletteState] =
    useState<PhonePalette>(PHONE_PALETTE_DEFAULT);
  const [heroExitOverride, setHeroExitOverride] = useState<HeroExit | undefined>(
    undefined
  );

  // Load state from localStorage on mount
  useEffect(() => {
    const settings = getDevtoolSettings();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setIsEnabledState(settings.fabEnabled);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe: localStorage read
    setDraggableOverrides(settings.draggable);
    // Loaded in the same effect as `fabEnabled` (which gates the panel's
    // render), so the panel's first paint already has the correct fold state
    // — no expand→collapse flash.
    setCollapsedSections(settings.collapsed);
    setPhonePaletteState(settings.phonePalette);
    setIsDetached(settings.detached);
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

  const summon = useCallback(() => {
    setIsEnabledState(true);
    setDevtoolSettings({ fabEnabled: true });
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Pulled off the edge: the panel collapses into the pill it will reopen
  // from. Closing it is the gesture — what is left behind is the pill, and
  // nothing else: the palette that summoned it goes too, because clearing the
  // screen down to the page is the whole point of asking for a pill.
  const detach = useCallback(() => {
    setIsDetached(true);
    setDevtoolSettings({ detached: true });
    setIsOpen(false);
    closeCommand?.();
  }, [closeCommand]);

  // Back onto the edge, and open there: docking a collapsed pill into an empty
  // bottom edge would look like throwing the devtool away.
  const dock = useCallback(() => {
    setIsDetached(false);
    setDevtoolSettings({ detached: false });
    setIsOpen(true);
  }, []);

  const canDock = useBreakpointValue(CAN_DOCK);
  const isFloating = isDetached || !canDock;
  // See the note at the top of this file: on and off are about what is on
  // screen, and the two dockings leave different things behind.
  const isShowing = isFloating ? isEnabled : isOpen;

  const toggleShowing = useCallback(() => {
    if (!isShowing) {
      summon();
      return;
    }
    // Floating: the pill is the thing on screen, so off means disabled.
    // Docked: only the drawer is, and putting it away is not disabling —
    // `isEnabled` also keeps the ambient overrides live.
    if (isFloating) setEnabled(false);
    else close();
  }, [isShowing, isFloating, summon, setEnabled, close]);

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

  const isSectionCollapsed = useCallback(
    (id: string, fallback = false) => collapsedSections[id] ?? fallback,
    [collapsedSections]
  );

  const setSectionCollapsed = useCallback(
    (id: string, collapsed: boolean) => {
      setCollapsedSections((prev) => {
        const next = { ...prev, [id]: collapsed };
        setDevtoolSettings({ collapsed: next });
        return next;
      });
    },
    []
  );

  const setPhonePalette = useCallback((shape: PhonePalette) => {
    setPhonePaletteState(shape);
    setDevtoolSettings({ phonePalette: shape });
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
        summon,
        close,
        canDock,
        isFloating,
        isShowing,
        toggleShowing,
        detach,
        dock,
        toggleEnabled,
        setEnabled,
        getDraggableConfig,
        setDraggableConfig,
        getDragResetCounter,
        signalDragReset,
        pageMeta,
        setPageMeta,
        isSectionCollapsed,
        setSectionCollapsed,
        phonePalette,
        setPhonePalette,
        heroExitOverride,
        setHeroExitOverride,
      }}
    >
      {children}
    </DevtoolContext.Provider>
  );
}
