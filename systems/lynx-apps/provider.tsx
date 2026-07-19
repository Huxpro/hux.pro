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

export interface OpenWebAppInput {
  id: string;
  title: string;
  url: string;
}

interface LynxAppsContextType {
  apps: typeof LYNX_APPS;
  windows: OpenAppWindow[];
  focusedId: AppWindowId | null;
  /** Open a Lynx example bundle in a floating player window. */
  openApp: (appId: string) => void;
  /** Open an external URL in the same floating chrome (iframe). */
  openWebApp: (app: OpenWebAppInput) => void;
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

function upsertWindow(
  prev: OpenAppWindow[],
  match: (w: OpenAppWindow) => boolean,
  create: (cascade: number, z: number) => OpenAppWindow,
  bumpZ: () => number,
  setFocusedId: (id: AppWindowId) => void,
): OpenAppWindow[] {
  const existing = prev.find((w) => match(w) && !w.minimized);
  if (existing) {
    const z = bumpZ();
    setFocusedId(existing.instanceId);
    return prev.map((w) =>
      w.instanceId === existing.instanceId ? { ...w, zIndex: z } : w,
    );
  }

  const minimized = prev.find((w) => match(w) && w.minimized);
  if (minimized) {
    const z = bumpZ();
    setFocusedId(minimized.instanceId);
    return prev.map((w) =>
      w.instanceId === minimized.instanceId
        ? { ...w, minimized: false, zIndex: z }
        : w,
    );
  }

  const z = bumpZ();
  const win = create(prev.length, z);
  setFocusedId(win.instanceId);
  return [...prev, win];
}

export function LynxAppsProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<OpenAppWindow[]>([]);
  const [focusedId, setFocusedId] = useState<AppWindowId | null>(null);
  const zCounter = useRef(BASE_Z);
  const bumpZ = useCallback(() => {
    zCounter.current += 1;
    return zCounter.current;
  }, []);

  const openApp = useCallback(
    (appId: string) => {
      if (!getLynxApp(appId)) return;

      setWindows((prev) =>
        upsertWindow(
          prev,
          (w) => w.kind === "lynx" && w.appId === appId,
          (cascade, z) => ({
            instanceId: nextInstanceId(appId),
            kind: "lynx",
            appId,
            title: getLynxApp(appId)!.title.en,
            zIndex: z,
            minimized: false,
            offset: { x: cascade * 28, y: cascade * 28 },
          }),
          bumpZ,
          setFocusedId,
        ),
      );
    },
    [bumpZ],
  );

  const openWebApp = useCallback(
    (app: OpenWebAppInput) => {
      if (!app.url) return;

      setWindows((prev) =>
        upsertWindow(
          prev,
          (w) => w.kind === "web" && w.appId === app.id,
          (cascade, z) => ({
            instanceId: nextInstanceId(app.id),
            kind: "web",
            appId: app.id,
            title: app.title,
            url: app.url,
            zIndex: z,
            minimized: false,
            offset: { x: cascade * 28, y: cascade * 28 },
          }),
          bumpZ,
          setFocusedId,
        ),
      );
    },
    [bumpZ],
  );

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

  const focusWindow = useCallback(
    (instanceId: AppWindowId) => {
      const z = bumpZ();
      setFocusedId(instanceId);
      setWindows((prev) =>
        prev.map((w) =>
          w.instanceId === instanceId
            ? { ...w, zIndex: z, minimized: false }
            : w,
        ),
      );
    },
    [bumpZ],
  );

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
      openWebApp,
      closeWindow,
      focusWindow,
      minimizeWindow,
      restoreWindow,
    }),
    [
      windows,
      focusedId,
      openApp,
      openWebApp,
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
