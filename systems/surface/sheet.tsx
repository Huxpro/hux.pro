"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { BEZEL_LAYER_ATTRIBUTE } from "@hux/bezel";
import {
  SURFACE_EASING,
  SURFACE_RECEDE_EASING,
  SURFACE_TRANSITION_MS,
  useSurfaceStack,
} from "./stack";

// =============================================================================
// SurfaceSheet — the bottom sheet every phone surface is made of.
//
// One Base UI Drawer. <AdaptiveSurface> composes it for the wallpaper picker
// and the playlist (adding its title bar and scroll area); the command palette
// composes it directly, because a palette's header is its search field, not a
// title. Both get the same glass shell, the same grabber, the same edge gaps,
// and the same stacking behaviour — so a sheet is a sheet whatever it holds.
//
// Two boxes, not one. `Drawer.Popup` is a transparent positioning box the full
// height of the sheet's travel; the glass shell is the flex child inside it.
// The split is what lets a *floating* sheet have detents: Base UI moves the
// popup by translating it, so at a lower detent the popup's bottom — and the
// shell's rounded corners with it — would sit below the screen. The popup
// carries the same offset as bottom padding, so the shell it holds stays
// planted a gap above the bottom edge at every detent, and grows and shrinks
// from the top as a floating sheet should. Past the lowest detent the padding
// stops (`--surface-detent-floor`) and the sheet slides away whole, because
// that drag is a dismissal, not a resize. The motion is in globals.css, under
// "Secondary surface motion"; everything it reads comes from Base UI on the
// popup, so nothing here has to measure anything.
//
// Two things a phone sheet does that the other shapes never need:
//
//   Snap points.  `snapPoints={[0.7, 1]}` opens the sheet at seven tenths of
//   the screen and lets a drag carry it to the top — the iOS medium / large
//   detents.
//
//   Stacking.  A sheet opened over another one sends the one underneath back a
//   step per sheet — smaller, dimmer, a little higher, inert — and brings it
//   forward again as they go. That is what iOS does when a sheet presents a
//   sheet. Base UI counts the sheets nested in this one (React children) on the
//   popup, live with their swipe; the shared stack (stack.ts) counts the ones
//   from other subtrees; the shell adds the two.
//
// `modal` is off by default (see AdaptiveSurface for why: these surfaces are
// about the page behind them, which stays live). A launcher like the command
// palette turns it on, and then the viewport — a transparent, full-screen box
// that already contains the popup — takes the page away and dismisses on a
// press, the same click-away its desktop popover has. Base UI's scroll lock is
// safe here in a way Radix's was not: on iOS it only sets `overflow: hidden` on
// whichever element scrolls the viewport, and it stands down entirely when that
// element is already locked — which is exactly the state @hux/bezel leaves the
// page in during container scroll.
// =============================================================================

// -----------------------------------------------------------------------------
// BEFORE CHANGING THIS FILE, OR THE "Secondary surface motion" BLOCK IN
// globals.css: read Base UI's Drawer docs and its nested demo, and the source
// behind the part you are touching. The library hands every visual to CSS and
// publishes its state as data attributes and custom properties; those are the
// contract, and its types do not describe their meaning. What has already gone
// wrong by guessing, each a bug shipped and reverted:
//
//   https://base-ui.com/react/components/drawer
//   node_modules/@base-ui/react/drawer/{popup,viewport}/*.js
//   node_modules/@base-ui/react/internals/useAnimationsFinished.js
//
// 1. `--drawer-swipe-progress` means two things. Without snap points it is
//    the fraction of the way out; with them it is the position BETWEEN the
//    detents, already 1 at the lowest one. A sheet whose parent must follow
//    its swipe cannot have detents (DrawerViewport.js, `offsetToProgress`).
// 2. `--drawer-swipe-movement-*`, `--drawer-snap-point-offset`,
//    `--drawer-swipe-progress` and `--drawer-swipe-strength` are registered
//    `inherits: false` (DrawerPopup.js). A descendant reads them only with an
//    explicit `--name: inherit`.
// 3. An exit is over when `popup.getAnimations()` is empty one frame after
//    `data-ending-style` lands (useAnimationsFinished.js). Never leave the
//    popup with `transition: none` on that frame: on release it can be
//    swiping and leaving at once, and a leaving rule that only restores a
//    duration has no property to run on. Drop the duration, keep the property.
// 4. Nesting is React nesting. A drawer is nested only when its Root renders
//    inside another's Popup; the parent then gets `data-nested-drawer-open`,
//    `data-nested-drawer-swiping` and `--nested-drawers`. Sheets in sibling
//    subtrees get none of it — that is what stack.ts is for, and a nested
//    sheet says so (`nestedIn`) so the stack does not count it a second time.
// 5. A closing dialog returns focus to what opened it. Where that is a text
//    field on a touch device, turn it off (`restoreFocus`): iOS opens the
//    keyboard for an already-focused field on the next touch anywhere.
// 6. Every gesture path is its own test: a `.click()` proves nothing about a
//    touch tap, a touch tap nothing about a swipe release, and a programmatic
//    `focus()` is a third thing again.
// 7. A swipe never starts from `button,a,input,select,textarea,label,
//    [role="button"]` — `DEFAULT_IGNORE_SELECTOR` in
//    utils/useSwipeDismiss.js, checked for mouse and touch alike. A control
//    that has to be draggable (the window grip) cannot wear those roles; give
//    it a visually hidden button beside it for the semantics.
// 8. Once a press becomes a swipe the popup captures the pointer and the rest
//    of the stream never reaches you: no move, no up — and out here, above
//    `Drawer.Content`, no click at all, even for a plain tap. Anything that
//    listens for a tap on the grabber has to treat "the release came back to
//    us" as the signal, and ask the popup (`--drawer-swipe-movement-y`)
//    whether the surface moved. A timer armed on press will otherwise fire
//    in the middle of a drag.
// -----------------------------------------------------------------------------

