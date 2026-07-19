import { cn } from "@/lib/utils";

export type AppKindBadgeKind = "lynx-react" | "lynx-vue" | "web";

/** Compact globe for external / iframe web apps. */
function WebMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="5.25" />
      <path d="M2.75 8h10.5" />
      <path d="M8 2.75c1.7 1.85 1.7 8.65 0 10.5C6.3 11.4 6.3 4.6 8 2.75z" />
    </svg>
  );
}

const KIND_META: Record<
  AppKindBadgeKind,
  { label: string; className: string }
> = {
  "lynx-react": {
    label: "ReactLynx app",
    // React cyan — Lynx mark reads as white on the chip
    className: "bg-[#087ea4] shadow-[0_0_0_1.5px_rgba(255,255,255,0.9)]",
  },
  "lynx-vue": {
    label: "VueLynx app",
    className: "bg-[#42b883] shadow-[0_0_0_1.5px_rgba(255,255,255,0.9)]",
  },
  web: {
    label: "Web app",
    className:
      "bg-neutral-800 text-white shadow-[0_0_0_1.5px_rgba(255,255,255,0.9)] dark:bg-neutral-200 dark:text-neutral-900",
  },
};

/**
 * Shelf icon footnote — small kind chip (Lynx × React/Vue, or Web)
 * anchored to the bottom-right of the app tile.
 */
export function AppKindBadge({ kind }: { kind: AppKindBadgeKind }) {
  const { label, className } = KIND_META[kind];
  const isLynx = kind === "lynx-react" || kind === "lynx-vue";

  return (
    <span
      className={cn(
        "pointer-events-none absolute -bottom-0.5 -right-0.5",
        "flex h-[18px] w-[18px] items-center justify-center rounded-[6px]",
        className,
      )}
      aria-label={label}
      title={label}
    >
      {isLynx ? (
        // White silhouette extracted from the official Lynx mark so the chip
        // color (React cyan / Vue green) carries the framework signal.
        // eslint-disable-next-line @next/next/no-img-element -- 12px local asset
        <img
          src="/app-icons/lynx-mark.png"
          alt=""
          draggable={false}
          className="h-[12px] w-[12px]"
        />
      ) : (
        <WebMark className="h-[11px] w-[11px]" />
      )}
    </span>
  );
}
