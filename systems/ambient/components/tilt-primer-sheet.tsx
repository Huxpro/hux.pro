"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useWallpaper } from "../provider";
import { OFFER_DWELL, PermissionSheet, usePermissionOffer } from "./permission-sheet";

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
// — so a phone tilts one way and the rain inside it tilts the other, which is
// the whole feature at a size that fits above a paragraph, and the same
// relationship the shader draws at full size: the weather is aimed at real
// down, and the screen is what turns.
//
// Both of them move because of where the camera stands, and that is the whole
// legibility of the thing: drawn in the world's frame the rain would be fixed
// and only the phone would turn — leaving the one thing worth noticing as the
// one thing that never changes. The camera follows the device part of the way
// instead, so the cause and the effect are both on screen with the angle
// between them still exactly the device's. See the block in globals.css.
//
// The sheet's shape is shared with the other offers (permission-sheet.tsx).
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
 * without this component having to know — and it lands on a tilted phone with
 * the rain slanting the other way, which says it in one frame.
 *
 *   rocking — the phone tilts one way, the rain the other. The promise, and
 *             the argument.
 *   flat    — upright, rain straight down the screen. Nothing leaning at all,
 *             which is exactly what a refused browser gives you, and the
 *             honest thing to show next to the sentence saying so.
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
      {/* The viewBox holds the phone at the angle it is DRAWN at — c·θ, so
          107 × 164 about (48, 80) — or the SVG viewport cuts a straight line
          through the corner. It is tighter than the device's own tilt because
          the camera only follows part of the way; see globals.css. */}
      <svg viewBox="-9 -6 114 172" width="135" height="203" fill="none">
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

          {/* And the weather inside it, which turns the other way — its own
              rotation is the device's whole angle, and the camera above takes
              back part of it. The same counter-rotation the shader does per
              fragment, here done once. */}
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

export function TiltPrimerSheet() {
  const { locale } = useLocale();
  const { isTiltPrimerOpen, closeTiltPrimer, takeTilt } = useWallpaper();
  const { phase, view, ask } = usePermissionOffer<"granted" | "denied">({
    open: isTiltPrimerOpen,
    close: closeTiltPrimer,
    dwell: (outcome) => OFFER_DWELL[outcome],
  });

  // "prompt" is the gate refusing to even consider it — no dialog was shown
  // and nothing was answered, so the offer is simply still standing.
  const take = () =>
    ask(async () => {
      const access = await takeTilt();
      return access === "denied" ? "denied" : access === "prompt" ? "offer" : "granted";
    });

  return (
    <PermissionSheet
      id="surface-tilt-primer"
      open={isTiltPrimerOpen}
      close={closeTiltPrimer}
      title={t(locale, "tiltPrimerTitle")}
      // A refusal gets the picture of what a refusal leaves you with.
      picture={<TiltIllustration pose={phase === "denied" ? "flat" : "rocking"} />}
      view={view}
      busy={phase === "asking"}
      status={(outcome) =>
        t(locale, outcome === "granted" ? "tiltPrimerGranted" : "tiltPrimerDenied")
      }
      body={t(locale, "tiltPrimerBody")}
      // `takeTilt()` reaches `requestPermission()` in the tap's own task.
      confirm={{ label: t(locale, "tiltPrimerConfirm"), onClick: take }}
      dismiss={{ label: t(locale, "tiltPrimerDismiss"), onClick: closeTiltPrimer }}
      note={[t(locale, "tiltPrimerAsk"), t(locale, "tiltPrimerAgain")]}
    />
  );
}
