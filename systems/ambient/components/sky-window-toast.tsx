"use client";

import { GLASS_PANEL } from "@/lib/glass";
import { TYPE } from "@/lib/typography";
import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Compass } from "lucide-react";

// ---------------------------------------------------------------------------
// The sky-window notice.
//
// The same small pill the sun's theme switch uses: by the time it lands the
// sky has already started turning into a window (or back into a wallpaper),
// so there is nothing to confirm. One line — what happened, and the thing to
// do next: hold the phone up, or hold the sky again to put it back.
// ---------------------------------------------------------------------------

export function SkyWindowToast({ on }: { on: boolean }) {
  const { locale } = useLocale();

  return (
    <div
      className={cn(
        GLASS_PANEL,
        "inline-flex items-center gap-3 rounded-full px-4 py-3 shadow-raised",
        "animate-in slide-in-from-bottom-2 fade-in duration-200"
      )}
    >
      <Compass className="size-4 shrink-0 text-muted-foreground" />
      <span className={cn(TYPE.body, "whitespace-nowrap")}>
        <span className="font-medium text-foreground">
          {t(locale, on ? "skyWindowOn" : "skyWindowOff")}
        </span>
        {on && (
          <span className="text-tertiary-foreground">
            {" · "}
            {t(locale, "skyWindowOnNote")}
          </span>
        )}
      </span>
    </div>
  );
}
