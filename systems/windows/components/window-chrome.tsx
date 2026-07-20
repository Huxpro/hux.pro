"use client";

import appIconSnapshot from "@/content/app-icons.json";
import type { AppIconSnapshot } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  Maximize2,
  Minus,
  Monitor,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SizePreset } from "../lib/geometry";
import { armPointer } from "../lib/pointer";
import type { WindowInstance } from "../lib/types";
import { useWindows } from "../provider";
import { TrafficLights } from "./traffic-lights";

// =============================================================================
// WindowChrome — the floating control pill (iPadOS window controls)
//
// A single glassy pill at top-center holding three *stable* dots (see
// TrafficLights). No title, no caret. The pill is also the primary drag handle.
// The window menu is opened by a long-press, a clean tap (no drag), or
// right-click — never by a stray touch, since drag/tap/long-press are all
// disambiguated by armPointer. The app's title/identity lives inside the menu.
// =============================================================================

const ICONS = appIconSnapshot as AppIconSnapshot;

function iconSrc(win: WindowInstance): string | undefined {
  return (
    ICONS[win.app.id]?.file ??
    win.app.icon ??
    (win.app.runtime === "lynx" ? "/app-icons/lynx.png" : undefined)
  );
}

const PRESET_META: Record<SizePreset, { label: string; Icon: typeof Smartphone }> = {
  portrait: { label: "Portrait", Icon: Smartphone },
  landscape: { label: "Landscape", Icon: Monitor },
  max: { label: "Maximize", Icon: Maximize2 },
};

function MenuItem({
  onSelect,
  icon,
  children,
  active,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-black/6 dark:hover:bg-white/10"
    >
      <span className="flex h-4 w-4 items-center justify-center opacity-70">{icon}</span>
      <span className="flex-1">{children}</span>
      {active && <Check className="h-3.5 w-3.5 opacity-80" />}
    </button>
  );
}

export function WindowChrome({
  win,
  focused,
  beginDrag,
}: {
  win: WindowInstance;
  focused: boolean;
  beginDrag: (clientX: number, clientY: number) => void;
}) {
  const { close, minimize, toggleMaximize, setSizePreset } = useWindows();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const src = iconSrc(win);
  const isWeb = win.app.runtime !== "lynx";
  const kind =
    win.app.runtime === "lynx"
      ? win.app.flavor === "vue"
        ? "Lynx · Vue"
        : "Lynx · React"
      : "Web";

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const onPillPointerDown = (e: React.PointerEvent) => {
    // Left button / touch / pen only; let right-click go to the context menu.
    if (e.button !== 0) return;
    armPointer(e, {
      onDragStart: beginDrag,
      onTap: (target) => {
        // A tap on a live control (desktop dot) is that control's job, not the
        // menu's. On touch the dots are inert, so any tap lands here → menu.
        if ((target as HTMLElement)?.closest?.("[data-window-control]")) return;
        setMenuOpen((v) => !v);
      },
      onLongPress: () => {
        // Long-press always opens the menu; swallow the click it would trigger.
        suppressClick.current = true;
        setMenuOpen(true);
      },
    });
  };

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center pt-2"
    >
      <div className="pointer-events-auto relative">
        <div
          onPointerDown={onPillPointerDown}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen((v) => !v);
          }}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              e.preventDefault();
              e.stopPropagation();
              suppressClick.current = false;
            }
          }}
          className={cn(
            "group/chrome flex items-center rounded-full px-2.5 py-1.5",
            "cursor-grab touch-none select-none active:cursor-grabbing",
            "border backdrop-blur-xl transition-colors",
            "bg-white/70 dark:bg-black/55",
            focused
              ? "border-black/10 shadow-raised dark:border-white/14"
              : "border-black/6 dark:border-white/8",
          )}
        >
          <TrafficLights
            active={focused}
            onClose={() => close(win.id)}
            onMinimize={() => minimize(win.id)}
            onZoom={() => toggleMaximize(win.id)}
          />
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
              style={{ transformOrigin: "top center" }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "absolute left-1/2 top-full mt-1.5 w-52 -translate-x-1/2 p-1 select-none",
                "rounded-2xl border border-black/8 dark:border-white/12",
                "bg-white/90 shadow-overlay backdrop-blur-xl dark:bg-neutral-900/90",
              )}
            >
              {/* App identity — the title lives here, as the first menu item. */}
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny local asset
                  <img
                    src={src}
                    alt=""
                    className="h-7 w-7 rounded-[7px] object-cover"
                    draggable={false}
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-muted text-[11px] font-mono text-muted-foreground">
                    {win.app.title.charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">
                    {win.app.title}
                  </div>
                  <div className="truncate text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {kind}
                  </div>
                </div>
              </div>
              <div className="my-1 h-px bg-black/6 dark:bg-white/8" />

              {(["portrait", "landscape", "max"] as SizePreset[]).map((p) => {
                const { label, Icon } = PRESET_META[p];
                return (
                  <MenuItem
                    key={p}
                    icon={<Icon className="h-3.5 w-3.5" strokeWidth={2.1} />}
                    active={win.sizePreset === p}
                    onSelect={() => {
                      setSizePreset(win.id, p);
                      setMenuOpen(false);
                    }}
                  >
                    {label}
                  </MenuItem>
                );
              })}

              <div className="my-1 h-px bg-black/6 dark:bg-white/8" />

              {isWeb && win.app.url && (
                <a
                  role="menuitem"
                  href={win.app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-black/6 dark:hover:bg-white/10"
                >
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" strokeWidth={2.1} />
                  Open in browser
                </a>
              )}
              <MenuItem
                icon={<Minus className="h-3.5 w-3.5" strokeWidth={2.1} />}
                onSelect={() => {
                  minimize(win.id);
                  setMenuOpen(false);
                }}
              >
                Minimize
              </MenuItem>
              <MenuItem
                icon={<X className="h-3.5 w-3.5" strokeWidth={2.1} />}
                onSelect={() => {
                  close(win.id);
                  setMenuOpen(false);
                }}
              >
                Close
              </MenuItem>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
