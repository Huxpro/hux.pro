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
import { createPortal } from "react-dom";
import type { SizePreset } from "../lib/geometry";
import { armPointer } from "../lib/pointer";
import type { WindowInstance } from "../lib/types";
import { useWindows } from "../provider";

// =============================================================================
// WindowChrome — the window controls
//
// Native per platform:
//   • Desktop (pointer) → a top-LEFT cluster of full-size dots that sit dim &
//     grey on a fully transparent pill at rest, then light up to the red/amber/
//     green traffic lights on a glass pill (glyphs + title) on hover.
//   • Mobile (touch)    → a small, centred, always-grey ••• pill; tap → menu.
//
// The menu is a real modal: it's portaled to <body> with a full-viewport scrim
// (so a tap anywhere — even over an iframe, whose pointer events don't bubble —
// dismisses it), and clamped into the viewport (left under the desktop pill,
// centred under the mobile pill). Opened by right-click / tap-title / long-press.
// =============================================================================

const ICONS = appIconSnapshot as AppIconSnapshot;
const MENU_W = 208; // w-52

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

/** A traffic-light dot: dim grey at rest, coloured (active window) on hover. */
function Dot({
  active,
  colorHover,
  label,
  onClick,
  glyph,
}: {
  active: boolean;
  colorHover: string;
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
        "flex cursor-default items-center justify-center rounded-full text-black/55",
        "transition-all duration-150 active:scale-90",
        // Small on touch; always full-size on desktop.
        "h-[6px] w-[6px] [@media(hover:hover)]:h-3 [@media(hover:hover)]:w-3",
        // Inert on touch → tap reaches the pill (menu); live on pointer devices.
        "pointer-events-none [@media(hover:hover)]:pointer-events-auto",
        // Grey base (no `dark:`, to avoid out-specifying the hover colour in
        // dark mode). Dim at rest on desktop; full + coloured (active) on hover.
        "bg-zinc-500",
        "[@media(hover:hover)]:opacity-40 [@media(hover:hover)]:group-hover/chrome:opacity-100",
        active && colorHover,
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
  const pillRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const src = iconSrc(win);
  const isWeb = win.app.runtime !== "lynx";
  const kind =
    win.app.runtime === "lynx"
      ? win.app.flavor === "vue"
        ? "Lynx · Vue"
        : "Lynx · React"
      : "Web";

  const openMenu = () => {
    const r = pillRef.current?.getBoundingClientRect();
    if (!r) return;
    const centerX = r.left + r.width / 2;
    const left = Math.min(
      Math.max(centerX - MENU_W / 2, 8),
      window.innerWidth - MENU_W - 8,
    );
    setMenu({ left, top: r.bottom + 6 });
  };
  const closeMenu = () => setMenu(null);
  const toggleMenu = () => (menu ? closeMenu() : openMenu());

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menu]);

  const onPillPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    armPointer(e, {
      onDragStart: beginDrag,
      onTap: (target) => {
        if ((target as HTMLElement)?.closest?.("[data-window-control]")) return;
        toggleMenu();
      },
      onLongPress: () => {
        suppressClick.current = true;
        openMenu();
      },
    });
  };

  const setSize = (pr: SizePreset) => {
    setSizePreset(win.id, pr);
    closeMenu();
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-2.5 pt-2 [@media(hover:hover)]:justify-start">
      <div
        ref={pillRef}
        onPointerDown={onPillPointerDown}
        onContextMenu={(e) => {
          e.preventDefault();
          toggleMenu();
        }}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        className={cn(
          "group/chrome pointer-events-auto flex cursor-default items-center rounded-full px-2.5 py-1.5",
          "touch-none select-none transition-all duration-200",
          // Default = fully transparent (this is the desktop rest state).
          "border border-transparent bg-transparent shadow-none",
          // Mobile: always a glass pill.
          "[@media(hover:none)]:border-black/8 [@media(hover:none)]:bg-white/70 [@media(hover:none)]:shadow-raised [@media(hover:none)]:backdrop-blur-xl",
          "dark:[@media(hover:none)]:border-white/12 dark:[@media(hover:none)]:bg-black/55",
          // Desktop: glass only on hover. `hover:` (not group-hover) because
          // this element *is* the group — group-hover would target descendants.
          "[@media(hover:hover)]:hover:border-black/10 [@media(hover:hover)]:hover:bg-white/80 [@media(hover:hover)]:hover:shadow-raised [@media(hover:hover)]:hover:backdrop-blur-xl",
          "dark:[@media(hover:hover)]:hover:border-white/14 dark:[@media(hover:hover)]:hover:bg-black/60",
        )}
      >
        {/* Dots grouped so the title never adds a gap at rest (mobile symmetry). */}
        <div className="flex items-center gap-[5px] [@media(hover:hover)]:gap-2">
          <Dot
            active={focused}
            colorHover="[@media(hover:hover)]:group-hover/chrome:bg-[#ff5f57]"
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
            colorHover="[@media(hover:hover)]:group-hover/chrome:bg-[#febc2e]"
            label="Minimize"
            onClick={() => minimize(win.id)}
            glyph={
              <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
                <path d="M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
              </svg>
            }
          />
          <Dot
            active={focused}
            colorHover="[@media(hover:hover)]:group-hover/chrome:bg-[#28c840]"
            label="Zoom"
            onClick={() => toggleMaximize(win.id)}
            glyph={
              <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
                <path d="M5 2.2v5.6M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
              </svg>
            }
          />
        </div>

        {/* App title — revealed on hover; brightens on its own hover (clickable). */}
        <span
          className={cn(
            "cursor-pointer overflow-hidden whitespace-nowrap text-[11px] font-medium",
            "text-foreground/70 transition-all duration-200 hover:text-foreground",
            "max-w-0 opacity-0",
            "[@media(hover:hover)]:group-hover/chrome:max-w-40",
            "[@media(hover:hover)]:group-hover/chrome:opacity-100",
            "[@media(hover:hover)]:group-hover/chrome:ml-2",
          )}
        >
          {win.app.title}
        </span>
      </div>

      {/* Modal menu — portaled to <body> so its scrim covers everything (incl.
          iframes) and it's never clipped by the window. */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {menu && (
              <>
                <div
                  className="fixed inset-0 z-[55]"
                  onPointerDown={closeMenu}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    closeMenu();
                  }}
                />
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
                  style={{ left: menu.left, top: menu.top, transformOrigin: "top center" }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    "fixed z-[56] w-52 select-none p-1",
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
                      onClick={closeMenu}
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
                      closeMenu();
                    }}
                  >
                    Minimize
                  </MenuItem>
                  <MenuItem
                    icon={<X className="h-3.5 w-3.5" strokeWidth={2.1} />}
                    onSelect={() => {
                      close(win.id);
                      closeMenu();
                    }}
                  >
                    Close
                  </MenuItem>
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
