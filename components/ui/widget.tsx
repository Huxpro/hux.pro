"use client";

import { cn } from "@/lib/utils";
import { GradientStack } from "@/systems/ambient/components/gradient-stack";
import { isIOSBrowser } from "@/systems/ambient/lib/platform";
import { useOptionalWallpaper } from "@/systems/ambient/provider";
import { ArrowRight } from "lucide-react";
import { Link, useTransitionRouter } from "next-view-transitions";
import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import { landsOnOwnAction } from "./widget-surface";

import { TYPE } from "@/lib/typography";
// =============================================================================
// Widget Primitives (shadcn-like compound components)
// =============================================================================

/**
 * WidgetShell - The outer container with consistent card styling.
 *
 * Tappable surface: pass `href` (a page to open) or `onOpen` (an action —
 * refresh the weather, open the playlist) and the whole card becomes the tap
 * target, not just the header arrow. Interactive descendants keep their own
 * taps (see `landsOnOwnAction`); the masonry's edit mode swallows clicks
 * before they reach here, so rearranging never opens anything. Hover and
 * press chrome on those descendants must use their own named group —
 * the shell is `group/widget`, so a nested `group-active:` cannot follow
 * a thumbnail press that bubbles `:active` up to the card. Keyboard users
 * still reach the page through the visible `WidgetLink` — the shell itself
 * deliberately adds no tab stop.
 *
 * In "widget" placement each card renders a crossfading overlay of whatever the
 * active wallpaper is (the shared <GradientStack />) bound to the provider's
 * layer stack — a weather gradient or a image wallpaper alike. All transition
 * logic is centralized — zero per-widget state machines.
 *
 * Background positioning uses one of two mutually-exclusive strategies:
 *   - Desktop: CSS `background-attachment: fixed` (zero JS overhead)
 *   - iOS:     JS polyfill via fixedBgTracker (CSS is broken on all iOS browsers)
 *
 * Soft edging (viewport-relative mask) goes through the tracker per layer.
 */
export function WidgetShell({
  className,
  style,
  href,
  onOpen,
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  /** Page the widget opens when its surface is tapped. */
  href?: string;
  /** Action the widget performs when its surface is tapped (no page). */
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  const wallpaper = useOptionalWallpaper();
  const router = useTransitionRouter();
  const tappable = !!href || !!onOpen;

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!tappable) return;
      if (landsOnOwnAction(e)) return;
      if (href) {
        // Honour "open in new tab" gestures on the blank surface too.
        if (e.metaKey || e.ctrlKey || e.button === 1) {
          window.open(href, "_blank", "noopener");
          return;
        }
        router.push(href);
      } else {
        onOpen?.();
      }
    },
    [tappable, href, onOpen, router],
  );
  // Callback ref kept in state so the GradientStack re-renders (and its per-layer
  // tracker registrations run) once the card element is actually attached.
  const [shellEl, setShellEl] = useState<HTMLDivElement | null>(null);

  const widgetEnabled = wallpaper?.widgetEnabled ?? false;
  const layers = wallpaper?.layers ?? [];
  const edgeMask = wallpaper?.edgeMask ?? null;

  const showOverlay = widgetEnabled && layers.length > 0;


  // background-attachment: fixed is broken on all iOS browsers.
  // When true  → JS polyfill positions the background (no CSS fixed).
  // When false → CSS fixed handles positioning (no JS polyfill).
  const [useTrackerForPositioning] = useState(isIOSBrowser);

  return (
    <div
      ref={setShellEl}
      onClick={tappable ? handleClick : undefined}
      // iOS only paints `:active` on elements with a touch listener in their
      // ancestry; React delegates to the root, so an empty handler suffices.
      onTouchStart={tappable ? noop : undefined}
      data-widget-tappable={tappable ? "" : undefined}
      className={cn(
        // Named group: nested chrome (AlbumTabs, transport clusters) must
        // not inherit the card's `:hover` / `:active`. Widget-level hover
        // effects opt in with `group-hover/widget`.
        "group/widget relative rounded-2xl overflow-hidden",
        "border border-border/50",
        "transition-all duration-300",
        widgetEnabled
          ? "bg-transparent backdrop-blur-sm hover:bg-ink/5"
          : "bg-glass backdrop-blur-xl hover:border-border hover:bg-glass-hover",
        // Press wash for surface presses only (see `.widget-surface`).
        tappable && "widget-surface",
        className
      )}
      style={style}
    >
      {showOverlay && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          // Weight resolved by the provider, exactly as the full-page background
          // does it. The overlay only exists inside the provider, so there is
          // no fallback to keep.
          style={{ opacity: wallpaper?.opacity }}
        >
          <GradientStack
            layers={layers}
            durationMs={wallpaper?.crossfadeMs}
            shell={shellEl}
            positionBackground={useTrackerForPositioning}
            edgeMask={edgeMask}
            cssFixedAttachment={!useTrackerForPositioning}
          />
        </div>
      )}
      {children}
    </div>
  );
}

const noop = () => {};

/**
 * WidgetHeader - Header bar with flexible content slots
 */
export function WidgetHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-5 pt-5 pb-4 flex items-center justify-between",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * WidgetTitle - Consistent title typography.
 *
 * `signal` prefixes the pulsing status dot (see WidgetStatus) so any widget
 * can flag itself as live / in-progress without composing the dot by hand.
 */
export function WidgetTitle({
  className,
  signal = false,
  children,
}: {
  className?: string;
  signal?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2",
        TYPE.label,
        className
      )}
    >
      {signal && <WidgetStatus />}
      {children}
    </span>
  );
}

/**
 * WidgetBody - Content area wrapper
 */
export function WidgetBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

