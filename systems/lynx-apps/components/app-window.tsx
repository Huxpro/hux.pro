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

const TRAFFIC = {
  close: "#ff5f57",
  minimize: "#febc2e",
  zoom: "#28c840",
} as const;

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
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      onPointerDown={() => focusWindow(win.instanceId)}
      className={cn(
        "fixed left-0 top-0 flex flex-col overflow-hidden rounded-2xl",
        "bg-card/80 backdrop-blur-2xl",
        "border border-border/60",
        "shadow-2xl shadow-black/40",
        focused ? "ring-1 ring-foreground/15" : "opacity-95",
      )}
    >
      {/* Title bar — drag handle */}
      <div
        onPointerDown={(e) => {
          focusWindow(win.instanceId);
          controls.start(e);
        }}
        className={cn(
          "flex h-11 shrink-0 cursor-grab items-center gap-3 px-3 active:cursor-grabbing",
          "border-b border-border/50",
          "select-none touch-none",
        )}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => closeWindow(win.instanceId)}
            className="group flex h-3 w-3 items-center justify-center rounded-full hover:brightness-110"
            style={{ background: TRAFFIC.close }}
          >
            <X
              className="h-2 w-2 text-black/60 opacity-0 group-hover:opacity-100"
              strokeWidth={3}
            />
          </button>
          <button
            type="button"
            aria-label="Minimize"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => minimizeWindow(win.instanceId)}
            className="group flex h-3 w-3 items-center justify-center rounded-full hover:brightness-110"
            style={{ background: TRAFFIC.minimize }}
          >
            <Minus
              className="h-2 w-2 text-black/60 opacity-0 group-hover:opacity-100"
              strokeWidth={3}
            />
          </button>
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: TRAFFIC.zoom }}
          />
        </div>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-xs font-medium text-foreground/90">
            {title}
          </div>
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {app.framework === "vue" ? "VueLynx" : "ReactLynx"}
          </div>
        </div>

        <div
          className="h-6 w-6 shrink-0 rounded-md"
          style={{ background: app.accent }}
          aria-hidden
        />
      </div>

      {/* Player surface */}
      <div className="relative min-h-0 flex-1 bg-background">
        <LynxPlayer app={app} />
      </div>
    </motion.div>
  );
}
