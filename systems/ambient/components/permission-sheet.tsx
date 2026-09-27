"use client";

import { cn } from "@/lib/utils";
import { AdaptiveSurface, SurfaceMorph, type SurfacePresentation } from "@/systems/surface";
import { useEffect, useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// PermissionSheet — the shape every "offer before the prompt" shares.
//
// The tilt (TiltPrimerSheet), the place (LocationPrimerSheet) and the sky
// window (SkyWindowSheet) each put a sheet in front of a browser permission
// prompt, for one reason: a prompt that shows up with no idea what it is for
// gets refused, and a refusal is final everywhere. What they offer differs —
// the picture, the words, what the button asks for — and that stays in each
// sheet. What is the same lives here:
//
//   · The phases of one press (`usePermissionOffer`): the offer, the browser's
//     own dialog (`asking`), and how it went. Each opening starts again from
//     the offer; an outcome stays up long enough to read and then the sheet
//     lets itself out.
//   · The sheet itself (`PermissionSheet`): a form sheet as tall as its
//     content, a picture that stays, and under it the offer — a paragraph, the
//     button that asks, the one that doesn't, a footnote — cross-fading into
//     the outcome in the same sheet.
//
// It stays up through the browser's dialog and says how it went, because it
// is the only thing on screen that can.
// ---------------------------------------------------------------------------

/** One press: the offer, the browser's dialog over it, or an outcome. */
export type OfferPhase<Outcome extends string> = "offer" | "asking" | Outcome;

/**
 * How long an outcome stays up before the sheet closes itself, ms. Long enough
 * to read once and no longer; a refusal gets more because it carries the way
 * back, and because it is the one nobody was expecting.
 */
export const OFFER_DWELL = { granted: 1400, denied: 3000 } as const;

/**
 * The phases of one press, for a sheet that is `open` and closes with `close`.
 *
 *   · `dwell` — how long an outcome stays up, ms.
 *   · `opening` — where an opening starts, when that is not always the offer
 *     (a refusal that still stands opens onto the refusal). It runs during the
 *     render that opens the sheet, so it may set the caller's own state too.
 *
 * Returns the phase, the `view` the sheet shows (the offer while the browser's
 * dialog is over it), and `ask`, which runs one request and lands on what it
 * returns — `"offer"` for a gate that would not even show a dialog, where
 * nothing was answered and the offer simply still stands.
 */
export function usePermissionOffer<Outcome extends string>({
  open,
  close,
  dwell,
  opening,
}: {
  open: boolean;
  close: () => void;
  dwell: (outcome: Outcome) => number;
  opening?: () => "offer" | Outcome;
}) {
  const [phase, setPhase] = useState<OfferPhase<Outcome>>("offer");
  const outcome = phase === "offer" || phase === "asking" ? null : (phase as Outcome);
  const wait = outcome === null ? null : dwell(outcome);

  // The outcome shows, and then the sheet lets itself out — each time it is
  // open on one, including an opening that lands straight on the same outcome
  // the last one ended on.
  useEffect(() => {
    if (!open || wait === null) return;
    const timer = window.setTimeout(close, wait);
    return () => window.clearTimeout(timer);
  }, [open, wait, close]);

  // Back to the start for the next opening: the component outlives the sheet,
  // and a sheet that reopened on its last answer would be a puzzle.
  //
  // On the way IN rather than on the way out, and during the render that opens
  // it rather than after: swapping the content back while the sheet is still
  // animating away would show the offer flashing behind the outcome.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setPhase(opening ? opening() : "offer");
  }

  const ask = async (request: () => Promise<"offer" | Outcome>) => {
    setPhase("asking");
    setPhase(await request());
  };

  const view: "offer" | Outcome = outcome ?? "offer";
  return { phase, view, ask };
}

const BUTTON =
  "w-full rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors " +
  "active:scale-[0.99] motion-reduce:active:scale-100 disabled:opacity-50";

export function PermissionSheet<Outcome extends string>({
  id,
  open,
  close,
  title,
  presentation = { base: "sheet" },
  windowWidth,
  picture,
  glyph,
  view,
  busy,
  status,
  body,
  confirm,
  dismiss,
  note,
}: {
  id: string;
  open: boolean;
  /** Every way out that is not the button — the scrim, the close, a swipe. */
  close: () => void;
  title: string;
  presentation?: SurfacePresentation;
  windowWidth?: string;
  /** Above the words, and staying put while they change; its pose is its own. */
  picture?: ReactNode;
  /** Above the words and changing with them, cross-faded like the words. */
  glyph?: (view: "offer" | Outcome) => ReactNode;
  /** The offer, or how it went. */
  view: "offer" | Outcome;
  /** The browser's dialog is up: the buttons must not be pressed twice. */
  busy: boolean;
  /** The words for an outcome; `granted` reads as the good one. */
  status: (outcome: Outcome) => ReactNode;
  body: ReactNode;
  confirm: { label: string; onClick: () => void };
  dismiss: { label: string; onClick: () => void };
  note: [ReactNode, ReactNode];
}) {
  return (
    <AdaptiveSurface
      id={id}
      open={open}
      // Any other way out is the same as "not now": nothing is granted.
      onOpenChange={(next) => {
        if (!next) close();
      }}
      presentation={presentation}
      windowWidth={windowWidth}
      title={title}
      closeLabel={dismiss.label}
      // No detents: a picture, a paragraph and two buttons is a form sheet, not
      // a list, so it stands as tall as it is and no taller.
      fitContent
    >
      <div className="space-y-4 pb-2">
        {picture}
        {/* The offer, then how it went, in the same sheet: the words
            cross-fade and the sheet eases to its new height rather than
            cutting to it (SurfaceMorph). */}
        <SurfaceMorph
          step={view}
          render={(v) => (
            <div className="space-y-4">
              {glyph?.(v)}
              {v === "offer" ? (
                <>
                  <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground">
                    {body}
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      // Straight from the press: whatever asks must reach the
                      // browser in the same task, which is the only thing that
                      // makes WebKit's dialog appear at all.
                      onClick={confirm.onClick}
                      disabled={busy}
                      className={cn(BUTTON, "bg-foreground text-background hover:bg-foreground/90")}
                    >
                      {confirm.label}
                    </button>
                    <button
                      type="button"
                      onClick={dismiss.onClick}
                      disabled={busy}
                      className={cn(BUTTON, "bg-foreground/[0.06] hover:bg-foreground/10")}
                    >
                      {dismiss.label}
                    </button>
                  </div>
                  <p className="px-0.5 text-center text-[11px] leading-snug text-tertiary-foreground">
                    {note[0]}
                    <br />
                    {note[1]}
                  </p>
                </>
              ) : (
                <p
                  role="status"
                  className={cn(
                    "px-0.5 py-2 text-center text-[15px] leading-relaxed",
                    v === "granted" ? "text-foreground" : "text-secondary-foreground"
                  )}
                >
                  {status(v as Outcome)}
                </p>
              )}
            </div>
          )}
        />
      </div>
    </AdaptiveSurface>
  );
}
