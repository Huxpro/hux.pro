"use client";

import { runtimeLabel, type AppFlavor, type AppLink, type AppRuntime } from "@/lib/app-icon-core";
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

/**
 * The official Lynx logo (the leaping-lynx mark), inlined from
 * lynx-{light,dark}-logo.svg (see public/img/lynx/). It's a monochrome
 * two-path mark, so `currentColor` lets the badge tint it white on its
 * flavour-coloured chip in either theme.
 */
function LynxMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 27 28"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.56542 6.19594L3.90642 8.7164C3.50877 8.99031 3.23346 9.40191 3.13675 9.86708L2.77902 11.5878C2.76005 11.679 2.71799 11.7642 2.65665 11.8355L0.996306 14.0121C0.772761 14.2722 0.778152 14.9632 1.39044 15.4057C1.62523 15.6103 1.93915 16.0691 2.29622 16.591C3.05224 17.6959 4.00169 19.0836 4.80312 18.9394C5.9372 18.541 7.32544 18.4135 8.39128 18.9394C10.4632 20.7282 9.95449 22.3775 9.22514 24.7421C8.93165 25.6936 8.60243 26.7609 8.39128 27.9997C9.38643 24.3777 11.6242 20.1711 15.6592 18.7437C14.9322 18.1498 13.4486 17.5981 12.1357 17.4653C12.1357 17.4653 16.1691 14.0121 21.1439 12.4254C17.671 4.16205 11.9386 0.213095 11.9386 0.213095C11.6465 -0.148197 11.0566 -0.0296711 10.9349 0.414774C10.8371 1.72112 10.675 2.60942 10.4074 3.44676L8.39128 1.12029C8.18068 0.866399 7.75965 1.013 7.76176 1.33949C8.10312 3.23719 8.05521 4.30239 7.56542 6.19594ZM8.9846 6.02248L8.99663 6.02171C9.02298 6.02002 9.0489 6.01659 9.07424 6.01153L8.9846 6.02248ZM11.7123 1.7617C13.094 4.1491 13.7199 5.5054 13.9322 8.03659C12.4625 7.2017 11.8221 6.98923 10.7413 6.99451C11.3718 5.0773 11.5644 3.92284 11.7123 1.7617Z"
      />
      <path d="M20.5926 19.4929C14.9649 20.7806 11.7681 22.7198 9.32324 28.0001C13.712 20.6367 26.9976 21.9536 26.9976 21.9536C26.7494 20.7508 24.1079 18.4571 22.3706 17.0503C22.3706 17.0503 23.7722 15.3272 26.8706 14.455C26.8706 14.455 20.9135 14.8002 17.4455 16.6727C18.569 17.2656 20.0081 18.2663 20.5926 19.4929Z" />
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
  if (runtime === "native") {
    return {
      bg: "bg-foreground",
      glyph: <span className="h-1.5 w-1.5 rounded-full bg-background" />,
      label: runtimeLabel({ runtime, flavor }),
    };
  }
  if (runtime === "lynx") {
    const vue = flavor === "vue";
    return {
      // React blue vs Vue green — the whole point of the flavour tint.
      bg: vue ? "bg-[#42b883]" : "bg-[#149eca]",
      glyph: <LynxMark className="h-[70%] w-[70%] text-white" />,
      label: runtimeLabel({ runtime, flavor }),
    };
  }
  return {
    bg: "bg-zinc-600 dark:bg-zinc-500",
    glyph: <WebMark className="h-[58%] w-[58%] text-white" />,
    label: runtimeLabel({ runtime, flavor }),
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