/**
 * The site's detents, iOS's medium and large near enough. One set, so sheets
 * stacked on one another stand level: a sheet with detents opens at the detent
 * of the sheet beneath it (see `useSurfaceStack`), and at the first otherwise.
 */
export const SHEET_DETENTS = [0.7, 1];

/** Ring of padding between a floating surface and the screen edges. */
export const EDGE_GAP = "0.75rem";

/** Room a full-height sheet leaves above itself: the status bar, or the gap. */
const TOP_INSET = `max(env(safe-area-inset-top), ${EDGE_GAP})`;

/** Room below a sheet without detents: the home indicator, or the gap. */
const BOTTOM_INSET = `max(env(safe-area-inset-bottom), ${EDGE_GAP})`;

/** A detent as a CSS length: a fraction of the viewport, or pixels. */
const detentLength = (point: number) =>
  point <= 1 ? `${point * 100}dvh` : `${point}px`;

/**
 * The height a sheet without detents needs to stand where a sheet with them
 * stands at `point`, so a sheet stacked on one lands level with it. The top
 * detent leaves the top inset; any other leaves the edge gap under the shell.
 */
export function detentHeight(point: number): string {
  return point >= 1
    ? `calc(100dvh - ${TOP_INSET} - ${EDGE_GAP})`
    : `calc(${detentLength(point)} - ${EDGE_GAP})`;
}

/** An icon button in a surface header: close, back, an external link. */
export const HEADER_BUTTON =
  "shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground active:scale-[0.92] active:bg-accent/60";

/** The glass shell every shape shares. */
export const SHELL = [
  "flex flex-col overflow-hidden outline-none",
  "rounded-3xl bg-glass-sheet backdrop-blur-xl",
  "border border-border/50 shadow-overlay",
].join(" ");

/**
 * What the CSS in globals.css needs from here: the site's surface curves, and
 * how far past the edge a surface has to travel to be gone. Set on the popup so
 * the timing lives in one place (stack.ts).
 */
export const surfaceMotionVars = (exitClearance: string) =>
  ({
    "--surface-gap": EDGE_GAP,
    "--surface-exit": exitClearance,
    "--surface-duration": `${SURFACE_TRANSITION_MS}ms`,
    "--surface-easing": SURFACE_EASING,
    "--surface-recede-easing": SURFACE_RECEDE_EASING,
  }) as React.CSSProperties;

/**
 * The full-screen box a drawer's popup sits in, shared by the sheet and the
 * panel. Modal: this box is the scrim — invisible, the page stays in view but
 * stops answering, and a press on it dismisses, because Base UI reads a press
 * on the popup's container as an outside press. Non-modal: it must not be a
 * wall over the page, so only the popup inside takes pointers.
 *
 * Base UI portals into a wrapper of its own, so this is not a `body > .fixed`
 * the bezel would catch by itself. Marked as a fixed layer: in container
 * scroll it becomes absolute inside the fixed <body> (the identical box), and
 * never spans the edge Safari samples its chrome colour from.
 */
export function SurfaceViewport({
  modal,
  children,
}: {
  modal: boolean;
  children: React.ReactNode;
}) {
  return (
    <Drawer.Viewport
      {...{ [BEZEL_LAYER_ATTRIBUTE]: "" }}
      className={cn("fixed inset-0 z-[60]", !modal && "pointer-events-none")}
    >
      {children}
    </Drawer.Viewport>
  );
}

