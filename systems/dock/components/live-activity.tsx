"use client";

import { cn } from "@/lib/utils";
import {
  SurfaceViewport,
  surfaceMotionVars,
  useSurfaceStack,
} from "@/systems/surface";
import { Drawer } from "@base-ui/react/drawer";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
// Three things the drawer brought that the hand-written panel could not:
//
//   The morph.  The panel does not slide in from the top edge like a drawer.
//   It GROWS out of the pill: on open, the glass shell is clipped down to the
//   pill's own rectangle and the clip opens to the full panel, so the pill
//   appears to become the panel — the Dynamic Island, which is the metaphor
//   the dock has always claimed. The corner opens out with the box: 18px at the
//   pill, `--dock-radius` at the panel, one `inset()` interpolating into the
//   next. See `measureMorph` below and "Dock panel motion" in globals.css.
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
// same library, the same data attributes, the same custom properties. Six
// things are specific to this panel, and each was found the hard way — four of
// them by reading Base UI 1.8's source rather than its types, the other two by
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
// 5. The morph is `clip-path`, not a scale. Scaling the shell would scale what
//    its `backdrop-filter` samples, so the page behind it would appear to zoom
//    for half a second; a clip leaves the glass sampling the page at 1:1 and
//    only changes how much of it you can see. Measured: `clip-path` and
//    `backdrop-filter` on the same element are fine together — it is an
//    ANCESTOR that breaks the backdrop (note 4), not the element's own clip.
// 6. If the popup's closed transform ever comes back, it may scale but must not
//    translate. Base UI measures how far "closed" is by reading the popup's
//    transform when a `Drawer.SwipeArea` drag starts (`resolveClosedOffset`,
//    `min(height, |translateY|)`) — and it reads it *before* it marks the popup
//    as swiping, so it sees the closed rule in globals.css. A `translateY(-10px)`
//    there told it the panel was ten pixels from open: a pull that should track
//    the finger down a whole panel height tracked ten pixels and then overshot
//    (measured `--drawer-swipe-movement-y` of +12px where −170 was due). The
//    morph sidesteps this by leaving the popup's entrance transform at `none`
//    altogether, which is also why the pop it replaced is gone rather than
//    scoped — see the note on that rule in globals.css.
// -----------------------------------------------------------------------------

/** Where the panel's top edge sits: the status bar, or the dock row's own gap. */
const TOP_INSET = "max(env(safe-area-inset-top), 0.5rem)";

/**
 * The pill's rectangle in the panel's own coordinates — the clip the morph
 * starts and ends at, as CSS custom properties the shell's `clip-path` reads.
 *
 * Returned rather than written: Base UI re-renders the popup several times on
 * its way open, and React reconciles the `style` prop each time, so custom
 * properties set imperatively on the node are wiped before the browser ever
 * resolves the starting style. Measured: the vars were gone by the starting
 * frame and the clip sat at `inset(0px)` — no morph at all. They have to be
 * part of what React renders.
 *
 * `null` means there is nothing to grow out of — no pill, or a zero rect from a
 * panel measured before layout. Then the vars are simply absent, the clip
 * resolves to `inset(0)`, and the panel appears without an entrance. That is
 * the degenerate case and it is unreachable in practice: a panel is only ever
 * opened from a pill, and the pill stays rendered the whole time it is up.
 */
