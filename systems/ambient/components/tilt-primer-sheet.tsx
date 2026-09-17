"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AdaptiveSurface } from "@/systems/surface";
import { useEffect, useState } from "react";
import { useWallpaper } from "../provider";

// ---------------------------------------------------------------------------
// TiltPrimerSheet — the offer that comes before the motion prompt.
//
// Summoned by a finger resting on a rainy or snowy background (lib/tilt-primer.ts),
// mounted in the layout beside the wallpaper picker. Two presses reach the
// browser's dialog, and the first one is why the second gets a yes: a
// permission prompt with no idea what it is for gets refused, and a refusal is
// final everywhere.
//
// A sheet at every width rather than the usual sheet → panel → window. The
// whole thing only exists on a device with a gyroscope behind a WebKit gate,
// which is a phone; there is no desktop shape to design because there is no
// desktop case.
//
// The picture is the argument. Saying "the rain leans" is the part nobody reads
// — so a phone rocks, and the rain inside it stays level with the world while
// the phone moves under it. That is the whole feature, at a size that fits
// above a paragraph, and it is the same relationship the shader draws at full
// size: the weather is aimed at real down, and the screen is what turns.
//
// It stays up through the browser's dialog and says how it went, because it is
// the only thing on screen that can. A refusal especially: the sky simply goes
// on falling straight down, and without a word here the only explanation lives
// three taps away in a picker the visitor has no reason to open — which is the
// very problem this sheet exists to fix. So it says it once, with where to undo
// it, and then gets out of the way on its own. A grant gets a word too, shorter:
// the phone in your hand is about to do the thing, and the sheet is in front of
// it.
// ---------------------------------------------------------------------------

/**
 * The rain, as one seamless tile `TILE` units tall, stamped three times so a
 * slide of exactly one tile loops without a seam. Fixed rather than generated,
 * because a field rolled at render time would differ between the server's HTML
 * and the client's.
 *
 * Eleven strokes, evenly spaced, all one length and one weight — about five on
 * screen at a time. This is a diagram and not a downpour: it has exactly one
 * thing to say, and every drop past the few it takes to read as rain is a
 * distraction competing with it. Even spacing for the same reason — scattered
 * drops read as a simulation, and a window showing only two fifths of the field
 * turns scatter into clumps as the field rotates through it.
 *
 * The x range is wider than the screen on purpose. The field turns under the
 * phone, and a field only as wide as the screen swings out from under its own
 * corners — what cuts the shower off is then the field's edge and not the
 * phone. It is sized by the screen's half-diagonal about the rock's centre
 * (79.2 units), so no rotation can empty a corner. See the block in
 * globals.css.
 */
const TILE = 120;
const LEN = 28;

const RAIN = [
  { x: -26.5, y: 28.6 },
  { x: -11.5, y: 65.3 },
  { x: 3.5, y: 44.4 },
  { x: 18.5, y: 72.5 },
  { x: 33.5, y: 75.1 },
  { x: 48.5, y: 7.9 },
  { x: 63.5, y: 1.6 },
  { x: 78.5, y: 100.5 },
  { x: 93.5, y: 31.1 },
  { x: 108.5, y: 28.1 },
  { x: 123.5, y: 119.5 },
];

/**
 * How the picture is standing. `held` is not a third drawing: it is these same
 * animations paused at 0%, which CSS does under `prefers-reduced-motion`
 * without this component having to know.
 *
 *   rocking — the phone turns and the rain stays level with the world. The
 *             promise, and the argument.
 *   flat    — upright, rain straight down the screen. What a refused browser
 *             actually gives you, which is the honest thing to show next to
 *             the sentence saying so.
 */
type Pose = "rocking" | "flat";

function TiltIllustration({ pose }: { pose: Pose }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-52 items-center justify-center",
        pose === "flat" && "tilt-primer-flat"
      )}
    >
      {/* The viewBox holds the phone at full tilt — 121 × 169 about (48, 80) —
          or the SVG viewport cuts a straight line through the corner. */}
      <svg viewBox="-15 -7 126 174" width="139" height="191" fill="none">
        <defs>
          <clipPath id="tilt-primer-screen">
            <rect x="13" y="9" width="70" height="142" rx="10" />
          </clipPath>
          <g
            id="tilt-primer-rain"
            className="stroke-foreground"
            strokeLinecap="round"
            strokeWidth={1.2}
            opacity={0.32}
          >
            {RAIN.map((d) => (
              <line key={d.x} x1={d.x} x2={d.x} y1={d.y} y2={d.y + LEN} />
            ))}
          </g>
        </defs>

        <g className="tilt-primer-phone">
          {/* The device. */}
          <rect
            x="8"
            y="4"
            width="80"
            height="152"
            rx="15"
            className="fill-foreground/[0.04] stroke-foreground/25"
            strokeWidth="1.5"
          />
          <rect
            x="13"
            y="9"
            width="70"
            height="142"
            rx="10"
            className="fill-foreground/[0.06]"
          />
          {/* The notch, so it reads as a phone and not as a card. */}
          <rect x="38" y="13" width="20" height="4" rx="2" className="fill-foreground/20" />

          {/* And the weather inside it, which does not turn with it. The same
              counter-rotation the shader does per fragment, here done once. */}
          <g clipPath="url(#tilt-primer-screen)">
            <g className="tilt-primer-level">
              <g className="tilt-primer-fall">
                <use href="#tilt-primer-rain" y={-TILE} />
                <use href="#tilt-primer-rain" />
                <use href="#tilt-primer-rain" y={TILE} />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

