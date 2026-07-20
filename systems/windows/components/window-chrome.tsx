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

// =============================================================================
// WindowChrome — the window controls
//
// Adaptive placement, so it feels native on both platforms:
//   • Desktop (pointer) → a top-LEFT cluster of dots, macOS-style. At rest the
//     dots are small; hover grows them into ×/−/+ buttons and reveals the app
//     title. Hovering the green (zoom) dot drops a size menu (the macOS Sequoia
//     tiling-menu pattern). Right-click / clicking the title opens the full menu.
//   • Mobile (touch)   → a centered dots pill; a tap opens the full menu.
//
// Drag/tap/long-press are disambiguated by armPointer, so a press to drag never
// pops a menu. The app's identity lives in the title (hover) and the menu.
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

/** One traffic-light dot: small at rest, grows to a glyph button on hover. */
function Dot({
  active,
  activeColor,
  label,
  onClick,
  glyph,
}: {
  active: boolean;
  activeColor: string;
  label: string;
  onClick: () => void;
  glyph: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-window-control
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex items-center justify-center rounded-full text-black/55",
        "h-[6px] w-[6px] transition-all duration-150 active:scale-90",
        "[@media(hover:hover)]:group-hover/chrome:h-3 [@media(hover:hover)]:group-hover/chrome:w-3",
        "pointer-events-none [@media(hover:hover)]:pointer-events-auto",
        active ? activeColor : "bg-black/30 dark:bg-white/35",
      )}
    >
      <span className="opacity-0 transition-opacity [@media(hover:hover)]:group-hover/chrome:opacity-100">
        {glyph}
      </span>
    </button>
  );
}

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

const stroke = "h-2 w-2 stroke-[2.5]";

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
    if (e.button !== 0) return;
    armPointer(e, {
      onDragStart: beginDrag,
      onTap: (target) => {
        // Tap on a live dot is that dot's job; tap elsewhere on the pill (e.g.
        // the title) opens the menu. On touch the dots are inert → always menu.
        if ((target as HTMLElement)?.closest?.("[data-window-control]")) return;
        setMenuOpen((v) => !v);
      },
      onLongPress: () => {
        suppressClick.current = true;
        setMenuOpen(true);
      },
    });
  };

  const setSize = (pr: SizePreset) => {
    setSizePreset(win.id, pr);
    setMenuOpen(false);
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-40 flex pt-2",
        // Centered on touch; anchored top-left on pointer devices (macOS).
        "justify-center px-2.5 [@media(hover:hover)]:justify-start",
      )}
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
            "group/chrome flex items-center gap-[5px] rounded-full px-2.5 py-1.5",
            "cursor-grab touch-none select-none active:cursor-grabbing",
            "border backdrop-blur-xl transition-colors",
            "bg-white/70 dark:bg-black/55",
            "[@media(hover:hover)]:group-hover/chrome:gap-2",
            focused
              ? "border-black/10 shadow-raised dark:border-white/14"
              : "border-black/6 dark:border-white/8",
          )}
        >
          <Dot
            active={focused}
            activeColor="bg-[#ff5f57] hover:brightness-95"
            label="Close"
            onClick={() => close(win.id)}
            glyph={
              <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
                <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" fill="none" strokeLinecap="round" />
              </svg>
            }
          />
          <Dot
            active={focused}
            activeColor="bg-[#febc2e] hover:brightness-95"
            label="Minimize"
            onClick={() => minimize(win.id)}
            glyph={
              <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
                <path d="M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
              </svg>
            }
          />

          {/* Green (zoom): click toggles max; hover drops a size menu. */}
          <div className="group/zoom relative flex items-center">
            <Dot
              active={focused}
              activeColor="bg-[#28c840] hover:brightness-95"
              label="Zoom"
              onClick={() => toggleMaximize(win.id)}
              glyph={
                <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
                  <path d="M5 2.2v5.6M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
                </svg>
              }
            />
            {/* Size flyout — appears on hovering the green dot (pointer only).
                The `pt-2` is a hover bridge so the pointer can travel into it. */}
            <div
              className={cn(
                "pointer-events-none absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0",
                "transition-opacity duration-150",
                "[@media(hover:hover)]:group-hover/zoom:pointer-events-auto",
                "[@media(hover:hover)]:group-hover/zoom:opacity-100",
              )}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="w-40 rounded-2xl border border-black/8 bg-white/90 p-1 shadow-overlay backdrop-blur-xl dark:border-white/12 dark:bg-neutral-900/90">
                {(["portrait", "landscape", "max"] as SizePreset[]).map((pr) => {
                  const { label, Icon } = PRESET_META[pr];
                  return (
                    <MenuItem
                      key={pr}
                      icon={<Icon className="h-3.5 w-3.5" strokeWidth={2.1} />}
                      active={win.sizePreset === pr}
                      onSelect={() => setSize(pr)}
                    >
                      {label}
                    </MenuItem>
                  );
                })}
              </div>
            </div>
          </div>

          {/* App title — revealed on hover (identity + a visible menu target). */}
          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-[11px] font-medium text-foreground/80",
              "max-w-0 opacity-0 transition-all duration-200",
              "[@media(hover:hover)]:group-hover/chrome:max-w-40",
              "[@media(hover:hover)]:group-hover/chrome:opacity-100",
              "[@media(hover:hover)]:group-hover/chrome:ml-1",
            )}
          >
            {win.app.title}
          </span>
        </div>

        {/* Full menu — right-click / tap / long-press. */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
              style={{ transformOrigin: "top left" }}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                "absolute left-0 top-full mt-1.5 w-52 select-none p-1",
                "rounded-2xl border border-black/8 dark:border-white/12",
                "bg-white/90 shadow-overlay backdrop-blur-xl dark:bg-neutral-900/90",
              )}
            >
              <div className="flex items-center gap-2.5 px-2 py-1.5">
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- tiny local asset
                  <img src={src} alt="" className="h-7 w-7 rounded-[7px] object-cover" draggable={false} />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-muted text-[11px] font-mono text-muted-foreground">
                    {win.app.title.charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-foreground">{win.app.title}</div>
                  <div className="truncate text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    {kind}
                  </div>
                </div>
              </div>
              <div className="my-1 h-px bg-black/6 dark:bg-white/8" />

              {(["portrait", "landscape", "max"] as SizePreset[]).map((pr) => {
                const { label, Icon } = PRESET_META[pr];
                return (
                  <MenuItem
                    key={pr}
                    icon={<Icon className="h-3.5 w-3.5" strokeWidth={2.1} />}
                    active={win.sizePreset === pr}
                    onSelect={() => setSize(pr)}
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
