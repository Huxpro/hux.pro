"use client";

import { GLASS_PANEL } from "@/lib/glass";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// =============================================================================
// SystemToast — the one-line notice.
//
// The pill the sun-switch and the language switch use: an icon, a line in
// the body voice with the fact in the foreground and the note behind it. It
// arrives, says its one thing, and dissolves; nothing to confirm or undo.
// Pass it to `showCustomToast` (components/ui/system-sonner).
// =============================================================================

export function SystemToast({
  icon: Icon,
  title,
  note,
}: {
  icon: LucideIcon;
  title: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div
      className={cn(
        GLASS_PANEL,
        "inline-flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full px-4 py-3 shadow-raised",
        "animate-in slide-in-from-bottom-2 fade-in duration-200",
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn(TYPE.body, "min-w-0 truncate")}>
        <span className="font-medium text-foreground">{title}</span>
        {note && (
          <span className="text-tertiary-foreground">
            {" · "}
            {note}
          </span>
        )}
      </span>
    </div>
  );
}
