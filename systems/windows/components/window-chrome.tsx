"use client";

import appIconSnapshot from "@/content/app-icons.json";
import {
  appTitle,
  resolveAppIconSrc,
  runtimeLabel,
  type AppIconSnapshot,
} from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useInputCapability, useLocale } from "@/services";
import { SURFACE_TRANSITION_MS, SurfaceSheet } from "@/systems/surface";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  Maximize2,
  Minus,
  Monitor,
  Smartphone,
  X,
  type LucideIcon,
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
// The menu takes the shape the device asks for, and only the shape:
//
//   • Desktop → a popover under the pill, a real modal: portaled to <body>
//     with a full-viewport scrim (so a click anywhere — even over an iframe,
//     whose pointer events don't bubble — dismisses it) and clamped into the
//     viewport.
//   • Touch → an action sheet from the bottom edge (systems/surface), which is
//     what iOS answers "long-press an object, get its actions" with. Nothing
//     here computes a position for it, and its own scrim covers the window and
//     its iframe. A selection dismisses the sheet and *then* acts, as on iOS —
//     and because Close unmounts this chrome, and with it a sheet still
//     animating out.
//
// Both shapes render one WindowMenuBody, so the menu offers the same things
// whatever it is shaped like. Opened by right-click / tap-title / long-press.
// =============================================================================

const ICONS = appIconSnapshot as AppIconSnapshot;
const MENU_W = 208; // w-52

const PRESET_META: Record<SizePreset, { label: string; Icon: LucideIcon }> = {
  portrait: { label: "Portrait", Icon: Smartphone },
  landscape: { label: "Landscape", Icon: Monitor },
  max: { label: "Maximize", Icon: Maximize2 },
};

/** Where the desktop popover hangs. Touch has nothing to anchor to. */
interface MenuAnchor {
  left: number;
  top: number;
  origin: string;
}

/** The menu's two shapes: a desktop popover, a touch action sheet. */
type MenuShape = "popover" | "sheet";

/** A traffic-light dot: dim grey at rest, coloured (active window) on hover. */
function Dot({
  active,
  interacting,
  colorHover,
  label,
  onClick,
  glyph,
}: {
  active: boolean;
  /** Window is being dragged/resized or its menu is open → controls "wake up". */
  interacting: boolean;
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
        // dark mode). Dim at rest on both platforms; full when interacting, and
        // coloured (active window only) on desktop hover.
        "bg-zinc-500",
        interacting
          ? "opacity-100"
          : "opacity-40 [@media(hover:hover)]:group-hover/chrome:opacity-100",
        active && colorHover,
      )}
    >
      <span className="opacity-0 transition-opacity [@media(hover:hover)]:group-hover/chrome:opacity-100">
        {glyph}
      </span>
    </button>
  );
}

/**
 * One row of the menu: a menu item in the popover, an action-sheet row on
 * touch. Same row, two densities — a sheet row is a thumb target and carries
 * iOS's red for the destructive one; a popover row is a pointer target.
 */
function MenuItem({
  shape,
  Icon,
  children,
  onSelect,
  href,
  active,
  destructive,
}: {
  shape: MenuShape;
  Icon: LucideIcon;
  children: React.ReactNode;
  onSelect: () => void;
  /** Renders an anchor rather than a button — "Open in browser". */
  href?: string;
  active?: boolean;
  destructive?: boolean;
}) {
  const sheet = shape === "sheet";
  const className = cn(
    "flex w-full items-center text-left text-foreground",
    sheet
      ? "gap-3.5 rounded-xl px-3 py-2.5 text-[15px] active:bg-black/6 dark:active:bg-white/10"
      : "gap-2.5 rounded-lg px-2.5 py-1.5 text-xs hover:bg-black/6 dark:hover:bg-white/10",
    // A destructive row is red on iOS; in a desktop menu it is just a row.
    sheet && destructive && "text-destructive",
  );
  const body = (
    <>
      <span
        className={cn(
          "flex items-center justify-center opacity-70",
          sheet ? "h-[18px] w-[18px]" : "h-4 w-4",
        )}
      >
        <Icon className={sheet ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} strokeWidth={2.1} />
      </span>
      <span className="flex-1">{children}</span>
      {active && <Check className={cn(sheet ? "h-4 w-4" : "h-3.5 w-3.5", "opacity-80")} />}
    </>
  );

  // In the popover a press must not reach the scrim underneath; in the sheet
  // Base UI reads presses to tell a drag from a tap, so it keeps them.
  const stopPress = sheet ? undefined : (e: React.PointerEvent) => e.stopPropagation();

  if (href) {
    return (
      <a
        role={sheet ? undefined : "menuitem"}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onSelect}
        onPointerDown={stopPress}
        className={className}
      >
        {body}
      </a>
    );
  }
  return (
    <button
      type="button"
      role={sheet ? undefined : "menuitem"}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={stopPress}
      className={className}
    >
      {body}
    </button>
  );
}