export interface SurfaceSheetProps {
  /** Stable id — the sheet's key in the surface stack. */
  id: string;
  /**
   * The id of the sheet this one renders inside, when it does. Base UI counts
   * a nested sheet on its parent already, live with its swipe; naming the
   * parent keeps the shared stack from counting it again.
   */
  nestedIn?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Take the page away: a transparent scrim blocks it, and a tap on the scrim
   * dismisses. Off by default — secondary surfaces leave the page live.
   */
  modal?: boolean;
  /**
   * Detents as fractions of the viewport, lowest first. Opens at the detent of
   * the sheet it is stacked on when that is one of them, else at the first.
   * Omit for a fixed-height sheet.
   */
  snapPoints?: number[];
  /** Controlled active detent, for a sheet that wants to move itself. */
  activeSnapPoint?: number | string | null;
  onActiveSnapPointChange?: (snapPoint: number | string | null) => void;
  /**
   * Height without snap points. Default 80dvh. `"auto"` (or `"fit-content"`)
   * is content height — the sheet is as tall as what is in it, up to the
   * screen: an action sheet, rather than a surface with a size of its own.
   */
  height?: string;
  /**
   * For a fixed-height sheet: the detent it stands level with, so a sheet
   * with detents stacked on it can arrive level too.
   */
  level?: number;
  /**
   * Return focus to what opened the sheet when it closes. On by default; a
   * sheet stacked on one with a text field turns it off — focus handed back
   * to a field is a focused field with no keyboard, and iOS opens the keyboard
   * on the next touch anywhere, whatever it was aimed at.
   */
  restoreFocus?: boolean;
  /**
   * Keep the sheet's DOM alive while it is closed (Base UI hides the popup
   * rather than unmounting it). For a sheet whose content must keep running
   * when it is put away — an app window, whose iframe or Lynx view would
   * otherwise reload and lose its state.
   */
  keepMounted?: boolean;
  /**
   * The affordance at the top of the shell. Defaults to the plain grabber;
   * a sheet whose handle says more than "drag me" — the window grip, which is
   * also its menu button — passes its own. It sits outside `Drawer.Content`,
   * so a *mouse* press on it starts a drag like the grabber it replaces.
   */
  grip?: React.ReactNode;
  /**
   * Float the grip over the content instead of giving it a row of its own, so
   * the sheet is edge-to-edge under it. For a sheet holding something that is
   * not a document — an app window, whose chrome has always been a pill over
   * its content and never a title bar.
   */
  gripOverlay?: boolean;
  /**
   * Accessible name for the dialog, rendered visually hidden. Omit when the
   * content renders a visible `Drawer.Title` of its own.
   */
  label?: string;
  className?: string;
  children: React.ReactNode;
}

