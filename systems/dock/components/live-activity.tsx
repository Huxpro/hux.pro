"use client";

import { cn } from "@/lib/utils";
import {
  SurfaceViewport,
  surfaceMotionVars,
  useSurfaceStack,
} from "@/systems/surface";
import { Drawer } from "@base-ui/react/drawer";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect } from "react";
import { useDock } from "../provider";

// ---------------------------------------------------------------------------
// LiveActivity — the shared collapsed-pill ⇄ expanded-panel morph.
//
// This is the canonical "Global Player" UI, extracted so every dock activity
// (music, ambient phase changes, …) is visually identical. Callers supply only
// the *content*:
//   • `pill`   — leading content of the collapsed pill (icon, art, EQ bars…)
//   • `title`  — left side of the expanded panel header
//   • children — the expanded panel body
//
// The panel is a Base UI Drawer travelling UP, the mirror of the phone sheet in
// systems/surface: the Dynamic Island metaphor is anchored at the top and puts
// itself away upwards, the opposite of a sheet. Everything the dock used to
// hand-write — the drag, the enter/exit animation, the scrim, Escape — is the
// library's now, or CSS ("Dock panel motion" in globals.css). What stays here
// is what Base UI has no opinion about: which activity is open (provider.tsx),
// and that a panel steps back when a sheet rises over it (the shared surface
// stack).
//
// Two things the drawer brought that the hand-written panel could not:
//
//   Pull to expand.  `Drawer.SwipeArea` wraps the pill, so dragging DOWN from
//   it opens the panel and the panel follows the finger the whole way — iOS's
//   Notification Center, rather than a pill you may only tap.
//
//   Stacking.  The panel registers in the shared surface stack (stack.ts), so
//   it is no longer the one overlay on the site that does not know about the
//   others. A palette opened over it — from the keyboard; a press on the FAB
//   is an outside press and dismisses instead — sends it back a step and makes
//   it inert, and a panel opened over the playlist sheet sends that back
//   instead. The same step the palette takes when the wallpaper picker rises
//   over it.
//
// See docs/system-dock.md for what was measured on the way here, including the
// two capabilities that were tried and left out.
// ---------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// BEFORE CHANGING THIS FILE, OR THE "Dock panel motion" BLOCK IN globals.css:
// read the "BEFORE CHANGING THIS FILE" list at the top of
// systems/surface/sheet.tsx. Every item on it applies here too — this is the
// same library, the same data attributes, the same custom properties. Five
// things are specific to this panel, and each was found the hard way — four of
// them by reading Base UI 1.8's source rather than its types, the fourth by
// looking at the thing move and measuring it:
//
// 1. A dismiss drag and a `Drawer.SwipeArea` drag move the popup by different
//    means. The dismiss drag writes an inline `transform` on the popup
//    (useSwipeDismiss's `getDragStyles`), which beats every rule in the
//    stylesheet; the swipe area writes only `--drawer-swipe-movement-y` and
//    inlines `transition: none`, so the CSS has to do the moving. That is why
//    the swiping rule in globals.css exists, and why it is scoped to
//    `[data-starting-style]` — on the frame a dismiss is released the popup
//    carries `data-swiping` and `data-ending-style` at once, and a rule that
//    pinned it to the finger there would strand it instead of letting it go.
// 2. `--drawer-snap-point-offset` is sign-corrected for `up` (DrawerPopup.js),
//    but the live drag is not: the damped-movement branch in DrawerPopup.js and
//    the progress maths in DrawerViewport.js are both written `swipeDirection
//    === 'down'`. Detents on a top drawer settle correctly and drag wrong. We
//    have none for that reason; see docs/system-dock.md.
// 3. `Drawer.SwipeArea` renders `role="presentation" aria-hidden`, which would
//    take the pill button out of the accessibility tree with it. It is a
//    wrapper here, not an overlay — an overlay would eat the tap — and it opts
//    back in with `aria-hidden={false}`. `role="presentation"` on a plain div
//    changes nothing and stays.
// 4. Opacity belongs ON the glass, never on a box that contains it. An element
//    at `opacity < 1` is its own backdrop root, so a `backdrop-filter` *inside*
//    it samples that empty group instead of the page and the glass is not there
//    at all while the animation runs; on the element that carries the blur the
//    same opacity is fine, because its own backdrop resolves before its opacity
//    applies. A fade on the popup made the panel see-through on the way in, the
//    page's text legible through it, unblurred — shipped and reverted. A/B'd at
//    the same opacity on the same frame: on the shell the text behind it is
//    blurred, on the popup it is sharp. So the popup, which holds no glass,
//    carries the transform, and the fades sit one level down on the shell and
//    on the pill, which are the glass.
// 5. The panel's closed transform may scale but must not translate. Base UI
//    measures how far "closed" is by reading the popup's transform when a
//    `Drawer.SwipeArea` drag starts (`resolveClosedOffset`, `min(height,
//    |translateY|)`) — and it reads it *before* it marks the popup as swiping,
//    so it sees the closed rule in globals.css. A `translateY(-10px)` there
//    told it the panel was ten pixels from open: a pull that should track the
//    finger down a whole panel height tracked ten pixels and then overshot
//    (measured `--drawer-swipe-movement-y` of +12px where −170 was due). A pure
//    `scale()` leaves the transform's Y at zero and the measurement falls
//    through to the panel's height.
// -----------------------------------------------------------------------------

/** Where the panel's top edge sits: the status bar, or the dock row's own gap. */
const TOP_INSET = "max(env(safe-area-inset-top), 0.5rem)";

