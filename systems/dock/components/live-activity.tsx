"use client";

import { cn } from "@/lib/utils";
import {
  SurfaceViewport,
  surfaceMotionVars,
  useSurfaceStack,
} from "@/systems/surface";
import { Drawer } from "@base-ui/react/drawer";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDock } from "../provider";

// ---------------------------------------------------------------------------
// LiveActivity — one activity's two forms, and the deformation between them.
//
// The dock is ONE island (provider.tsx says who holds it), so this component
// renders an activity in whichever form it currently has:
//
//   Island    — the compact presentation, Apple's exact split: `lead` on the
//               leading side, `trail` on the trailing side. iOS puts the
//               TrueDepth camera between them; we have no camera, so the gap
//               is the island's own and the chevron sits in it.
//   Satellite — every other activity, detached from the island exactly as iOS
//               detaches the second of two Live Activities. It keeps `lead`
//               and `trail` while the row has room, and collapses to iOS's
//               minimal presentation — a bare circle carrying `lead` alone —
//               when it does not. The row decides which (dock.tsx); all this
//               file does is mark what may be dropped, with `data-dock-extra`.
//
// and one expanded panel, which is a Base UI Drawer travelling UP — the mirror
// of the phone sheet in systems/surface. Everything the dock used to
// hand-write (the drag, the enter/exit animation, the scrim, Escape) is the
// library's now, or CSS ("Dock" in globals.css).
//
// Three things the drawer brought that the hand-written panel could not:
//
//   The deformation.  The panel does not slide in and does not pop. The glass
//   shell starts at the compact form's own rectangle — width, height, corner —
//   and DEFORMS into the panel. Not a scale and not a clip: the box really
//   changes size, so `backdrop-filter` re-samples the page at 1:1 on every
//   frame, where a scale would magnify what the blur sees. The panel grows out
//   of whichever form the activity is in, a dot included, which is what a
//   touch-and-hold on a minimal presentation does on iOS.
//
//   Pull to expand.  `Drawer.SwipeArea` wraps the compact form, so dragging
//   DOWN from it opens the panel and the panel follows the finger the whole
//   way — iOS's Notification Center, rather than something you may only tap.
//
//   Stacking.  The panel registers in the shared surface stack (stack.ts), so
//   it is no longer the one overlay on the site that does not know about the
//   others. A palette opened over it — from the keyboard; a press on the FAB
//   is an outside press and dismisses instead — sends it back a step and makes
//   it inert, and a panel opened over the playlist sheet sends that back
//   instead.
//
// See docs/system-dock.md for what was measured on the way here, including the
// two capabilities that were tried and left out.
// ---------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// BEFORE CHANGING THIS FILE, OR THE "Dock" BLOCK IN globals.css:
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
//    take the button inside out of the accessibility tree with it. It is a
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
//    blurred, on the popup it is sharp. So the shell fades nothing; what fades
//    in is `[data-dock-content]`, which is INSIDE the glass and carries none.
// 5. The deformation lives on the shell, never on the popup. Base UI measures
//    how far "closed" is by reading the POPUP's transform when a
//    `Drawer.SwipeArea` drag starts (`resolveClosedOffset`, `min(height,
//    |translateY|)`), before it marks the popup as swiping — so a closed
//    `translateY` on the popup tells it the panel is that many pixels from
//    open, and a pull that should track the finger down a whole panel height
//    tracks ten pixels and overshoots (measured `--drawer-swipe-movement-y` of
//    +12px where −170 was due). The popup carries the swipe and nothing else;
//    the shell carries the morph. They never touch.
// 6. `width` and `height` are the point, not a shortcut. A scale would be
//    cheaper and is wrong twice: it magnifies what the shell's
//    `backdrop-filter` samples, so the page appears to zoom behind the glass,
//    and it stretches the border and the text with it. A real size change
//    costs a layout per frame on one absolutely-positioned box — nothing in
//    the page reflows — and is the only way the glass stays honest. `clip-path`
//    was the other candidate and is a reveal, not a deformation: the content is
//    already at full size, merely hidden.
// -----------------------------------------------------------------------------

/** Where the panel's top edge sits: the status bar, or the dock row's own gap. */
const TOP_INSET = "max(env(safe-area-inset-top), 0.5rem)";

/**
 * The panel's width, as CSS and as the same numbers — one constant so the two
 * cannot drift. The anchor maths below needs it before the panel exists.
 */
const PANEL_VW = 0.92;
const PANEL_MAX = 360;
const PANEL_WIDTH = `min(${PANEL_VW * 100}vw, ${PANEL_MAX}px)`;

interface Anchor {
  /** The compact form's own size. */
  w: number;
  h: number;
  /** Its left edge, relative to where the panel's will be. */
  x: number;
}