/**
 * The phases of one press. `asking` is the browser's own dialog, which covers
 * the page — nobody really sees that state, it just has to not offer the button
 * twice.
 */
type Phase = "offer" | "asking" | "granted" | "denied";

/**
 * How long the outcome stays up before the sheet closes itself, ms. Long enough
 * to read once and no longer; a refusal gets more because it carries the way
 * back, and because it is the one nobody was expecting.
 */
const DWELL: Record<"granted" | "denied", number> = {
  granted: 1400,
  denied: 3000,
};

const BUTTON =
  "w-full rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors " +
  "active:scale-[0.99] motion-reduce:active:scale-100";

export function TiltPrimerSheet() {
  const { locale } = useLocale();
  const { isTiltPrimerOpen, closeTiltPrimer, takeTilt } = useWallpaper();
  const [phase, setPhase] = useState<Phase>("offer");

  // The outcome shows, and then the sheet lets itself out.
  useEffect(() => {
    if (phase !== "granted" && phase !== "denied") return;
    const timer = window.setTimeout(closeTiltPrimer, DWELL[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, closeTiltPrimer]);

  // Back to the offer for the next time there is one. There is no next time
  // today — the offer is spent — but the component outlives the sheet, and a
  // sheet that reopened already answered would be a puzzle.
  //
  // On the way IN rather than on the way out, and during the render that opens
  // it rather than after: swapping the content back while the sheet is still
  // animating away would show the offer flashing behind the outcome.
  const [wasOpen, setWasOpen] = useState(isTiltPrimerOpen);
  if (wasOpen !== isTiltPrimerOpen) {
    setWasOpen(isTiltPrimerOpen);
    if (isTiltPrimerOpen) setPhase("offer");
  }

  const take = async () => {
    setPhase("asking");
    const access = await takeTilt();
    // "prompt" is the gate refusing to even consider it — no dialog was shown
    // and nothing was answered, so the offer is simply still standing.
    setPhase(
      access === "denied"
        ? "denied"
        : access === "prompt"
          ? "offer"
          : "granted"
    );
  };

  const settled = phase === "granted" || phase === "denied";

  return (
    <AdaptiveSurface
      id="surface-tilt-primer"
      open={isTiltPrimerOpen}
      // Any other way out is the same as "not now": nothing is granted, and
      // the offer is spent either way.
      onOpenChange={(open) => {
        if (!open) closeTiltPrimer();
      }}
      presentation={{ base: "sheet" }}
      title={t(locale, "tiltPrimerTitle")}
      closeLabel={t(locale, "tiltPrimerDismiss")}
      // No detents: a picture, a paragraph and two buttons is a form sheet, not
      // a list, so it stands as tall as it is and no taller.
      fitContent
    >
      <div className="space-y-4 pb-2">
        {/* A refusal gets the picture of what a refusal leaves you with. */}
        <TiltIllustration pose={phase === "denied" ? "flat" : "rocking"} />
        {!settled && (
          <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground">
            {t(locale, "tiltPrimerBody")}
          </p>
        )}
        {settled ? (
          <p
            role="status"
            className={cn(
              "px-0.5 py-2 text-center text-[15px] leading-relaxed",
              phase === "granted" ? "text-foreground" : "text-secondary-foreground"
            )}
          >
            {t(locale, phase === "granted" ? "tiltPrimerGranted" : "tiltPrimerDenied")}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <button
                type="button"
                // Straight from the press: `takeTilt()` reaches
                // `requestPermission()` in the same task, which is the only
                // thing that makes WebKit's dialog appear at all.
                onClick={take}
                disabled={phase === "asking"}
                className={cn(
                  BUTTON,
                  "bg-foreground text-background hover:bg-foreground/90",
                  "disabled:opacity-50"
                )}
              >
                {t(locale, "tiltPrimerConfirm")}
              </button>
              <button
                type="button"
                onClick={closeTiltPrimer}
                disabled={phase === "asking"}
                className={cn(
                  BUTTON,
                  "bg-foreground/[0.06] hover:bg-foreground/10",
                  "disabled:opacity-50"
                )}
              >
                {t(locale, "tiltPrimerDismiss")}
              </button>
            </div>
            <p className="px-0.5 text-center text-[11px] leading-snug text-tertiary-foreground">
              {t(locale, "tiltPrimerAsk")}
              <br />
              {t(locale, "tiltPrimerAgain")}
            </p>
          </>
        )}
      </div>
    </AdaptiveSurface>
  );
}
