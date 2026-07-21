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
// Native per platform:
//   • Desktop (pointer) → a top-LEFT cluster of full-size dots that stay dim &
//     grey (chromeless pill) until you hover, then light up to the red/amber/
//     green traffic lights on a glass pill with ×/−/+ glyphs and the app title.
//   • Mobile (touch)    → a small, centred, always-grey dots pill (the dots are
//     never individually tappable on touch, so they read as an indicator; a tap
//     opens the full menu).
//
// Menu: right-click, a tap on the title, or a long-press (incl. long-pressing a
// dot). Drag/tap/long-press are disambiguated by armPointer.
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

/**
 * One traffic-light dot. Small & grey on touch; on desktop it's always full
 * size but dim-grey until the pill is hovered, then it takes its colour (active
 * window only) and reveals its glyph.
 */
function Dot({
  active,
  colorHover,
  label,
  onClick,
  glyph,
}: {
  active: boolean;
  /** e.g. `[@media(hover:hover)]:group-hover/chrome:bg-[#ff5f57]` */
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
        "flex cursor-pointer items-center justify-center rounded-full text-black/55",
        "transition-all duration-150 active:scale-90",
        // Small on touch; always full-size on desktop.
        "h-[6px] w-[6px] [@media(hover:hover)]:h-3 [@media(hover:hover)]:w-3",
        // Inert on touch → tap reaches the pill (menu); live on pointer devices.
        "pointer-events-none [@media(hover:hover)]:pointer-events-auto",
        // Grey base. On desktop: dim at rest, full opacity on hover; coloured
        // only on hover of an active window.
        "bg-black/30 dark:bg-white/35",
        "[@media(hover:hover)]:opacity-45 [@media(hover:hover)]:group-hover/chrome:opacity-100",
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
        // Tap on a live dot is that dot's job; tap on the title (or the pill)
        // opens the menu. On touch the dots are inert → always menu.
        if ((target as HTMLElement)?.closest?.("[data-window-control]")) return;
        setMenuOpen((v) => !v);
      },
      onLongPress: () => {
        // Long-press anywhere (incl. a dot) opens the menu; swallow the click.
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
        // Centred on touch; anchored top-left on pointer devices (macOS).
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
            "group/chrome flex items-center rounded-full px-2.5 py-1.5",
            "cursor-grab touch-none select-none backdrop-blur-xl transition-all duration-200 active:cursor-grabbing",
            // Mobile: always a glass pill.
            "border bg-white/70 dark:bg-black/55",
            focused
              ? "border-black/10 shadow-raised dark:border-white/14"
              : "border-black/6 dark:border-white/8",
            // Desktop: chromeless at rest, glass on hover.
            "[@media(hover:hover)]:border-transparent [@media(hover:hover)]:bg-transparent [@media(hover:hover)]:shadow-none",
            "[@media(hover:hover)]:group-hover/chrome:border-black/10 [@media(hover:hover)]:group-hover/chrome:bg-white/80 [@media(hover:hover)]:group-hover/chrome:shadow-raised",
            "dark:[@media(hover:hover)]:group-hover/chrome:border-white/14 dark:[@media(hover:hover)]:group-hover/chrome:bg-black/60",
          )}
        >
          {/* Dots — grouped so the title never adds a gap at rest (keeps the
              collapsed mobile pill symmetric). */}
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

          {/* App title — revealed on hover; its colour lifts on its own hover as
              a "clickable → opens the menu" hint. */}
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

        {/* Full menu — right-click / tap-title / long-press. */}
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
