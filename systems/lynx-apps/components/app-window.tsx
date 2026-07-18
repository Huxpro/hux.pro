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
 * Floating app window — iPadOS Stage Manager–inspired:
 * continuous large radius, edge-to-edge content, floating ••• control
 * pill (drag + close/minimize). No macOS traffic lights / title strip.
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
  const [menuOpen, setMenuOpen] = useState(false);

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
      onPointerDown={() => {
        focusWindow(win.instanceId);
        setMenuOpen(false);
      }}
      className={cn(
        "fixed left-0 top-0 overflow-hidden rounded-[22px]",
        "bg-black",
        "border border-black/10 dark:border-white/14",
        "shadow-overlay",
        focused ? "ring-1 ring-black/10 dark:ring-white/12" : "opacity-[0.97]",
      )}
    >
      {/* Stage Manager ••• pill — floats over content */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center pt-2.5">
        <div className="pointer-events-auto relative">
          <button
            type="button"
            aria-label={`${title} window menu`}
            aria-expanded={menuOpen}
            onPointerDown={(e) => {
              e.stopPropagation();
              focusWindow(win.instanceId);
              controls.start(e);
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={cn(
              "flex h-7 items-center gap-2 rounded-full px-3",
              "bg-white/75 dark:bg-black/55",
              "backdrop-blur-xl",
              "border border-black/8 dark:border-white/12",
              "shadow-raised",
              "cursor-grab active:cursor-grabbing",
              "touch-none select-none",
              "transition-colors hover:bg-white/90 dark:hover:bg-black/70",
            )}
          >
            <span className="flex items-center gap-[3px]" aria-hidden>
              <span className="h-[3.5px] w-[3.5px] rounded-full bg-foreground/50" />
              <span className="h-[3.5px] w-[3.5px] rounded-full bg-foreground/50" />
              <span className="h-[3.5px] w-[3.5px] rounded-full bg-foreground/50" />
            </span>
            <span className="max-w-[9rem] truncate text-[11px] font-medium text-foreground/80">
              {title}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className={cn(
                "absolute left-1/2 top-full mt-1.5 w-36 -translate-x-1/2",
                "overflow-hidden rounded-xl",
                "bg-white/90 dark:bg-neutral-900/90",
                "backdrop-blur-xl",
                "border border-black/8 dark:border-white/12",
                "shadow-overlay",
                "py-1",
              )}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  minimizeWindow(win.instanceId);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Minus className="h-3.5 w-3.5 opacity-60" strokeWidth={2.25} />
                Minimize
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  closeWindow(win.instanceId);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5 opacity-60" strokeWidth={2.25} />
                Close
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full-bleed player */}
      <div className="h-full w-full">
        <LynxPlayer app={app} />
      </div>
    </motion.div>
  );
}
