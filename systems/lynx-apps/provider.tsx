"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getLynxApp, LYNX_APPS } from "./lib/apps";
import type { AppWindowId, OpenAppWindow } from "./lib/types";

const BASE_Z = 40;

interface LynxAppsContextType {
  apps: typeof LYNX_APPS;
  windows: OpenAppWindow[];
  focusedId: AppWindowId | null;
  openApp: (appId: string) => void;
  closeWindow: (instanceId: AppWindowId) => void;
  focusWindow: (instanceId: AppWindowId) => void;
  minimizeWindow: (instanceId: AppWindowId) => void;
  restoreWindow: (instanceId: AppWindowId) => void;
}

const LynxAppsContext = createContext<LynxAppsContextType | undefined>(
  undefined,
);

export function useLynxApps() {
  const ctx = useContext(LynxAppsContext);
  if (!ctx) throw new Error("useLynxApps must be used within LynxAppsProvider");
  return ctx;
}

export function useOptionalLynxApps() {
  return useContext(LynxAppsContext);
}

function nextInstanceId(appId: string): string {
  return `${appId}-${Math.random().toString(36).slice(2, 8)}`;
}

export function LynxAppsProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<OpenAppWindow[]>([]);
  const [focusedId, setFocusedId] = useState<AppWindowId | null>(null);
  const zCounter = useRef(BASE_Z);

  const openApp = useCallback((appId: string) => {
    if (!getLynxApp(appId)) return;

    setWindows((prev) => {
      // Focus existing non-minimized window for the same app
      const existing = prev.find((w) => w.appId === appId && !w.minimized);
      if (existing) {
        zCounter.current += 1;
        setFocusedId(existing.instanceId);
        return prev.map((w) =>
          w.instanceId === existing.instanceId
            ? { ...w, zIndex: zCounter.current }
            : w,
        );
      }

      // Restore minimized window
      const minimized = prev.find((w) => w.appId === appId && w.minimized);
      if (minimized) {
        zCounter.current += 1;
        setFocusedId(minimized.instanceId);
        return prev.map((w) =>
          w.instanceId === minimized.instanceId
            ? { ...w, minimized: false, zIndex: zCounter.current }
            : w,
        );
      }

      const cascade = prev.length;
      zCounter.current += 1;
      const instanceId = nextInstanceId(appId);
      setFocusedId(instanceId);
      return [
        ...prev,
        {
          instanceId,
          appId,
          zIndex: zCounter.current,
          minimized: false,
          offset: { x: cascade * 28, y: cascade * 28 },
        },
      ];
    });
  }, []);

  const closeWindow = useCallback((instanceId: AppWindowId) => {
    setWindows((prev) => {
      const next = prev.filter((w) => w.instanceId !== instanceId);
      setFocusedId((fid) => {
        if (fid !== instanceId) return fid;
        return next.length ? next[next.length - 1]!.instanceId : null;
      });
      return next;
    });
  }, []);

  const focusWindow = useCallback((instanceId: AppWindowId) => {
    zCounter.current += 1;
    const z = zCounter.current;
    setFocusedId(instanceId);
    setWindows((prev) =>
      prev.map((w) =>
        w.instanceId === instanceId
          ? { ...w, zIndex: z, minimized: false }
          : w,
      ),
    );
  }, []);

  const minimizeWindow = useCallback((instanceId: AppWindowId) => {
    setWindows((prev) =>
      prev.map((w) =>
        w.instanceId === instanceId ? { ...w, minimized: true } : w,
      ),
    );
    setFocusedId((fid) => (fid === instanceId ? null : fid));
  }, []);

  const restoreWindow = useCallback(
    (instanceId: AppWindowId) => {
      focusWindow(instanceId);
    },
    [focusWindow],
  );

  const value = useMemo(
    () => ({
      apps: LYNX_APPS,
      windows,
      focusedId,
      openApp,
      closeWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow,
    }),
    [
      windows,
      focusedId,
      openApp,
      closeWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow,
    ],
  );

  return (
    <LynxAppsContext.Provider value={value}>{children}</LynxAppsContext.Provider>
  );
}