export function SurfaceSheet({
  id,
  nestedIn,
  open,
  onOpenChange,
  modal = false,
  snapPoints,
  activeSnapPoint,
  onActiveSnapPointChange,
  height,
  level: levelProp,
  restoreFocus = true,
  keepMounted,
  grip,
  gripOverlay,
  label,
  className,
  children,
}: SurfaceSheetProps) {
  const hasSnapPoints = !!snapPoints && snapPoints.length > 0;
  // Content height: the popup stops constraining the shell and the shell stops
  // filling the popup, so the sheet is exactly as tall as what it holds. Safe
  // under the padding-as-travel geometry above, which only applies to a sheet
  // with detents — this one has none, and travels by transform alone.
  const fitsContent = height === "auto" || height === "fit-content";

  // The detent, controlled by the owner when it says so, else kept here.
  const isControlled = activeSnapPoint !== undefined;
  const [ownSnap, setOwnSnap] = useState<number | string | null>(
    snapPoints?.[0] ?? null
  );
  const snap = isControlled ? activeSnapPoint : ownSnap;
  const level = hasSnapPoints
    ? typeof snap === "number"
      ? snap
      : undefined
    : levelProp;

  const { behind, depth, beneathLevel } = useSurfaceStack(id, open, {
    nestedIn,
    level,
  });

  // Arrive level with the sheet beneath, when it stands at one of ours.
  const arrival =
    hasSnapPoints && beneathLevel !== undefined && snapPoints.includes(beneathLevel)
      ? beneathLevel
      : (snapPoints?.[0] ?? null);
  useEffect(() => {
    if (!open || isControlled || !hasSnapPoints) return;
    setOwnSnap(arrival);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once, on open
  }, [open]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="down"
      modal={modal}
      // A non-modal surface leaves the page live, and a press on a live page
      // belongs to the page: the close button, Escape and a drag dismiss.
      disablePointerDismissal={!modal}
      snapPoints={snapPoints}
      snapPoint={hasSnapPoints ? snap : undefined}
      // Only a change is a change. Every touch on a Base UI drawer ends in a
      // release that re-reports the detent it landed on, so a tap into a
      // field would otherwise reach the owner as "back to where you were"
      // in the same breath as the focus — and undo whatever the focus asked
      // for. A controlled prop's onChange should not fire for its own value.
      onSnapPointChange={(point) => {
        if (point === snap) return;
        if (!isControlled) setOwnSnap(point);
        onActiveSnapPointChange?.(point);
      }}
    >
      {/* iOS's keyboard, handled once for every sheet: the provider publishes
          `--drawer-keyboard-inset`, and the shell rests on top of the keyboard
          rather than behind it. A sheet with no fields never notices. */}
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal keepMounted={keepMounted}>
          <SurfaceViewport modal={modal}>
            <Drawer.Popup
              finalFocus={restoreFocus ? undefined : false}
              data-surface-popup=""
              data-surface-snap={hasSnapPoints ? "" : undefined}
              style={{
                ...surfaceMotionVars(hasSnapPoints ? EDGE_GAP : BOTTOM_INSET),
                ...(hasSnapPoints
                  ? {
                      // Flush with the bottom and as tall as the top detent.
                      // The gap below the shell is the popup's bottom padding,
                      // which also carries the snap offset (see above).
                      bottom: 0,
                      height: `calc(100dvh - ${TOP_INSET})`,
                      // How far the shell may be held back before a drag stops
                      // resizing it and starts throwing it away: the offset of
                      // the lowest detent.
                      "--surface-detent-floor": `calc(100dvh - ${TOP_INSET} - ${detentLength(
                        snapPoints[0]
                      )})`,
                    }
                  : {
                      bottom: BOTTOM_INSET,
                      height: fitsContent ? "auto" : (height ?? "80dvh"),
                      // Content height still stops at the screen.
                      ...(fitsContent && {
                        maxHeight: `calc(100dvh - ${TOP_INSET} - ${BOTTOM_INSET})`,
                      }),
                    }),
              }}
              // The positioning box only, so nothing paints outside the shell.
              className="pointer-events-auto absolute inset-x-3 z-[61] flex flex-col bg-transparent outline-none"
            >
              {label && <Drawer.Title className="sr-only">{label}</Drawer.Title>}
              <div
                data-surface-shell
                data-behind={behind ? "" : undefined}
                // React 19 renders `inert` as the boolean attribute.
                inert={behind}
                // Sheets from other subtrees stacked on this one; the CSS adds
                // Base UI's count of nested ones.
                style={{ "--surface-stack-depth": depth } as React.CSSProperties}
                className={cn(
                  SHELL,
                  // Positioned: the receded wash and a floating grip both
                  // anchor to the shell, not to the popup's travel box.
                  "relative min-h-0 origin-top",
                  // Fill the popup, unless the popup is taking its height from
                  // this shell — then a `flex-1` basis of zero is a race the
                  // content loses.
                  !fitsContent && "flex-1",
                  // The dim on a receded sheet is a wash over the shell rather
                  // than an opacity, so the glass stays glass.
                  "after:pointer-events-none after:absolute after:inset-0 after:bg-black/0 after:transition-colors after:[transition-duration:var(--surface-duration)]",
                  behind && "after:bg-black/15 dark:after:bg-black/30",
                  className
                )}
              >
                {/* Grabber — the affordance for drag-to-dismiss and the detents.
                    A sheet can hand in its own (`grip`); either way it lives
                    here, above Drawer.Content, so a mouse press on it is a
                    drag. Floating, it takes no room and only the grip itself
                    takes pointers, so the content runs under it edge to edge. */}
                <div
                  className={cn(
                    "flex justify-center pt-2",
                    gripOverlay
                      ? "pointer-events-none absolute inset-x-0 top-0 z-20"
                      : "shrink-0",
                  )}
                >
                  {grip ?? (
                    <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
                  )}
                </div>
                {/* Everything below the grabber is content, not a handle: a
                    mouse press inside it is a press on a row, never the start
                    of a drag. Without this, the drawer takes the pointer on
                    press and the click never reaches what was pressed. A touch
                    drag still works anywhere — Base UI reads the scroll
                    containers for that. Transparent to layout so the content
                    keeps the shell's flex column. */}
                <Drawer.Content className="flex min-h-0 flex-1 flex-col">
                  {children}
                </Drawer.Content>
              </div>
            </Drawer.Popup>
          </SurfaceViewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
