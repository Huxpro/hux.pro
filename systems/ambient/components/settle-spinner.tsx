"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useEffect, useState, useSyncExternalStore } from "react";
import { isSettling, subscribeSettle } from "../lib/settle";

// ---------------------------------------------------------------------------
// SettleSpinner: the sky is on its way from one state to another.
//
// A very small ring in the top-right corner, shown only while something that
// is NOT routine is still arriving (lib/settle.ts): a location fix in flight, a
// relocated forecast rolling in, the sun gliding to where a jump put it, the
// compass re-aiming the window. The minute-by-minute drift of a live sky never
// raises it. That would be a spinner that never went away, and a spinner that
// never goes away says nothing.
//
// It keeps out of the way twice over. It waits a beat before it appears
// (`SHOW_AFTER_MS`), so a change that settles at once never flashes it; and once
// up it stays a moment (`HOLD_MS`), so two reasons back to back read as one
// wait rather than a flicker. It never takes a pointer, and it sits on the
// wallpaper, so it is `--ink` like any other bare text there.
// ---------------------------------------------------------------------------

const SHOW_AFTER_MS = 150;
const HOLD_MS = 700;

export function SettleSpinner() {
  const { locale } = useLocale();
  const settling = useSyncExternalStore(subscribeSettle, isSettling, () => false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (settling === shown) return;
    const timer = window.setTimeout(
      () => setShown(settling),
      settling ? SHOW_AFTER_MS : HOLD_MS
    );
    return () => window.clearTimeout(timer);
  }, [settling, shown]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={shown ? t(locale, "skySettling") : undefined}
      className={cn(
        "ink-bare pointer-events-none fixed right-3 z-40",
        "top-[calc(env(safe-area-inset-top)+12px)]",
        "transition-opacity duration-300",
        shown ? "opacity-100" : "opacity-0"
      )}
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        aria-hidden="true"
        // Spinning only while it shows: an endless animation at opacity 0 would
        // keep the compositor producing frames on every page, for nothing.
        className={cn(
          "text-tertiary-foreground motion-reduce:animate-none",
          shown && "animate-spin"
        )}
        style={{ animationDuration: "0.9s" }}
      >
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" opacity={0.3} />
        <path
          d="M8 2a6 6 0 0 1 6 6"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