interface LiveActivityProps {
  /** Stable id; the Dock allows only one activity open at a time. */
  id: string;
  /** Leading content inside the collapsed pill (before the chevron). */
  pill: React.ReactNode;
  /** Panel header content (left side, before the collapse chevron). */
  title: React.ReactNode;
  /** Panel body. */
  children: React.ReactNode;
  /** aria-label for the collapsed pill button. */
  openLabel: string;
  /** aria-label for the collapse button. */
  collapseLabel: string;
  /** Extra classes for the collapsed pill. */
  pillClassName?: string;
  /** Extra classes for the expanded panel (e.g. widget-matched radius). */
  panelClassName?: string;
}

export function LiveActivity({
  id,
  pill,
  title,
  children,
  openLabel,
  collapseLabel,
  pillClassName,
  panelClassName,
}: LiveActivityProps) {
  const { isOpen, isAnyOpen, open, close, registerActivity } = useDock();
  const expanded = isOpen(id);

  // If this activity unmounts while expanded (e.g. its time window passes),
  // collapse the dock so the pill-hiding doesn't get stuck.
  useEffect(() => registerActivity(id), [id, registerActivity]);

  // One entry for the dock, not one per activity: only ever one is expanded,
  // and what the other surfaces care about is "the dock panel is up".
  const { behind, depth } = useSurfaceStack("dock-activity", expanded);

  return (
    <Drawer.Root
      open={expanded}
      onOpenChange={(next) => (next ? open(id) : close())}
      // Up, not down. The panel is anchored at the top and puts itself away
      // over the top edge; a sheet does the mirror of this.
      swipeDirection="up"
      // No focus trap and no scroll lock — a Live Activity is a notification,
      // not a launcher, and the page behind it goes on. Pointer dismissal
      // stays ON, unlike the secondary surfaces (see AdaptiveSurface for why
      // theirs is off): a press anywhere else puts the notification away,
      // which is what the dock's own transparent scrim used to do.
      modal={false}
    >
      {/* Collapsed pill — a flex item in the dock row, and the drawer's
          trigger. It stays mounted while a panel is open so the row keeps its
          layout; it just goes invisible and stops taking pointers, because the
          open panel should stand alone. */}
      <Drawer.SwipeArea
        // See note 3 above: the wrapper is presentational, the button inside
        // it is not.
        aria-hidden={false}
        data-dock-pill=""
        data-hidden={isAnyOpen ? "" : undefined}
        className="shrink-0"
      >
        <Drawer.Trigger
          className={cn(
            "pointer-events-auto flex items-center gap-2 shrink-0",
            "h-9 pl-1.5 pr-2.5 rounded-full",
            "border border-border/50 bg-glass backdrop-blur-xl",
            "shadow-raised",
            "hover:border-border hover:bg-glass-hover transition-colors",
            "pressable active:border-border active:bg-glass-hover active:scale-95",
            pillClassName
          )}
          aria-label={openLabel}
        >
          {pill}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </Drawer.Trigger>
      </Drawer.SwipeArea>

      <Drawer.Portal>
        {/* The same full-screen box the sheets use, so the bezel knows about
            this layer. Non-modal, so it never walls the page off — which is
            the one place the drawer does not replicate the old dock: the
            transparent scrim used to eat every press, so with a panel open the
            command palette's FAB could not be reached. Now the press both
            dismisses the panel (Base UI's outside press) and lands where it
            was aimed, the way it does under every other surface on the site.
            Measured with the scrim kept as a pointer-taking viewport: the FAB
            went unreachable, which is why it is not one. */}
        <SurfaceViewport modal={false}>
          <Drawer.Popup
            data-dock-panel=""
            style={{ ...surfaceMotionVars(TOP_INSET), top: TOP_INSET }}
            // A positioning box only, centred without a transform so the drag
            // has the axis to itself. Nothing paints here; the shell inside does.
            className={cn(
              "pointer-events-auto absolute inset-x-0 z-[61] mx-auto",
              "w-[min(92vw,360px)] bg-transparent outline-none"
            )}
          >
            <div
              data-surface-shell
              data-behind={behind ? "" : undefined}
              // React 19 renders `inert` as the boolean attribute.
              inert={behind}
              // Sheets from other subtrees stacked on this one.
              style={{ "--surface-stack-depth": depth } as React.CSSProperties}
              className={cn(
                "relative origin-top overflow-hidden",
                "rounded-2xl border border-border/50 bg-glass shadow-overlay backdrop-blur-xl",
                // The dim on a receded panel is a wash over the shell rather
                // than an opacity, so the glass stays glass.
                "after:pointer-events-none after:absolute after:inset-0 after:bg-black/0 after:transition-colors after:[transition-duration:var(--surface-duration)]",
                behind && "after:bg-black/15 dark:after:bg-black/30",
                panelClassName
              )}
            >
              {/* Everything above the grabber is content, not a handle: a mouse
                  press inside it is a press on the close button or a transport
                  control, never the start of a drag. Without this, the drawer
                  takes the pointer on press and the click never reaches what
                  was pressed. A touch drag still works anywhere. */}
              <Drawer.Content>
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                  <Drawer.Title
                    render={<div className="flex items-center gap-2 min-w-0" />}
                  >
                    {title}
                  </Drawer.Title>
                  <Drawer.Close
                    className="-mr-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
                    aria-label={collapseLabel}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Drawer.Close>
                </div>

                {/* Body is padding-agnostic — each activity supplies content
                    that already carries its own padding (a <NowPlaying />
                    wrapper, a full weather card, …) so the panel can host any
                    widget body. */}
                {children}
              </Drawer.Content>

              {/* Grabber — swipe up to collapse. Outside Drawer.Content, so a
                  mouse drag on it is a drag. */}
              <div className="flex justify-center pb-2">
                <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
              </div>
            </div>
          </Drawer.Popup>
        </SurfaceViewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
