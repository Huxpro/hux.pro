"use client";

import { cn } from "@/lib/utils";
import { isIPhoneSafariBrowser } from "@/systems/ambient/lib/platform";
import { useOptionalWeather } from "@/systems/ambient/provider";
import { ArrowRight } from "lucide-react";
import { Link } from "next-view-transitions";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// Widget Primitives (shadcn-like compound components)
// =============================================================================

/**
 * WidgetShell - The outer container with consistent card styling
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
  const weather = useOptionalWeather();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [displayedGradient, setDisplayedGradient] = useState<string>("");
  const [isGradientTransitioning, setIsGradientTransitioning] = useState(false);
  const [sampleRect, setSampleRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isIPhoneSafari] = useState(isIPhoneSafariBrowser);

  const isWidgetGradientEnabled = weather?.gradientMode === "widget";
  const softEdgingEnabled = weather?.softEdgingEnabled ?? true;
  const gradient = weather?.gradient ?? "";
  const isFetching = weather?.isFetching ?? false;
  const widgetEdgeFadeMask =
    "linear-gradient(180deg, transparent 0%, black 20%, black 80%, transparent 100%)";

  useEffect(() => {
    if (isFetching) return;
    if (gradient === displayedGradient) return;
    if (!gradient) return;

    if (!displayedGradient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayedGradient(gradient);
      return;
    }

    setIsGradientTransitioning(true);

    const timeout = setTimeout(() => {
      setDisplayedGradient(gradient);
      requestAnimationFrame(() => {
        setIsGradientTransitioning(false);
      });
    }, 300);

    return () => clearTimeout(timeout);
  }, [gradient, displayedGradient, isFetching]);

  useEffect(() => {
    if (!isWidgetGradientEnabled || !isIPhoneSafari) return;

    let rafId = 0;

    const updateSamplingRect = () => {
      rafId = 0;
      const el = shellRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;

      setSampleRect((prev) => {
        const next = {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(width),
          height: Math.round(height),
        };
        if (
          prev.x === next.x &&
          prev.y === next.y &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
    };

    const scheduleUpdate = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(updateSamplingRect);
    };

    const viewport = window.visualViewport;
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (shellRef.current) {
      resizeObserver.observe(shellRef.current);
    }

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    viewport?.addEventListener("scroll", scheduleUpdate);
    viewport?.addEventListener("resize", scheduleUpdate);

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      viewport?.removeEventListener("scroll", scheduleUpdate);
      viewport?.removeEventListener("resize", scheduleUpdate);
    };
  }, [isWidgetGradientEnabled, isIPhoneSafari]);

  const isGradientVisible = isWidgetGradientEnabled && !isGradientTransitioning;
  const shouldApplySoftEdging = softEdgingEnabled && isIPhoneSafari;
  const widgetGradientStyle = displayedGradient
    ? isIPhoneSafari
      ? {
          backgroundImage: displayedGradient,
          // iOS Safari has broken fixed-attachment behavior; sample by element offset.
          backgroundSize: `${sampleRect.width || 1}px ${sampleRect.height || 1}px`,
          backgroundPosition: `${-sampleRect.x}px ${-sampleRect.y}px`,
          backgroundRepeat: "no-repeat",
          ...(shouldApplySoftEdging
            ? {
                WebkitMaskImage: widgetEdgeFadeMask,
                maskImage: widgetEdgeFadeMask,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "100% 100%",
                maskSize: "100% 100%",
              }
            : {}),
        }
      : {
          backgroundImage: displayedGradient,
          // Keep viewport scale to preserve the same visual "hole-punch" feel.
          backgroundSize: "100vw 100vh",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }
    : undefined;

  return (
    <div
      ref={shellRef}
      className={cn(
        "group relative isolate rounded-2xl overflow-hidden",
        "bg-card/50 backdrop-blur-xl",
        "border border-border/50",
        "transition-all duration-300",
        "hover:border-border hover:bg-card/70",
        isWidgetGradientEnabled && "bg-transparent hover:bg-transparent",
        className
      )}
      style={style}
    >
      {displayedGradient && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0",
            "transition-opacity duration-700 ease-in-out",
            isGradientVisible ? "opacity-70 dark:opacity-85" : "opacity-0"
          )}
          style={widgetGradientStyle}
        />
      )}
      <div className="relative z-10">{children}</div>
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
 * WidgetTitle - Consistent title typography
 */
export function WidgetTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "text-xs font-mono uppercase tracking-wider text-muted-foreground",
        className
      )}
    >
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
