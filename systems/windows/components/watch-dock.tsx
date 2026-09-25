"use client";

import { builtinApp } from "@/lib/builtin-apps";
import { useTheater } from "@/systems/theater";
import { useEffect } from "react";
import { useWindows } from "../provider";

/**
 * Playing something opens Watch. The window is the player; immersive and
 * picture-in-picture are ways of borrowing the same stage out of it.
 */
export function WatchDock() {
  const { mode, presentation } = useTheater();
  const { openApp, windows } = useWindows();

  useEffect(() => {
    if (mode === "closed" || presentation !== "window") return;
    if (windows.some((w) => w.id === "watch")) return;
    const app = builtinApp("watch");
    if (app) openApp(app);
    // `windows` is read so a session that becomes windowed opens Watch, but
    // it is not a dependency: closing the window must not immediately reopen
    // it. The window's unmount ends the session instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, presentation, openApp]);

  return null;
}