/**
 * Where the deformation starts, measured off the compact form ALONE.
 *
 * It has to be knowable before the panel exists, and that is the whole design
 * of this hook. The panel mounts with `data-starting-style` already set, so the
 * very first style the browser resolves for it has to be the compact form's
 * geometry; anything that lands a commit later is a different starting value,
 * and the browser has already latched the resting one. That failure is quiet
 * and specific: `width`, `border-radius` and `transform` interpolate from the
 * resting value (so they appear not to animate at all, sitting at the end the
 * whole time) while `height` jumps, because its resting value is `auto` and
 * `auto` does not interpolate. Measured, before this hook existed: width
 * crawling 358.797px → 359px across the entire entrance.
 *
 * Which is why nothing here touches the panel. The compact form is always
 * mounted, so its box is free; and the panel's box is derivable without it —
 * `mx-auto` inside a full-screen layer puts its left edge at
 * `(viewport − PANEL_WIDTH) / 2`, and its top edge is the same `TOP_INSET` the
 * dock row sits at, which is why there is no `y` here at all. The walkthrough
 * asserts that shared top rather than trusting it.
 *
 * Frozen while any panel is open: the compact forms are mid-fade by then, and
 * their boxes carry the scale that fade is riding on.
 */
function useAnchor(ref: React.RefObject<HTMLElement | null>, frozen: boolean) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    const onResize = () => bump((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // No dependency array: the row re-lays out whenever any sibling activity
  // appears, changes form or leaves, and none of that is visible from here.
  // A rect read per render on at most a handful of components is cheaper than
  // the observers it would take to be clever about it. The `setAnchor` below
  // bails when nothing moved, so there is no chain of updates to fall into.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (frozen) return;
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const viewport = document.documentElement.clientWidth;
    const panel = Math.min(viewport * PANEL_VW, PANEL_MAX);
    const next: Anchor = {
      w: Math.round(box.width),
      h: Math.round(box.height),
      x: Math.round(box.left - (viewport - panel) / 2),
    };
    setAnchor((prev) =>
      prev && prev.w === next.w && prev.h === next.h && prev.x === next.x
        ? prev
        : next
    );
  });

  return anchor;
}

/**
 * The panel's RESTING size, measured off the live DOM because it is not
 * knowable in CSS: the panel is as tall as whatever the activity put in it.
 *
 * Unlike the anchor above, this one is free to land late — it is the value the
 * deformation travels TO, so a commit's delay changes the target, never the
 * latched start. Two things about it are still load-bearing:
 *
 *   • It goes through React state, never onto the node. Base UI re-renders the
 *     popup several times on its way open and React reconciles `style` each
 *     time, so custom properties set imperatively are wiped.
 *   • Layout, not painted geometry (`offsetWidth`, not `getBoundingClientRect`)
 *     — the popup may already be carrying a transform, and a rect would fold it
 *     into the answer.
 */
function restingVars(popup: HTMLElement, content: HTMLElement) {
  const w = popup.offsetWidth;
  const h = content.offsetHeight;
  if (!w || !h) return null;
  return {
    "--dock-shell-w": `${w}px`,
    "--dock-shell-h": `${h}px`,
  } as React.CSSProperties;
}

interface LiveActivityProps {
  /** Stable id; the Dock allows only one activity open at a time. */
  id: string;
  /**
   * Leading content of the compact presentation — the thing that identifies
   * the activity at a glance: album art, an app icon, a sun. It is the ONLY
   * thing a collapsed satellite shows, so it has to carry the activity on its
   * own.
   */
  lead: React.ReactNode;
  /**
   * Trailing content of the compact presentation — the live bit: EQ bars, a
   * countdown, a score. The first thing dropped when the row runs out of room,
   * which is the whole reason iOS's minimal presentation exists.
   */
  trail?: React.ReactNode;
  /** Panel header content (left side, before the collapse chevron). */
  title: React.ReactNode;
  /** Panel body. */
  children: React.ReactNode;
  /** aria-label for the compact form's button. */
  openLabel: string;
  /** aria-label for the collapse button. */
  collapseLabel: string;
  /** Extra classes for the compact form. */
  pillClassName?: string;
  /** Extra classes for the expanded panel. */
  panelClassName?: string;
}

