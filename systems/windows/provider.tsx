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
  defaultPreset,
  getViewport,
  placeWindow,
  presetRect,
  SIZE_PRESETS,
  workingArea,
  type SizePreset,
  type Viewport,
} from "./lib/geometry";
import type { Rect, WindowInstance } from "./lib/types";

// =============================================================================
// Window System — the "desktop" coordination layer
//
// Owns the set of open app windows and their stacking, the way a window server
// does: opening, closing, focusing (z-order), minimizing, sizing (presets +
// maximize), and committing geometry after a drag/resize. The visuals live in
// <WindowLayer /> and <Window />; this provider is a pure state machine.
//
// One window per app id: tapping an already-open app focuses (and un-minimizes)
// its window rather than spawning a duplicate — the home-screen mental model.
// =============================================================================

interface WindowContextType {
  windows: WindowInstance[];
  /** Open `app` (or focus/restore it if already open). */
  openApp: (app: AppLink) => void;
  /** Open (or focus) an ad-hoc Lynx window for an arbitrary `.web.bundle` URL. */
  openBundleUrl: (url: string, opts?: { title?: string; flavor?: "react" | "vue" }) => void;
  close: (id: string) => void;
  /** Bring a window to the front and mark it focused. */
  focus: (id: string) => void;
  minimize: (id: string) => void;
  /** Toggle maximize ⇄ the previous preset. */
  toggleMaximize: (id: string) => void;
  /** Set an explicit size preset (portrait / landscape / max). */
  setSizePreset: (id: string, preset: SizePreset) => void;
  /** Advance to the next size preset. */
  cycleSize: (id: string) => void;
  /** Restore a minimized window without spawning (used by the shelf tap). */
  restore: (id: string) => void;
  /** Commit a window's geometry after a drag / resize gesture. */
  setRect: (id: string, rect: Rect) => void;
  /** The id of the front-most (focused) non-minimized window, or null. */
  focusedId: string | null;
  isOpen: (id: string) => boolean;
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

/** Apply a size preset to a window, tracking the pre-max rect/preset. */
function applyPreset(
  w: WindowInstance,
  preset: SizePreset,
  vp: Viewport,
  z: number,
): WindowInstance {
  if (preset === "max") {
    const fromMax = w.sizePreset === "max";
    return {
      ...w,
      sizePreset: "max",
      rect: workingArea(vp),
      z,
      restoreRect: fromMax ? w.restoreRect : w.rect,
      restorePreset: fromMax ? w.restorePreset : w.sizePreset,
    };
  }
  return {
    ...w,
    sizePreset: preset,
    rect: presetRect(preset, vp),
    z,
    restoreRect: undefined,
    restorePreset: undefined,
  };
}

function bundleTitle(url: string): string {
  try {
    const u = new URL(url, "http://x");
    const file = u.pathname.split("/").filter(Boolean).pop() ?? "bundle";
    return file.replace(/\.(web|lynx)\.bundle$/i, "") || "Bundle";
  } catch {
    return "Bundle";
  }
}

export function WindowProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
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
      const z = nextZ();
      setWindows((prev) =>
        prev.some((w) => w.id === id)
          ? prev.map((w) => (w.id === id ? { ...w, z } : w))
          : prev,
      );
    },
    [nextZ],
  );

  const openApp = useCallback(
    (app: AppLink) => {
      const z = nextZ();
      setWindows((prev) => {
        const existing = prev.find((w) => w.id === app.id);
        if (existing) {
          return prev.map((w) =>
            w.id === app.id
              ? { ...w, z, mode: w.mode === "minimized" ? "normal" : w.mode }
              : w,
          );
        }
        const preset = app.size ?? defaultPreset(app.runtime);
        const rect = placeWindow(openCountRef.current, getViewport(), preset);
        openCountRef.current += 1;
        return [
          ...prev,
          { id: app.id, app, rect, mode: "normal", sizePreset: preset, z },
        ];
      });
    },
    [nextZ],
  );

  const openBundleUrl = useCallback(
    (url: string, opts?: { title?: string; flavor?: "react" | "vue" }) => {
      openApp({
        id: `ota:${url}`,
        title: opts?.title ?? bundleTitle(url),
        url,
        runtime: "lynx",
        flavor: opts?.flavor ?? "react",
        bundleUrl: url,
      });
    },
    [openApp],
  );

  const close = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const minimize = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === id ? { ...w, mode: "minimized" } : w)),
    );
  }, []);

  const restore = useCallback(
    (id: string) => {
      const z = nextZ();
      setWindows((prev) =>
        prev.map((w) =>
          w.id === id
            ? { ...w, mode: w.mode === "minimized" ? "normal" : w.mode, z }
            : w,
        ),
      );
    },
    [nextZ],
  );

  const setSizePreset = useCallback(
    (id: string, preset: SizePreset) => {
      const z = nextZ();
      const vp = getViewport();
      setWindows((prev) =>
        prev.map((w) => (w.id === id ? applyPreset(w, preset, vp, z) : w)),
      );
    },
    [nextZ],
  );

  const cycleSize = useCallback(
    (id: string) => {
      const z = nextZ();
      const vp = getViewport();
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          const next =
            SIZE_PRESETS[(SIZE_PRESETS.indexOf(w.sizePreset) + 1) % SIZE_PRESETS.length];
          return applyPreset(w, next, vp, z);
        }),
      );
    },
    [nextZ],
  );

  const toggleMaximize = useCallback(
    (id: string) => {
      const z = nextZ();
      const vp = getViewport();
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          if (w.sizePreset === "max") {
            const p = w.restorePreset ?? defaultPreset(w.app.runtime);
            return {
              ...w,
              sizePreset: p,
              rect: w.restoreRect ?? presetRect(p, vp),
              z,
              restoreRect: undefined,
              restorePreset: undefined,
            };
          }
          return applyPreset(w, "max", vp, z);
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

  // Keep maximized windows glued to the working area, and clamp the rest, when
  // the viewport changes size.
  useEffect(() => {
    const onResize = () => {
      const vp = getViewport();
      setWindows((prev) =>
        prev.map((w) =>
          w.sizePreset === "max"
            ? { ...w, rect: workingArea(vp) }
            : { ...w, rect: clampRect(w.rect, vp) },
        ),
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const focusedId = useMemo(() => {
    const visible = windows.filter((w) => w.mode !== "minimized");
    if (visible.length === 0) return null;
    return visible.reduce((a, b) => (a.z >= b.z ? a : b)).id;
  }, [windows]);

  // Esc closes the front-most window (matches the Dock's Esc-to-collapse).
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
      openBundleUrl,
      close,
      focus,
      minimize,
      toggleMaximize,
      setSizePreset,
      cycleSize,
      restore,
      setRect,
      focusedId,
      isOpen,
    }),
    [
      windows,
      openApp,
      openBundleUrl,
      close,
      focus,
      minimize,
      toggleMaximize,
      setSizePreset,
      cycleSize,
      restore,
      setRect,
      focusedId,
      isOpen,
    ],
  );

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}