function morphVars(
  panel: HTMLElement | null,
  pill: HTMLElement | null
): React.CSSProperties | null {
  if (!panel || !pill) return null;
  // `offset*` rather than `getBoundingClientRect`, and it matters: offsets are
  // layout, so they ignore any transform the panel happens to be carrying. The
  // panel's offset parent is the surface viewport, a `fixed inset-0` box, so
  // these are viewport coordinates and comparable with the pill's rect.
  //
  // Reading the panel's computed *transform* here was a bug: the read forces a
  // style recalc, and a recalc taken while the panel still looked like it
  // should travel latched `translateY(-100%)` as a transition start — so it
  // slid and morphed at once. Nothing here asks the panel what it looks like.
  const to = {
    top: panel.offsetTop,
    left: panel.offsetLeft,
    right: panel.offsetLeft + panel.offsetWidth,
    bottom: panel.offsetTop + panel.offsetHeight,
    width: panel.offsetWidth,
    height: panel.offsetHeight,
  };
  const from = pill.getBoundingClientRect();
  if (!to.width || !to.height || !from.width || !from.height) return null;
  const clamp = (n: number, max: number) => `${Math.max(0, Math.min(n, max))}px`;
  return {
    "--dock-morph-top": clamp(from.top - to.top, to.height),
    "--dock-morph-right": clamp(to.right - from.right, to.width),
    "--dock-morph-bottom": clamp(to.bottom - from.bottom, to.height),
    "--dock-morph-left": clamp(from.left - to.left, to.width),
  } as React.CSSProperties;
}

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

  // Where the morph starts and ends: the pill's rectangle, measured off the
  // live DOM because the pill can be anywhere in a scrolled dock row.
  //
  // A callback ref, not an effect. Base UI mounts the popup on a later commit
  // than the one that flips `expanded`, so an effect of ours keyed on
  // `expanded` finds no panel to measure — and one with no dependencies never
  // runs on Base UI's own commits at all. The ref fires the moment the node
  // attaches, and the state it sets is flushed before paint, so the starting
  // style the browser resolves is already the pill-sized clip.
  //
  // Measured once, on the way in, and reused on the way out: with a panel open
  // every pill is invisible and the row is behind it, so the rectangle it grew
  // out of is still the rectangle it should shrink back to.
  const pillRef = useRef<HTMLDivElement>(null);
  const [morph, setMorph] = useState<React.CSSProperties | null>(null);
  const measurePanel = useCallback((node: HTMLDivElement | null) => {
    setMorph(node ? morphVars(node, pillRef.current) : null);
  }, []);

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
        // The morph measures THIS box, not the button inside it: by the time
        // the panel attaches, the button is already fading and shrinking away
        // (see `[data-dock-pill][data-hidden] > *`), and its rect with it. The
        // wrapper never moves.
        ref={pillRef}
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
            ref={measurePanel}
            data-dock-panel=""
            // Set by the measurement, one flush after the panel attaches but
            // still before paint. Nothing keyed on its absence may animate, or
            // that is what the browser latches as the transition's start — an
            // earlier travel rule keyed this way made the panel slide AND
            // morph at once.
            data-dock-morph={morph ? "" : undefined}
            style={{ ...surfaceMotionVars(TOP_INSET), top: TOP_INSET, ...morph }}
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
              style={
                {
                  // Sheets from other subtrees stacked on this one.
                  "--surface-stack-depth": depth,
                  // What a rounded box sitting inside this panel's 20px margin
                  // should use for its own corner, so it is concentric with the
                  // panel's: the HIG's "match its corner radius to the outer
                  // corner radius ... by subtracting the margin". Published,
                  // not imposed — content opts in by reading it with its own
                  // value as the fallback (see <NowPlaying />), so nothing that
                  // is not inside a big corner is changed by it.
                  "--radius-concentric": "calc(var(--dock-radius) - 1.25rem)",
                } as React.CSSProperties
              }
              className={cn(
                "relative origin-top overflow-hidden",
                // `rounded-dock`, not a step on the `--radius` scale: this
                // is Apple's Dynamic Island number (44pt), and the panel is
                // close enough to the real thing's size to take it literally.
                // See `--dock-radius` in globals.css, and the note on the
                // content margin below.
                "rounded-dock border border-border/50 bg-glass shadow-overlay backdrop-blur-xl",
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
                {/* `pt-5`, not `pt-4`: the sides are `px-5` and the HIG asks
                    for "even, matching margins between rounded shapes and the
                    edges of the Live Activity, including corners". At a 44px
                    corner an uneven top margin is the one that shows. 20px all
                    round also keeps every element clear of the curve — the
                    tightest is the title at y=20, where the corner has eaten
                    7px of the 20. */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
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