export function LiveActivity({
  id,
  lead,
  trail,
  title,
  children,
  openLabel,
  collapseLabel,
  pillClassName,
  panelClassName,
}: LiveActivityProps) {
  const { isOpen, isAnyOpen, isPrimary, open, close, registerActivity } =
    useDock();
  const expanded = isOpen(id);
  const island = isPrimary(id);

  // Registration decides two things at once: that the dock collapses if this
  // activity unmounts while open, and — by its order — who holds the island.
  useEffect(() => registerActivity(id), [id, registerActivity]);

  // One entry for the dock, not one per activity: only ever one is expanded,
  // and what the other surfaces care about is "the dock panel is up".
  const { behind, depth, rank } = useSurfaceStack("dock-activity", expanded);

  // The wrapper, not the button: by the time a panel is opening the button is
  // already fading and shrinking away, and its rect carries that scale.
  const fromRef = useRef<HTMLDivElement>(null);
  const anchor = useAnchor(fromRef, isAnyOpen);

  const popupRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [resting, setResting] = useState<React.CSSProperties | null>(null);

  const measure = useCallback(() => {
    const popup = popupRef.current;
    const box = contentRef.current;
    setResting(popup && box ? restingVars(popup, box) : null);
  }, []);

  // Refs attach bottom-up, so the content's is set before the popup's and the
  // first call finds no popup; the popup's own call is the one that lands.
  const attachPopup = useCallback(
    (node: HTMLDivElement | null) => {
      popupRef.current = node;
      measure();
    },
    [measure]
  );
  const attachContent = useCallback(
    (node: HTMLDivElement | null) => {
      contentRef.current = node;
      setContent(node);
    },
    []
  );

  // The panel's height is the content's, and the content's height changes
  // under it — a track with a two-line title, a weather card that gains a row.
  // Apple asks for exactly this: "Dynamically change the height … when there's
  // less information to show, reduce the height." Because the shell's height is
  // a transitioned pixel value, re-measuring IS the animation.
  useEffect(() => {
    if (!content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    return () => ro.disconnect();
  }, [content, measure]);

  const compact = (
    /* The compact presentation — a flex item in the dock row, and the drawer's
       trigger. It stays mounted while a panel is open so the row keeps its
       layout; it just goes invisible and stops taking pointers, because the
       open panel should stand alone. */
    <Drawer.SwipeArea
      // See note 3 above: the wrapper is presentational, the button inside
      // it is not.
      aria-hidden={false}
      ref={fromRef}
      data-dock-pill=""
      data-dock-slot={island ? "island" : "dot"}
      data-hidden={isAnyOpen ? "" : undefined}
      className="shrink-0"
    >
      <Drawer.Trigger
        data-dock-face
        className={cn(
          "pointer-events-auto flex shrink-0 items-center gap-2",
          "h-9 rounded-full pl-1.5 pr-2.5 border border-border/50",
          // `bg-glass-strong` is what docs/system-glass.md has always
          // specified for a Live Activity's compact form — the dock was the
          // one surface quietly painting itself with plain `bg-glass` and
          // therefore answering the Tinted/Clear setting a step weaker than
          // its neighbours in the same row.
          "bg-glass-strong backdrop-blur-xl shadow-raised",
          "transition-colors hover:border-border hover:bg-glass-strong-hover",
          "pressable active:border-border active:bg-glass-strong-hover active:scale-95",
          pillClassName
        )}
        aria-label={openLabel}
      >
        {lead}
        {/* `contents`, so the wrapper is only a handle for the row's collapse
            rule and never a box of its own. */}
        {trail && (
          <span data-dock-extra className="contents">
            {trail}
          </span>
        )}
        {/* The chevron is the island's alone: it is the one that says "this
            expands", and a satellite that carried it would read as a second
            island rather than a satellite. Tapping a satellite still opens its
            panel — the affordance is the difference, not the ability. */}
        {island && (
          <ChevronDown
            data-dock-extra
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          />
        )}
      </Drawer.Trigger>
    </Drawer.SwipeArea>
  );

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
      {compact}

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
        <SurfaceViewport modal={false} layer={rank}>
          <Drawer.Popup
            data-dock-panel=""
            // The anchor, and only the anchor, gates the deformation: it is
            // the one value that has to be right on the popup's very first
            // render, and it is ready long before the popup exists.
            data-dock-morph={anchor ? "" : undefined}
            ref={attachPopup}
            style={
              {
                ...surfaceMotionVars(TOP_INSET),
                top: TOP_INSET,
                // A value rather than a class, because `useAnchor` has to do
                // the same arithmetic in JS and PANEL_WIDTH is the one place
                // that number lives.
                width: PANEL_WIDTH,
                // The popup is the panel's BOX; the shell is what deforms
                // inside it. Letting the popup shrink with the shell was a
                // measured bug: `Drawer.SwipeArea` opens the drawer on the
                // first pixel of a pull, and Base UI reads the popup's height
                // right then to decide how far the finger has to travel. With
                // the popup 36px tall — the compact form's height, mid-
                // deformation — a pull that should track ~170px of panel
                // tracked 36 and overshot (measured `--drawer-swipe-movement-y`
                // of +11px where −170 was due). Pinning the height here keeps
                // the gesture's geometry the panel's from the first frame.
                height: "var(--dock-shell-h, auto)",
                ...resting,
                ...(anchor
                  ? {
                      "--dock-from-w": `${anchor.w}px`,
                      "--dock-from-h": `${anchor.h}px`,
                      "--dock-from-x": `${anchor.x}px`,
                    }
                  : null),
              } as React.CSSProperties
            }
            // A positioning box only, centred without a transform so the drag
            // has the axis to itself. Nothing paints here; the shell inside
            // does, and the shell is the thing that changes size — see note 5.
            // No pointer events here, only on the shell: the popup is the
            // panel's full box from the first frame (see `height` above), so
            // for the length of the deformation it is much bigger than
            // anything painted, and a press in that empty margin should reach
            // the page — which is also what dismisses the panel.
            className={cn(
              "pointer-events-none absolute inset-x-0 z-[61] mx-auto",
              "bg-transparent outline-none"
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
                  // corner radius … by subtracting the margin". Published, not
                  // imposed — content opts in by reading it with its own value
                  // as the fallback (see <NowPlaying />), so nothing that is
                  // not inside a big corner is changed by it.
                  "--radius-concentric": "calc(var(--dock-radius) - 1.25rem)",
                } as React.CSSProperties
              }
              className={cn(
                // `system-chrome` for the same reason every other surface
                // shell carries it (#197 put it on systems/surface's SHELL):
                // a Live Activity panel is the OS's own UI, not a document, so
                // a long press on the track title is a gesture, not an attempt
                // to select it. The dock ROW has always had it; the panel is
                // portalled out of the row, so it needs its own.
                "system-chrome pointer-events-auto relative overflow-hidden",
                // `rounded-dock` is Apple's Dynamic Island number (44pt), and
                // the panel is close enough to the real thing's size to take it
                // literally — but it is only ever the RESTING corner. What the
                // eye sees is the corner travelling from the compact form's,
                // because the shell's `border-radius` deforms with its box.
                "rounded-dock border border-border/50",
                // `bg-glass-overlay`, the role docs/system-glass.md gives a
                // Live Activity panel — see the note on the compact form.
                "bg-glass-overlay shadow-overlay backdrop-blur-xl",
                // The dim on a receded panel is a wash over the shell rather
                // than an opacity, so the glass stays glass.
                "after:pointer-events-none after:absolute after:inset-0 after:bg-black/0 after:transition-colors after:[transition-duration:var(--surface-duration)]",
                behind && "after:bg-black/15 dark:after:bg-black/30",
                panelClassName
              )}
            >
              {/* The content does not deform with the shell — it is laid out
                  at the panel's final width and simply arrives inside a box
                  that is already growing, which is why it is absolutely
                  positioned and the shell clips it. Apple: "preserve as much
                  of the existing layout as possible by animating existing
                  elements to their new positions rather than removing and
                  animating them back in." Reflowing text mid-deformation is
                  the opposite of preserving it. */}
              <div
                ref={attachContent}
                data-dock-content
                // In flow, so the shell has a natural height to fall back on
                // if the measurement ever fails, and pinned to the panel's
                // resting width so the deformation never reflows the text
                // inside it: as the shell narrows the content simply overflows
                // and is clipped. Left-aligned rather than centred, which puts
                // the header's leading glyph near the compact form's own
                // leading glyph on the first frame.
                style={{ width: PANEL_WIDTH }}
              >
                {/* Everything above the grabber is content, not a handle: a
                    mouse press inside it is a press on the close button or a
                    transport control, never the start of a drag. Without this,
                    the drawer takes the pointer on press and the click never
                    reaches what was pressed. A touch drag still works
                    anywhere. */}
                <Drawer.Content>
                  <div className="flex items-center justify-between px-5 pt-5 pb-3">
                    <Drawer.Title
                      render={<div className="flex min-w-0 items-center gap-2" />}
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
                      widget body. `px-5` everywhere, matching `pt-5` above and
                      the sides, because the HIG asks for "even, matching
                      margins … including corners" and at a 44px corner the
                      uneven one is the one that shows. */}
                  {children}
                </Drawer.Content>

                {/* Grabber — swipe up to collapse. Outside Drawer.Content, so a
                    mouse drag on it is a drag. */}
                <div className="flex justify-center pb-2">
                  <span className="h-1 w-9 rounded-full bg-muted-foreground/25" />
                </div>
              </div>
            </div>
          </Drawer.Popup>
        </SurfaceViewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
