import { cn } from "@/lib/utils";
import { getLynxApp, type AppWindowKind } from "@/systems/lynx-apps";


export type AppKind = "lynx-react" | "lynx-vue" | "web";

/** Compact globe for Web apps. */
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
  AppKind,
  { label: string; short: string; chipClassName: string }
> = {
  "lynx-react": {
    label: "ReactLynx",
    short: "Lynx · React",
    chipClassName: "bg-[#087ea4] text-white",
  },
  "lynx-vue": {
    label: "VueLynx",
    short: "Lynx · Vue",
    chipClassName: "bg-[#42b883] text-white",
  },
  web: {
    label: "Web",
    short: "Web",
    chipClassName:
      "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900",
  },
};

/** Resolve kind for an open window (Lynx framework or Web). */
export function kindForWindow(
  kind: AppWindowKind,
  appId: string,
): AppKind {
  if (kind === "web") return "web";
  return getLynxApp(appId)?.framework === "vue" ? "lynx-vue" : "lynx-react";
}

export function appKindMeta(kind: AppKind) {
  return KIND_META[kind];
}

/**
 * Inline tech-stack row for menus / Live Activity panels — not overlaid on
 * springboard icons, so shelf aesthetics stay clean.
 */
export function AppKindInfo({
  kind,
  className,
}: {
  kind: AppKind;
  className?: string;
}) {
  const meta = KIND_META[kind];
  const isLynx = kind === "lynx-react" || kind === "lynx-vue";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-[5px]",
          meta.chipClassName,
        )}
        aria-hidden
      >
        {isLynx ? (
          // eslint-disable-next-line @next/next/no-img-element -- 11px local asset
          <img
            src="/app-icons/lynx-mark.png"
            alt=""
            draggable={false}
            className="h-[11px] w-[11px]"
          />
        ) : (
          <WebMark className="h-[11px] w-[11px]" />
        )}
      </span>
      <span className="font-medium text-foreground/80">{meta.label}</span>
    </span>
  );
}
