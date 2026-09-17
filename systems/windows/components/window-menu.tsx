"use client";

import { APP_ICONS, iconFillsTile } from "@/lib/apps";
import { appTitle, resolveAppIconSrc, runtimeLabel } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { SURFACE_TRANSITION_MS, SurfaceSheet } from "@/systems/surface";
import {
  Check,
  ExternalLink,
  Maximize2,
  Minus,
  Monitor,
  RotateCw,
  Smartphone,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SizePreset } from "../lib/geometry";
import type { WindowInstance } from "../lib/types";
import { useWindows } from "../provider";

// =============================================================================
// The window menu — one list of actions, three containers
//
// What a window offers (which app this is · how big · open in browser ·
// minimize · close) is one thing; where it is offered is three:
//
//   • a popover under the pill            — a pointer device (window-chrome)
//   • an action sheet from the bottom     — touch, on a windowed window
//   • the same sheet, nested in the window — touch, where the window IS a sheet
//
// So the rows live here, in `WindowMenuBody`, and each container is a shell
// around them. `WindowMenuSheet` is the sheet form of it, shared by the last
// two: content height, modal (a menu dismisses on a tap outside, as a popover
// does), and a selection that dismisses the sheet *before* it acts — `close`
// unmounts the window, and with it a sheet that would otherwise vanish
// mid-animation. It is also what iOS does.
//
// Size presets are a windowing idea. Where the window is a sheet, its size is
// the detent the finger left it at, so the menu drops those rows (`presets`)
// rather than offering three that would do nothing.
// =============================================================================

const PRESET_META: Record<SizePreset, { label: string; Icon: LucideIcon }> = {
  portrait: { label: "Portrait", Icon: Smartphone },
  landscape: { label: "Landscape", Icon: Monitor },
  max: { label: "Maximize", Icon: Maximize2 },
};

/** The menu's two shapes: a desktop popover, a touch action sheet. */
export type MenuShape = "popover" | "sheet";

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
export function WindowMenuBody({
  win,
  shape,
  presets = true,
  run,
}: {
  win: WindowInstance;
  shape: MenuShape;
  /** Offer the size presets. Off where the detent is the size (see above). */
  presets?: boolean;
  /** Take the menu away, then do this. */
  run: (action?: () => void) => void;
}) {
  const { close, minimize, reload, setSizePreset } = useWindows();
  const { locale } = useLocale();
  const sheet = shape === "sheet";
  const title = appTitle(win.app, locale);
  const src = resolveAppIconSrc(win.app, APP_ICONS);
  // Full-bleed icons bring their own ground; a glyph needs a plate under it,
  // the same rule the dock pill and the home tile follow.
  const fills = iconFillsTile(APP_ICONS[win.app.id]);
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
            className={cn(
              "rounded-[7px]",
              fills ? "object-cover" : "bg-white object-contain p-0.5",
              sheet ? "h-9 w-9" : "h-7 w-7",
            )}
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

      {presets && (
        <>
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
        </>
      )}

      {/* Restart the app. A remount, since a cross-origin iframe and a Lynx
          runtime both refuse to be told anything from out here. */}
      <MenuItem shape={shape} Icon={RotateCw} onSelect={() => run(() => reload(win.id))}>
        Reload
      </MenuItem>
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

/**
 * The menu as a sheet: content height, modal, and a selection that lands after
 * the sheet has gone. `nestedIn` names the window's own sheet when there is one
 * — Base UI then treats this as a real nested drawer and sends the window a
 * step back under it, the way iOS presents a sheet from a sheet.
 */
export function WindowMenuSheet({
  win,
  nestedIn,
  open,
  onClose,
  presets,
}: {
  win: WindowInstance;
  nestedIn?: string;
  open: boolean;
  onClose: () => void;
  presets?: boolean;
}) {
  const { locale } = useLocale();
  const title = appTitle(win.app, locale);

  return (
    <SurfaceSheet
      id={`window-menu-${win.id}`}
      nestedIn={nestedIn}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      modal
      height="auto"
      label={title}
      className="system-chrome"
    >
      <WindowMenuBody
        win={win}
        shape="sheet"
        presets={presets}
        run={(action) => {
          onClose();
          if (action) window.setTimeout(action, SURFACE_TRANSITION_MS);
        }}
      />
    </SurfaceSheet>
  );
}
