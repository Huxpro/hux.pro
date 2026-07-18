"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { animate, motion, useDragControls, useMotionValue } from "framer-motion";
import { Minus, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { getLynxApp } from "../lib/apps";
import type { OpenAppWindow } from "../lib/types";
import { useLynxApps } from "../provider";

const LynxPlayer = dynamic(
  () => import("./lynx-player").then((m) => m.LynxPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center text-xs font-mono text-muted-foreground">
        Loading Lynx…
      </div>
    ),
  },
);

const EDGE = 12;

/**
 * Floating app window — iPadOS Stage Manager–inspired chrome:
 * continuous large radius, frosted thin top bar, centered ••• drag affordance,
 * trailing close / minimize. No macOS traffic lights.
 */
export function AppWindow({ win }: { win: OpenAppWindow }) {
  const { locale } = useLocale();
  const { focusedId, focusWindow, closeWindow, minimizeWindow } = useLynxApps();
  const app = getLynxApp(win.appId);
  const controls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const seeded = useRef(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    width: app?.window.width ?? 390,
    height: app?.window.height ?? 720,
  });

  useEffect(() => {
    if (!app) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(app.window.width, vw - 24);
    const height = Math.min(app.window.height, vh - 96);
    setSize({ width, height });

    if (seeded.current) return;
    seeded.current = true;
    x.set((vw - width) / 2 + win.offset.x);
    y.set(Math.max(EDGE + 40, (vh - height) / 2 - 40 + win.offset.y));
  }, [app, win.offset.x, win.offset.y, x, y]);

  const clamp = useCallback(() => {
    const el = nodeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x.get();
    let ny = y.get();
    if (rect.left < EDGE) nx += EDGE - rect.left;
    if (rect.top < EDGE) ny += EDGE - rect.top;
    if (rect.right > vw - EDGE) nx -= rect.right - (vw - EDGE);
    if (rect.bottom > vh - EDGE) ny -= rect.bottom - (vh - EDGE);
    void animate(x, nx, { type: "spring", stiffness: 500, damping: 36 });
    void animate(y, ny, { type: "spring", stiffness: 500, damping: 36 });
  }, [x, y]);

  const focused = focusedId === win.instanceId;

  if (!app || win.minimized) return null;

  const title = locale === "zh" ? app.title.zh : app.title.en;
  const { width, height } = size;

  return (
    <motion.div
      ref={nodeRef}
      drag
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      onDragEnd={clamp}
      style={{ x, y, width, height, zIndex: win.zIndex }}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 420, damping: 30 }}
      onPointerDown={() => focusWindow(win.instanceId)}
      className={cn(
        // iPadOS continuous corner + soft Stage Manager elevation
        "fixed left-0 top-0 flex flex-col overflow-hidden rounded-[22px]",
        "bg-background",
        "border border-black/10 dark:border-white/12",
        "shadow-overlay",
        focused ? "ring-1 ring-black/8 dark:ring-white/10" : "opacity-[0.97]",
      )}
    >
      {/* Thin frosted title bar */}
      <div
        onPointerDown={(e) => {
          focusWindow(win.instanceId);
          controls.start(e);
        }}
        className={cn(
          "relative flex h-11 shrink-0 cursor-grab items-center px-3 active:cursor-grabbing",
          "bg-card/70 backdrop-blur-xl",
          "border-b border-black/6 dark:border-white/8",
          "select-none touch-none",
        )}
      >
        {/* Leading accent pip (app identity, not a traffic light) */}
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: app.accent }}
          aria-hidden
        />

        {/* Centered Stage Manager–style ••• drag affordance + title */}
        <div className="pointer-events-none absolute inset-x-0 flex flex-col items-center justify-center">
          <div
            className="mb-0.5 flex items-center gap-[3px]"
            aria-hidden
          >
            <span className="h-[3px] w-[3px] rounded-full bg-foreground/35" />
            <span className="h-[3px] w-[3px] rounded-full bg-foreground/35" />
            <span className="h-[3px] w-[3px] rounded-full bg-foreground/35" />
          </div>
          <div className="max-w-[60%] truncate text-[11px] font-medium tracking-wide text-foreground/80">
            {title}
          </div>
        </div>

        {/* Trailing window controls */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Minimize"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => minimizeWindow(win.instanceId)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              "text-muted-foreground transition-colors",
              "hover:bg-black/6 hover:text-foreground",
              "dark:hover:bg-white/10",
              "active:scale-95",
            )}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            aria-label="Close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => closeWindow(win.instanceId)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              "text-muted-foreground transition-colors",
              "hover:bg-black/6 hover:text-foreground",
              "dark:hover:bg-white/10",
              "active:scale-95",
            )}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Player surface — edge-to-edge under the bar */}
      <div className="relative min-h-0 flex-1 bg-black">
        <LynxPlayer app={app} />
      </div>
    </motion.div>
  );
}
