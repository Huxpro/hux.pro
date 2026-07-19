"use client";

import type { AppLink } from "@/lib/app-icon-core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clampRect,
  getViewport,
  placeWindow,
  workingArea,
} from "./lib/geometry";
import type { Rect, WindowInstance } from "./lib/types";

// =============================================================================
// Window System — the "desktop" coordination layer
//
// Owns the set of open app windows and their stacking, the way a window server
// does: opening, closing, focusing (z-order), minimizing, maximizing, and
// committing a window's geometry after a drag or resize. The visuals live in
// <WindowLayer /> and <Window />; this provider is a pure state machine so the
// chrome never re-implements the open/focus/close logic.
//
// One window per app id: tapping an already-open app's icon focuses (and
// un-minimizes) its window rather than spawning a duplicate — the home-screen
// mental model, not the "⌘N a new document" one.
// =============================================================================

interface WindowContextType {
  windows: WindowInstance[];
  /** Open `app` (or focus/restore it if already open). */
  openApp: (app: AppLink) => void;
  close: (id: string) => void;
  /** Bring a window to the front and mark it focused. */
  focus: (id: string) => void;
  minimize: (id: string) => void;
  /** Toggle maximize ⇄ restore. */
  toggleMaximize: (id: string) => void;
  /** Restore a minimized window without spawning (used by the shelf tap). */
  restore: (id: string) => void;
  /** Commit a window's geometry after a drag / resize gesture. */
  setRect: (id: string, rect: Rect) => void;
  /** The id of the front-most (focused) non-minimized window, or null. */
  focusedId: string | null;
  isOpen: (id: string) => boolean;
  /**
   * Why the last window left the desktop — drives the exit animation (a close
   * shrinks in place; a minimize genies up toward the dock). Consumed as
   * AnimatePresence `custom` by the window layer.
   */
  lastExit: { id: string; kind: "close" | "minimize" } | null;
}

const WindowContext = createContext<WindowContextType | undefined>(undefined);

export function useWindows() {
  const ctx = useContext(WindowContext);
  if (!ctx) throw new Error("useWindows must be used within a WindowProvider");
  return ctx;
}

/** Non-throwing variant for components that render with or without the system. */
export function useOptionalWindows() {
  return useContext(WindowContext);
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [lastExit, setLastExit] = useState<
    { id: string; kind: "close" | "minimize" } | null
  >(null);
  // Monotonic z counter — every focus bumps the target above all others.
  const zRef = useRef(1);
  // How many windows have been opened this session, for the cascade offset.
  const openCountRef = useRef(0);

  const nextZ = useCallback(() => {
    zRef.current += 1;
    return zRef.current;
  }, []);

  const focus = useCallback(
    (id: string) => {
      setWindows((prev) => {
        const target = prev.find((w) => w.id === id);
        if (!target) return prev;
        const z = nextZ();
        return prev.map((w) => (w.id === id ? { ...w, z } : w));
      });
    },
    [nextZ],
  );

  const openApp = useCallback(
    (app: AppLink) => {
      setWindows((prev) => {
        const existing = prev.find((w) => w.id === app.id);
        const z = nextZ();
        if (existing) {
          // Re-focus, and un-minimize if it was tucked away.
          return prev.map((w) =>
            w.id === app.id
              ? { ...w, z, mode: w.mode === "minimized" ? "normal" : w.mode }
              : w,
          );
        }
        const rect = placeWindow(openCountRef.current, getViewport());
        openCountRef.current += 1;
        return [
          ...prev,
          { id: app.id, app, rect, mode: "normal", z } as WindowInstance,
        ];
      });
    },
    [nextZ],
  );

  const close = useCallback((id: string) => {
    setLastExit({ id, kind: "close" });
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimize = useCallback((id: string) => {
    setLastExit({ id, kind: "minimize" });
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, mode: "minimized" } : w)),
    );
  }, []);

  const restore = useCallback(
    (id: string) => {
      const z = nextZ();
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, mode: w.mode === "minimized" ? "normal" : w.mode, z } : w,
        ),
      );
    },
    [nextZ],
  );

  const toggleMaximize = useCallback(
    (id: string) => {
      const z = nextZ();
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          if (w.mode === "maximized") {
            return {
              ...w,
              mode: "normal",
              rect: w.restoreRect ?? w.rect,
              restoreRect: undefined,
              z,
            };
          }
          return {
            ...w,
            mode: "maximized",
            restoreRect: w.rect,
            rect: workingArea(getViewport()),
            z,
          };
        }),
      );
    },
    [nextZ],
  );

  const setRect = useCallback((id: string, rect: Rect) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, rect } : w)));
  }, []);

  const isOpen = useCallback(
    (id: string) => windows.some((w) => w.id === id),
    [windows],
  );

  // Keep maximized windows glued to the working area, and drag-clamp the rest,
  // when the viewport changes size.
  useEffect(() => {
    const onResize = () => {
      const vp = getViewport();
      setWindows((prev) =>
        prev.map((w) =>
          w.mode === "maximized"
            ? { ...w, rect: workingArea(vp) }
            : { ...w, rect: clampRect(w.rect, vp) },
        ),
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Esc closes the front-most window (matches the Dock's Esc-to-collapse).
  const focusedId = useMemo(() => {
    const visible = windows.filter((w) => w.mode !== "minimized");
    if (visible.length === 0) return null;
    return visible.reduce((a, b) => (a.z >= b.z ? a : b)).id;
  }, [windows]);

  useEffect(() => {
    if (!focusedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(focusedId);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusedId, close]);

  const value = useMemo<WindowContextType>(
    () => ({
      windows,
      openApp,
      close,
      focus,
      minimize,
      toggleMaximize,
      restore,
      setRect,
      focusedId,
      isOpen,
      lastExit,
    }),
    [
      windows,
      openApp,
      close,
      focus,
      minimize,
      toggleMaximize,
      restore,
      setRect,
      focusedId,
      isOpen,
      lastExit,
    ],
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}
