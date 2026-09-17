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
 * The rain, as two seamless tiles — a far layer and a near one, each `TILE`
 * units tall and stamped three times so a slide of exactly one tile loops
 * without a seam. Fixed rather than generated, because a field rolled at
 * render time would differ between the server's HTML and the client's.
 *
 * The x range is wider than the screen on purpose. The field turns under the
 * phone, and a field only as wide as the screen swings out from under its own
 * corners — what cuts the shower off is then the field's edge and not the
 * phone. It is sized by the screen's half-diagonal about the rock's centre
 * (79.2 units), so no rotation can empty a corner. See the block in
 * globals.css.
 */
const TILE = 120;

const RAIN_FAR = [
  { x: -31.1, y: 67.2, len: 13.5, o: 0.2 },
  { x: -24.5, y: 70.5, len: 9.1, o: 0.2 },
  { x: -17.4, y: 95.2, len: 8.6, o: 0.18 },
  { x: -14.5, y: 97.2, len: 12.2, o: 0.15 },
  { x: -2.6, y: 115.8, len: 11.9, o: 0.21 },
  { x: -1.5, y: 1.8, len: 11.2, o: 0.15 },
  { x: 5.0, y: 29.0, len: 8.2, o: 0.2 },
  { x: 12.9, y: 101.1, len: 11.1, o: 0.22 },
  { x: 19.6, y: 79.5, len: 10.7, o: 0.17 },
  { x: 29.1, y: 119.5, len: 13.0, o: 0.22 },
  { x: 31.1, y: 27.6, len: 9.7, o: 0.15 },
  { x: 40.2, y: 48.0, len: 13.1, o: 0.19 },
  { x: 47.7, y: 101.7, len: 8.0, o: 0.17 },
  { x: 53.7, y: 56.4, len: 13.9, o: 0.19 },
  { x: 54.8, y: 75.5, len: 12.7, o: 0.17 },
  { x: 61.2, y: 39.9, len: 13.8, o: 0.23 },
  { x: 67.7, y: 29.6, len: 8.6, o: 0.15 },
  { x: 78.3, y: 21.3, len: 11.4, o: 0.19 },
  { x: 80.7, y: 87.8, len: 8.8, o: 0.22 },
  { x: 86.6, y: 50.5, len: 9.3, o: 0.17 },
  { x: 98.3, y: 96.4, len: 9.8, o: 0.25 },
  { x: 99.8, y: 47.3, len: 13.1, o: 0.22 },
  { x: 105.4, y: 118.7, len: 9.3, o: 0.17 },
  { x: 116.0, y: 39.5, len: 9.8, o: 0.15 },
  { x: 118.0, y: 69.9, len: 9.5, o: 0.21 },
  { x: 126.0, y: 54.4, len: 13.8, o: 0.2 },
];

const RAIN_NEAR = [
  { x: -28.7, y: 41.5, len: 22.6, o: 0.36 },
  { x: -19.4, y: 41.3, len: 18.7, o: 0.49 },
  { x: -13.7, y: 53.4, len: 17.0, o: 0.37 },
  { x: 4.6, y: 39.5, len: 20.5, o: 0.38 },
  { x: 11.6, y: 53.7, len: 16.5, o: 0.39 },
  { x: 18.2, y: 95.1, len: 20.1, o: 0.34 },
  { x: 30.4, y: 35.8, len: 19.6, o: 0.34 },
  { x: 37.5, y: 94.3, len: 19.6, o: 0.45 },
  { x: 50.5, y: 70.5, len: 20.8, o: 0.38 },
  { x: 58.8, y: 93.3, len: 15.9, o: 0.49 },
  { x: 66.0, y: 16.7, len: 16.4, o: 0.37 },
  { x: 72.8, y: 47.7, len: 18.7, o: 0.43 },
  { x: 86.3, y: 112.2, len: 20.9, o: 0.36 },
  { x: 99.9, y: 83.9, len: 23.7, o: 0.45 },
  { x: 110.4, y: 24.6, len: 17.5, o: 0.49 },
  { x: 110.9, y: 110.9, len: 23.2, o: 0.33 },
  { x: 121.8, y: 109.9, len: 23.6, o: 0.47 },
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

function Shower({ id, drops, width }: {
  id: string;
  drops: { x: number; y: number; len: number; o: number }[];
  width: number;
}) {
  return (
    <g id={id} className="stroke-foreground" strokeLinecap="round" strokeWidth={width}>
      {drops.map((d) => (
        <line
          key={`${d.x}-${d.y}`}
          x1={d.x}
          x2={d.x}
          y1={d.y}
          y2={d.y + d.len}
          opacity={d.o}
        />
      ))}
    </g>
  );
}

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
          <Shower id="tilt-primer-far" drops={RAIN_FAR} width={1} />
          <Shower id="tilt-primer-near" drops={RAIN_NEAR} width={1.4} />
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
              <g className="tilt-primer-fall tilt-primer-fall-far">
                <use href="#tilt-primer-far" y={-TILE} />
                <use href="#tilt-primer-far" />
                <use href="#tilt-primer-far" y={TILE} />
              </g>
              <g className="tilt-primer-fall tilt-primer-fall-near">
                <use href="#tilt-primer-near" y={-TILE} />
                <use href="#tilt-primer-near" />
                <use href="#tilt-primer-near" y={TILE} />
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
