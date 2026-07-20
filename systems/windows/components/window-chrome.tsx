"use client";

import appIconSnapshot from "@/content/app-icons.json";
import type { AppIconSnapshot } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Maximize2,
  Minus,
  Monitor,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SizePreset } from "../lib/geometry";
import type { WindowInstance } from "../lib/types";
import { useWindows } from "../provider";
import { AppBadgeFor } from "./app-badge";
import { TrafficLights } from "./traffic-lights";

// =============================================================================
// WindowChrome — the adaptive floating control pill (Stage Manager–style)
//
// Edge-to-edge content, one small translucent pill floating at top-center:
//
//   • Rest         → just the app icon (+ a caret on touch). It's the drag
//                     handle. No title, so it stays out of the way.
//   • Desktop hover→ morphs (as a group) into mouse-friendly chrome:
//                     traffic lights + icon + title + caret.
//   • Caret / right-click → a menu: size presets, open-in-browser, min, close.
//
// Drag and menu are deliberately on *different* targets (pill body vs. caret),
// so touching the pill to drag can never accidentally pop the menu open.
// =============================================================================

const ICONS = appIconSnapshot as AppIconSnapshot;

function iconSrc(win: WindowInstance): string | undefined {
  return (
    ICONS[win.app.id]?.file ??
    win.app.icon ??
    (win.app.runtime === "lynx" ? "/app-icons/lynx.png" : undefined)
  );
}

const PRESET_META: Record<
  SizePreset,
  { label: string; Icon: typeof Smartphone }
> = {
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
      <span className="flex h-4 w-4 items-center justify-center opacity-70">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      {active && <Check className="h-3.5 w-3.5 opacity-80" />}
    </button>
  );
}

export function WindowChrome({
  win,
  focused,
  onDragPointerDown,
}: {
  win: WindowInstance;
  focused: boolean;
  onDragPointerDown: (e: React.PointerEvent) => void;
}) {
  const { close, minimize, toggleMaximize, setSizePreset } = useWindows();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const src = iconSrc(win);
  const isWeb = win.app.runtime !== "lynx";

  // Close the menu on outside-tap / Escape.
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

  const icon = src ? (
    // eslint-disable-next-line @next/next/no-img-element -- tiny local static asset
    <img
      src={src}
      alt=""
      draggable={false}
      className="h-[18px] w-[18px] rounded-[5px] object-cover"
    />
  ) : (
    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-muted text-[9px] font-mono text-muted-foreground">
      {win.app.title.charAt(0)}
    </span>
  );

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-2"
    >
      <div className="pointer-events-auto relative">
        {/* The pill. Body = drag handle; lights + title reveal on desktop hover
            (as a group); caret opens the menu. */}
        <div
          onPointerDown={onDragPointerDown}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenuOpen((v) => !v);
          }}
          className={cn(
            "group/chrome flex items-center gap-1.5 rounded-full px-2 py-1",
            "cursor-grab touch-none select-none active:cursor-grabbing",
            "border backdrop-blur-xl transition-colors",
            "bg-white/70 dark:bg-black/55",
            focused
              ? "border-black/10 shadow-raised dark:border-white/14"
              : "border-black/6 dark:border-white/8",
            "hover:bg-white/90 dark:hover:bg-black/70",
          )}
        >
          {/* Traffic lights — collapsed at rest, morph in together on hover
              (hover-capable pointers only). */}
          <div
            className={cn(
              "flex items-center overflow-hidden",
              "max-w-0 opacity-0 transition-all duration-200",
              "[@media(hover:hover)]:group-hover/chrome:max-w-24",
              "[@media(hover:hover)]:group-hover/chrome:opacity-100",
              "[@media(hover:hover)]:group-hover/chrome:mr-0.5",
            )}
            // Lights are their own buttons — don't start a drag from them.
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TrafficLights
              onClose={() => close(win.id)}
              onMinimize={() => minimize(win.id)}
              onZoom={() => toggleMaximize(win.id)}
            />
          </div>

          {icon}

          {/* Title — hidden at rest, revealed on desktop hover. */}
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-[11px] font-medium text-foreground/80",
              "max-w-0 opacity-0 transition-all duration-200",
              "[@media(hover:hover)]:group-hover/chrome:max-w-40",
              "[@media(hover:hover)]:group-hover/chrome:opacity-100",
              "[@media(hover:hover)]:group-hover/chrome:ml-0.5",
            )}
          >
            {win.app.title}
          </span>

          {/* Caret → menu. Always visible on touch; hover-revealed on desktop. */}
          <button
            type="button"
            aria-label="Window menu"
            aria-expanded={menuOpen}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full text-foreground/60",
              "hover:text-foreground",
              "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/chrome:opacity-100",
              "transition-opacity",
            )}
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>

        {/* Dropdown menu */}
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
                "absolute left-1/2 top-full mt-1.5 w-48 -translate-x-1/2 p-1",
                "rounded-2xl border border-black/8 dark:border-white/12",
                "bg-white/90 shadow-overlay backdrop-blur-xl dark:bg-neutral-900/90",
              )}
            >
              {/* Tech-stack context */}
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <AppBadgeFor app={win.app} size={16} />
                <span className="text-[11px] font-medium text-muted-foreground">
                  {win.app.runtime === "lynx"
                    ? win.app.flavor === "vue"
                      ? "Lynx · Vue"
                      : "Lynx · React"
                    : "Web"}
                </span>
              </div>
              <div className="my-1 h-px bg-black/6 dark:bg-white/8" />

              {/* Size presets */}
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