/**
 * WidgetScrollBody - A vertically snapping stack body.
 *
 * The column analogue of the horizontal card stack: rows snap under the
 * header, the tail fades out under a mask instead of ending on padding, and
 * the scroll port is inset by the rows' hover bleed (`-mx-2`) so a row's
 * rounded highlight isn't clipped at the card's left edge. Rows should carry
 * `snap-start` and the `-mx-2 px-2` bleed themselves.
 *
 * **The port only scrolls under a pointer.** A nested vertical scroller inside
 * the page's own vertical scroll is free with a wheel — it goes to whatever is
 * under the cursor, and hover makes the port discoverable at all. Under a
 * finger it is a fight the widget always wins: on a phone the card is most of
 * the screen, `snap-mandatory` holds the list wherever the gesture leaves it,
 * and nothing chains back to the page inside one gesture, so a swipe meant for
 * the page is simply spent. Measured on an iPhone 13 viewport, a swipe from
 * the middle of the projects widget moved the page 0px and the list 204px.
 *
 * So the default is a plain stack: the widget prints a fixed set of rows —
 * curated, or capped with `pointer-coarse:hidden` — and the body is exactly
 * as tall as they are. No port, no mask, nothing cut off, with the card's own
 * tap for the rest. Which is what a widget is everywhere else: Apple's widgets
 * have no scroll gesture at all, and answer "more than fits" with a bigger
 * size or the app. See docs/system-widget-scroll.md.
 *
 * `port` opts a list back into scrolling **under a pointer only**, and it is
 * one prop because the height, the scroll, the fade and the room the fade
 * needs are one decision, not four: a body with no port must not wear a mask
 * over its last row or reserve 28px under it. One media query rather than a
 * hook — the same markup serves both, so there is no hydration branch and
 * nothing to measure.
 *
 * The stack ends on `pb-3` rather than the card's `pb-5`, because a row
 * carries its own `py-2`: 12 + 8 puts the last line 20px off the card's
 * bottom edge, which is what `pt-5` puts the title from its top.
 */
export function WidgetScrollBody({
  port,
  className,
  children,
}: {
  /**
   * Scroll this list under a pointer, at this height — `pointer-fine:h-64`
   * for a fixed port, `pointer-fine:max-h-64` for one that only appears once
   * the list outgrows it. Omitted, the body is a stack and prints whole on
   * every device.
   */
  port?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5">
      <div
        className={cn(
          "relative -mx-2 px-2 pb-3 overflow-hidden no-scrollbar",
          port && [
            "pointer-fine:pb-7 pointer-fine:overflow-y-auto pointer-fine:snap-y pointer-fine:snap-mandatory pointer-fine:scroll-smooth",
            "pointer-fine:[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]",
            port,
          ],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Hit area for a 12px glyph in a widget header. The glyph stays 12px; the
 * control is 28px (`size-7`) and bleeds into the header padding (`-m-2`) so
 * the title row does not grow. Hover and press wash the well — colour-only
 * `hover:` never reaches a finger, and a 12px icon is not a target.
 *
 * Shared by the header arrow (`WidgetLink`) and in-header actions
 * (`WidgetIconButton`), so the two chromes next to each other feel the same.
 */
export const WIDGET_ICON_HIT = cn(
  "pressable -m-2 inline-flex size-7 shrink-0 items-center justify-center rounded-md outline-none",
  "text-muted-foreground transition-colors duration-200",
  // `--muted` is already a 4–6% ink wash, so `bg-muted/20` is invisible.
  // Same foreground alphas as `GLASS_BTN` — a finger can see the well.
  "hover:bg-foreground/[0.06] hover:text-foreground",
  "focus-visible:bg-foreground/[0.08] focus-visible:text-foreground",
  "active:bg-foreground/[0.10] active:text-foreground",
);

/**
 * Chrome that says something the card already says, shown only when the
 * card is being attended to.
 *
 * The header arrow and a strip's pager dots are signifiers, not functions of
 * their own: the whole card is the tap target (`WidgetShell`) and the peek of
 * the next cover is what says a strip scrolls. At rest they are a second way
 * of saying it, seven times over on the home grid. So they wait for a pointer
 * over the card or focus inside it, and under a finger — where the card's tap
 * and the swipe are the whole interaction — they are never drawn. Still in
 * the tree either way: a keyboard reaches the arrow and a screen reader reads
 * it, and focusing either one shows it.
 */
export const WIDGET_REVEAL = cn(
  "opacity-0 transition-opacity duration-200",
  "group-hover/widget:opacity-100 group-focus-within/widget:opacity-100 focus-visible:opacity-100",
);

/**
 * WidgetLink - Navigation arrow link for header. Revealed with the card
 * (`WIDGET_REVEAL`): the card is the link; the arrow is its keyboard stop.
 */
export function WidgetLink({
  href,
  label = "View all",
  variant = "icon",
}: {
  href: string;
  label?: string;
  variant?: "icon" | "text";
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        WIDGET_ICON_HIT,
        WIDGET_REVEAL,
        "transition-[color,background-color,opacity]",
      )}
    >
      {variant === "icon" ? <ArrowRight className="h-3 w-3" /> : "→"}
    </Link>
  );
}

/**
 * An icon action in a widget header — refresh, etc. Same hit and press as
 * `WidgetLink`. `type="button"` so it never submits; the shell already
 * treats `button` as its own action (`landsOnOwnAction`).
 */
export function WidgetIconButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(WIDGET_ICON_HIT, className)}
    >
      {children}
    </button>
  );
}

/**
 * WidgetStatus - Pulsing status indicator (e.g., for "currently working at")
 */
export function WidgetStatus({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-2 w-2", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
    </span>
  );
}
