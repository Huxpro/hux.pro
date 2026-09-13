"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/services";
import { GradientStack } from "@/systems/ambient/components/gradient-stack";
import { isIOSBrowser } from "@/systems/ambient/lib/platform";
import { WALLPAPER_OPACITY } from "@/systems/ambient/lib/wallpaper";
import { useOptionalWallpaper } from "@/systems/ambient/provider";
import { ArrowRight } from "lucide-react";
import { Link } from "next-view-transitions";
import { useState } from "react";

// =============================================================================
// Widget Primitives (shadcn-like compound components)
// =============================================================================

/**
 * WidgetShell - The outer container with consistent card styling.
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
  children,
}: {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const wallpaper = useOptionalWallpaper();
  const { theme } = useTheme();
  // Callback ref kept in state so the GradientStack re-renders (and its per-layer
  // tracker registrations run) once the card element is actually attached.
  const [shellEl, setShellEl] = useState<HTMLDivElement | null>(null);

  const widgetEnabled = wallpaper?.widgetEnabled ?? false;
  const layers = wallpaper?.layers ?? [];
  const edgeMask = wallpaper?.edgeMask ?? null;

  const showOverlay = widgetEnabled && layers.length > 0;

  // Weight resolved by the provider, exactly as the full-page background does
  // it — kind and theme already accounted for. The fallback is the same token
  // the provider would have read, not a second copy of the number: a widget
  // rendered outside the provider used to silently get the light value in dark
  // mode.
  const overlayOpacity = wallpaper?.opacity ?? WALLPAPER_OPACITY.weather[theme];

  // background-attachment: fixed is broken on all iOS browsers.
  // When true  → JS polyfill positions the background (no CSS fixed).
  // When false → CSS fixed handles positioning (no JS polyfill).
  const [useTrackerForPositioning] = useState(isIOSBrowser);

  return (
    <div
      ref={setShellEl}
      className={cn(
        "group relative rounded-2xl overflow-hidden",
        "border border-border/50",
        "transition-all duration-300",
        widgetEnabled
          ? "bg-transparent backdrop-blur-sm hover:bg-white/5 dark:hover:bg-white/5"
          : "bg-glass backdrop-blur-xl hover:border-border hover:bg-glass-hover",
        className
      )}
      style={style}
    >
      {showOverlay && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ opacity: overlayOpacity }}
        >
          <GradientStack
            layers={layers}
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
        "inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground",
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
 */
export function WidgetScrollBody({
  className,
  children,
}: {
  /** Height goes here — defaults to a fixed `h-64`; pass `max-h-*` for a
   *  stack that should only scroll once it overflows. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5">
      <div
        className={cn(
          "relative -mx-2 px-2 pb-7",
          "overflow-y-auto snap-y snap-mandatory scroll-smooth no-scrollbar",
          "[mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]",
          className ?? "h-64"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * WidgetLink - Navigation arrow link for header
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
      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center"
    >
      {variant === "icon" ? <ArrowRight className="h-3 w-3" /> : "→"}
    </Link>
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
