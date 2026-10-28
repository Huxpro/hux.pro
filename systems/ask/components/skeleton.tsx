"use client";

import { cn } from "@/lib/utils";
import { useLocale } from "@/services";
import { HEADER_BUTTON } from "@/systems/surface";
import { ChevronLeft, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { askStrings } from "../strings";

// =============================================================================
// What a surface shows while Ask's conversation is still on its way.
//
// The chat (AI Elements, streamdown, the AI SDK client) loads the first time
// Ask is called. The thing holding it does not wait: the command card, the
// side panel and the phone drawer are already up, and this stands in the
// conversation's place so the wait reads as loading rather than as a shell
// with nothing in it. It paints no text of a conversation, because there is
// none yet; the bars are the empty state, the header and the composer.
// =============================================================================

const BAR = "block rounded-md bg-muted animate-pulse motion-reduce:animate-none";

const CENTER_BUTTON =
  "pressable flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground";

export function AskSkeleton({
  kind,
  onClose,
  onBack,
  trailing,
}: {
  /** `center` fills the command card. `surface` fills a panel or a drawer.
   *  `dock` is only the body: the Dock's panel brings its own header. */
  kind: "center" | "surface" | "dock";
  onClose?: () => void;
  onBack?: () => void;
  trailing?: ReactNode;
}) {
  const { locale } = useLocale();
  const s = askStrings(locale);
  const dock = kind === "dock";

  return (
    <div
      role="status"
      aria-busy="true"
      className={cn("flex min-h-0 min-w-0 flex-1 flex-col", dock && "h-full")}
    >
      {!dock && (
        <div
          className={cn(
            "flex shrink-0 items-center gap-1",
            kind === "center"
              ? "h-11 border-b border-border/50 px-2"
              : "justify-between gap-2 px-5 pt-3 pb-2",
          )}
        >
          {kind === "center" ? (
            <>
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label={s.backToSearch}
                  title={s.backToSearch}
                  className={CENTER_BUTTON}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <span className="flex-1 px-1 font-sans text-sm font-medium text-muted-foreground">{s.ask}</span>
              <span aria-hidden className="size-8 rounded-md bg-muted/70 animate-pulse motion-reduce:animate-none" />
              {trailing}
            </>
          ) : (
            <>
              <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-xs font-mono text-muted-foreground">
                <Sparkles className="size-3.5 shrink-0" />
                {s.ask}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <span aria-hidden className="size-8 rounded-md bg-muted/70 animate-pulse motion-reduce:animate-none" />
                {onClose && (
                  <button type="button" onClick={onClose} aria-label={s.close} className={cn(HEADER_BUTTON, "-mr-2")}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
        <span aria-hidden className={cn(BAR, "h-4 w-40")} />
        <span aria-hidden className={cn(BAR, "h-3 w-56 bg-muted/70")} />
        <span className="mt-3 flex w-full max-w-sm flex-col gap-2">
          <span aria-hidden className={cn(BAR, "h-9 w-full bg-muted/60")} />
          <span aria-hidden className={cn(BAR, "h-9 w-4/5 bg-muted/60")} />
          <span aria-hidden className={cn(BAR, "h-9 w-3/5 bg-muted/60")} />
        </span>
      </div>

      <div className={cn("shrink-0", dock ? "px-3 pt-1 pb-1.5" : "p-2 pt-0")}>
        <div aria-hidden className="rounded-xl border border-border/50 px-3 py-3">
          <span className={cn(BAR, "h-4 w-2/3 bg-muted/70")} />
          <span className="mt-3 flex items-center gap-2">
            <span className="size-8 rounded-full bg-muted/70 animate-pulse motion-reduce:animate-none" />
            <span className={cn(BAR, "h-7 w-16 rounded-full bg-muted/60")} />
            <span className={cn(BAR, "h-7 w-20 rounded-full bg-muted/60")} />
            <span className="ml-auto size-8 rounded-full bg-muted/80 animate-pulse motion-reduce:animate-none" />
          </span>
        </div>
      </div>
      <span className="sr-only">{s.loading}</span>
    </div>
  );
}

/** A failed code chunk cannot recover in place after a deployment. */
export function AskLoadError() {
  const { locale } = useLocale();
  const s = askStrings(locale);
  return (
    <div role="alert" className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
      <p>{s.error}</p>
      <button type="button" onClick={() => window.location.reload()} className="pressable rounded-full bg-muted px-4 py-2 text-foreground">
        {s.retry}
      </button>
    </div>
  );
}
