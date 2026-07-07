"use client";

import { Link } from "next-view-transitions";
import { cn } from "@/lib/utils";

/**
 * Editor surface switcher — the two editors (content `log.json` and the
 * `icon.json` studio) each carry this in their toolbar's title slot, so
 * jumping between them is one click from either side. The current
 * surface renders as the active title; the other as a muted link.
 *
 * `current` picks which segment is active; the file-name styling doubles
 * as the toolbar title it replaces (same `font-mono text-sm`).
 */
export function EditorSurfaceNav({ current }: { current: "log" | "icon" }) {
  const surfaces = [
    { key: "log", label: "log.json", href: "/editor" },
    { key: "icon", label: "icon.json", href: "/editor/icon" },
  ] as const;

  return (
    <nav className="flex items-center gap-1 font-mono text-sm">
      {surfaces.map((s, i) => {
        const active = s.key === current;
        return (
          <span key={s.key} className="flex items-center gap-1">
            {i > 0 && (
              <span className="text-muted-foreground/30 select-none">/</span>
            )}
            {active ? (
              <span className="font-medium tracking-wide text-foreground">
                {s.label}
              </span>
            ) : (
              <Link
                href={s.href}
                className={cn(
                  "tracking-wide text-muted-foreground/50 transition-colors",
                  "hover:text-foreground",
                )}
                title={`Switch to ${s.label}`}
              >
                {s.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
