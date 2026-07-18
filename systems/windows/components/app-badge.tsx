"use client";

import type { AppFlavor, AppLink, AppRuntime } from "@/lib/app-icon-core";
import { cn } from "@/lib/utils";

// =============================================================================
// AppBadge — the little runtime marker clipped to an app icon's corner
//
// Every app tile wears a badge that says how it runs, the way iOS overlays a
// small glyph on Clips / AR / web-clip icons:
//   • web apps        → a globe (opens in an iframe window)
//   • Lynx · React    → the Lynx head, tinted React blue
//   • Lynx · Vue      → the Lynx head, tinted Vue green
//
// The Lynx flavour is colour-only, so React-Lynx and Vue-Lynx apps read apart
// at a glance without a second glyph.
// =============================================================================

/** A minimal lynx-head silhouette (two tufted ears over a round face). */
function LynxMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="currentColor" aria-hidden>
      <path d="M6 5 L14.5 12.5 L9.5 14.5 Z" />
      <path d="M26 5 L17.5 12.5 L22.5 14.5 Z" />
      <circle cx="16" cy="18.5" r="8.2" />
    </svg>
  );
}

/** A simple globe for web apps. */
function WebMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.5 4 5.7 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.7-4-9s1.4-6.5 4-9z" />
    </svg>
  );
}

interface BadgeSpec {
  /** Chip fill colour. */
  bg: string;
  glyph: React.ReactNode;
  label: string;
}

function specFor(runtime: AppRuntime, flavor?: AppFlavor): BadgeSpec {
  if (runtime === "lynx") {
    const vue = flavor === "vue";
    return {
      // React blue vs Vue green — the whole point of the flavour tint.
      bg: vue ? "bg-[#42b883]" : "bg-[#149eca]",
      glyph: <LynxMark className="h-[62%] w-[62%] text-white" />,
      label: vue ? "Lynx · Vue" : "Lynx · React",
    };
  }
  return {
    bg: "bg-zinc-600 dark:bg-zinc-500",
    glyph: <WebMark className="h-[58%] w-[58%] text-white" />,
    label: "Web",
  };
}

export function AppBadge({
  runtime = "web",
  flavor,
  className,
  size = 20,
}: {
  runtime?: AppRuntime;
  flavor?: AppFlavor;
  className?: string;
  size?: number;
}) {
  const spec = specFor(runtime, flavor);
  return (
    <span
      role="img"
      aria-label={spec.label}
      title={spec.label}
      style={{ width: size, height: size }}
      className={cn(
        "flex items-center justify-center rounded-full",
        // A white ring lifts the chip off the icon art beneath it, like the
        // AR/Clip overlays on the iOS home screen.
        "ring-2 ring-white shadow-sm dark:ring-[#1a1a1a]",
        spec.bg,
        className,
      )}
    >
      {spec.glyph}
    </span>
  );
}

/** Convenience: badge derived straight from an app's declared runtime. */
export function AppBadgeFor({
  app,
  className,
  size,
}: {
  app: AppLink;
  className?: string;
  size?: number;
}) {
  return (
    <AppBadge
      runtime={app.runtime ?? "web"}
      flavor={app.flavor}
      className={className}
      size={size}
    />
  );
}