/** The hairline between groups of rows. */
function MenuRule({ className }: { className?: string }) {
  return <div className={cn("h-px bg-black/6 dark:bg-white/8", className)} />;
}

/**
 * What the menu holds — the app it belongs to, then its actions, in one order
 * for both shapes. The popover keeps them in one list; the sheet puts Close in
 * a group of its own, the way an iOS action sheet separates the destructive
 * choice from the rest.
 */
function WindowMenuBody({
  win,
  shape,
  run,
}: {
  win: WindowInstance;
  shape: MenuShape;
  /** Take the menu away, then do this. */
  run: (action?: () => void) => void;
}) {
  const { close, minimize, setSizePreset } = useWindows();
  const { locale } = useLocale();
  const sheet = shape === "sheet";
  const title = appTitle(win.app, locale);
  const src = resolveAppIconSrc(win.app, ICONS);
  const kind = runtimeLabel(win.app);
  const isWeb = win.app.runtime !== "lynx";

  return (
    // The sheet's own shell already clears the home indicator (the popup sits
    // a bottom inset above the edge), so the rows only need their own padding.
    <div
      // In the popover this box sits between `role="menu"` and its items, so
      // it declares itself no part of the structure.
      role={sheet ? undefined : "none"}
      className={sheet ? "px-2 pb-2 pt-1" : undefined}
    >
      {/* The header is the title of the sheet as much as of the menu: which
          app these actions belong to. */}
      <div className={cn("flex items-center", sheet ? "gap-3 px-3 py-2" : "gap-2.5 px-2 py-1.5")}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- tiny local asset
          <img
            src={src}
            alt=""
            className={cn("rounded-[7px] object-cover", sheet ? "h-9 w-9" : "h-7 w-7")}
            draggable={false}
          />
        ) : (
          <span
            className={cn(
              "flex items-center justify-center rounded-[7px] bg-muted font-mono text-[11px] text-muted-foreground",
              sheet ? "h-9 w-9" : "h-7 w-7",
            )}
          >
            {title.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <div className={cn("truncate font-medium text-foreground", sheet ? "text-[15px]" : "text-sm")}>
            {title}
          </div>
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {kind}
          </div>
        </div>
      </div>
      <MenuRule className={sheet ? "mx-1 my-1" : "my-1"} />

      {(["portrait", "landscape", "max"] as SizePreset[]).map((pr) => {
        const { label, Icon } = PRESET_META[pr];
        return (
          <MenuItem
            key={pr}
            shape={shape}
            Icon={Icon}
            active={win.sizePreset === pr}
            onSelect={() => run(() => setSizePreset(win.id, pr))}
          >
            {label}
          </MenuItem>
        );
      })}

      <MenuRule className={sheet ? "mx-1 my-1" : "my-1"} />

      {isWeb && win.app.url && (
        <MenuItem shape={shape} Icon={ExternalLink} href={win.app.url} onSelect={() => run()}>
          Open in browser
        </MenuItem>
      )}
      <MenuItem shape={shape} Icon={Minus} onSelect={() => run(() => minimize(win.id))}>
        Minimize
      </MenuItem>

      {/* Close ends the window, so on touch it ends the sheet: its own group,
          in red. */}
      {sheet && <MenuRule className="mx-1 my-1" />}
      <MenuItem
        shape={shape}
        Icon={X}
        destructive
        onSelect={() => run(() => close(win.id))}
      >
        Close
      </MenuItem>
    </div>
  );
}

const stroke = "h-2 w-2 stroke-[2.5]";

// The three traffic lights, in macOS order (close · minimize · zoom). `action`
// keys into the per-window dispatch built inside the component. Colours are the
// on-hover fills (active window only); glyphs show on hover.
const DOTS: {
  label: string;
  action: "close" | "minimize" | "zoom";
  colorHover: string;
  glyph: React.ReactNode;
}[] = [
  {
    label: "Close",
    action: "close",
    colorHover: "[@media(hover:hover)]:group-hover/chrome:bg-[#ff5f57]",
    glyph: (
      <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
        <path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="currentColor" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Minimize",
    action: "minimize",
    colorHover: "[@media(hover:hover)]:group-hover/chrome:bg-[#febc2e]",
    glyph: (
      <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
        <path d="M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Zoom",
    action: "zoom",
    colorHover: "[@media(hover:hover)]:group-hover/chrome:bg-[#28c840]",
    glyph: (
      <svg viewBox="0 0 10 10" className={stroke} aria-hidden>
        <path d="M5 2.2v5.6M2.2 5h5.6" stroke="currentColor" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function WindowChrome({
  win,
  focused,
  gesturing,
  beginDrag,
}: {
  win: WindowInstance;
  focused: boolean;
  /** A drag/resize gesture is in progress. */
  gesturing: boolean;
  beginDrag: (clientX: number, clientY: number) => void;
}) {
  const { close, minimize, toggleMaximize } = useWindows();
  // Canonical hover-capability read (not a raw `(hover: hover)` media query,
  // which is unreliable — e.g. always `hover: none` in headless Chrome).
  const { hasFineHoverPointer } = useInputCapability();
  const { locale } = useLocale();
  const title = appTitle(win.app, locale);
  const pillRef = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  // A pointer device gets the popover; anything else gets the sheet.
  const shape: MenuShape = hasFineHoverPointer ? "popover" : "sheet";
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);
  // The pill "wakes up" (glass + full-opacity dots) while interacting — this is
  // what gives the mobile pill its glass look when there's no hover to trigger it.
  const interacting = gesturing || menuOpen;

  const openMenu = () => {
    // The sheet rises from the bottom edge: nothing to anchor, nothing to
    // measure. Only the popover hangs off the pill.
    if (shape === "popover") {
      const r = pillRef.current?.getBoundingClientRect();
      if (!r) return;
      // Left-aligned under the pill, clamped into the viewport.
      const left = Math.min(Math.max(r.left, 8), window.innerWidth - MENU_W - 8);
      setAnchor({ left, top: r.bottom + 6, origin: "top left" });
    }
    setMenuOpen(true);
  };
  const closeMenu = () => setMenuOpen(false);
  const toggleMenu = () => (menuOpen ? closeMenu() : openMenu());

  // The sheet brings its own Escape (and its own scrim).
  useEffect(() => {
    if (!menuOpen || shape !== "popover") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, shape]);

  /**
   * Pick a row: the menu goes first, the action follows. On a sheet the order
   * is load-bearing — `close` unmounts this chrome, and the sheet with it, so
   * a sheet asked to close the window would vanish mid-animation instead of
   * sliding away. It is also what iOS does: the sheet leaves, then the thing
   * happens.
   */
  const run = (action?: () => void) => {
    closeMenu();
    if (!action) return;
    if (shape === "sheet") window.setTimeout(action, SURFACE_TRANSITION_MS);
    else action();
  };

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

  // Per-window dispatch the DOTS array keys into by `action`.
  const dotAction = { close, minimize, zoom: toggleMaximize };

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
          // Two states, kept mutually exclusive so light/dark utilities never
          // fight on specificity:
          interacting
            ? // Interacting (drag / menu open) → glass, on either platform.
              "border-black/10 bg-white/80 shadow-raised backdrop-blur-xl dark:border-white/14 dark:bg-black/60"
            : cn(
                // Idle → fully transparent (both platforms).
                "border-transparent bg-transparent shadow-none",
                // …except desktop hover, which lights the glass. `hover:` (not
                // group-hover) since this element *is* the group.
                "[@media(hover:hover)]:hover:border-black/10 [@media(hover:hover)]:hover:bg-white/80 [@media(hover:hover)]:hover:shadow-raised [@media(hover:hover)]:hover:backdrop-blur-xl",
                "dark:[@media(hover:hover)]:hover:border-white/14 dark:[@media(hover:hover)]:hover:bg-black/60",
              ),
        )}
      >
        {/* Dots grouped so the title never adds a gap at rest (mobile symmetry).
            Order is load-bearing (close · minimize · zoom, like macOS). */}
        <div className="flex items-center gap-[5px] [@media(hover:hover)]:gap-2">
          {DOTS.map((dot) => (
            <Dot
              key={dot.label}
              active={focused}
              interacting={interacting}
              colorHover={dot.colorHover}
              label={dot.label}
              onClick={() => dotAction[dot.action](win.id)}
              glyph={dot.glyph}
            />
          ))}
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
          {title}
        </span>
      </div>

      {/* Touch: the menu as an action sheet, content height, from the bottom
          edge. It is portaled, scrimmed and stacked by the surface system
          (z-60, over the window layer and its iframes), which also brings a
          palette or devtool sheet underneath it a step back. */}
      {shape === "sheet" && (
        <SurfaceSheet
          id={`window-menu-${win.id}`}
          open={menuOpen}
          onOpenChange={(open) => {
            if (!open) closeMenu();
          }}
          modal
          height="auto"
          label={title}
          className="system-chrome"
        >
          <WindowMenuBody win={win} shape="sheet" run={run} />
        </SurfaceSheet>
      )}

      {/* Desktop: the popover, portaled to <body> so its scrim covers
          everything (incl. iframes) and it's never clipped by the window.
          WindowChrome only ever renders client-side (windows open on
          interaction), so `document` is always present here. */}
      {shape === "popover" &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {menuOpen && anchor && (
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
                  style={{ left: anchor.left, top: anchor.top, transformOrigin: anchor.origin }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={cn(
                    "fixed z-[56] w-52 select-none p-1",
                    "rounded-2xl border border-black/8 dark:border-white/12",
                    "bg-white/90 shadow-overlay backdrop-blur-xl dark:bg-neutral-900/90",
                  )}
                >
                  <WindowMenuBody win={win} shape="popover" run={run} />
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
