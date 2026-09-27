"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AdaptiveSurface, SurfaceMorph } from "@/systems/surface";
import { useEffect, useState } from "react";
import { isGyroReachable } from "../lib/gyroscope";
import { useLocation, useWallpaper } from "../provider";

// ---------------------------------------------------------------------------
// TiltPrimerSheet — the offer that comes before the motion prompt.
//
// Summoned by a finger resting on the home sky while WebKit's motion gate still
// stands (lib/tilt-primer.ts), mounted in the layout beside the wallpaper
// picker. What it offers is the sky window (lib/sky-window.ts): the phone as a
// window onto the real sky. Two presses reach the browser's dialog, and the
// first one is why the second gets a yes: a permission prompt with no idea what
// it is for gets refused, and a refusal is final everywhere.
//
// A sheet at every width rather than the usual sheet → panel → window. The
// whole thing only exists on a device with a gyroscope behind a WebKit gate,
// which is a phone; there is no desktop shape to design because there is no
// desktop case.
//
// The picture is the argument. Saying "the sky holds still while you turn" is
// the part nobody reads — so a phone pans across a faint sky, and inside the
// phone the same sky is drawn in full, holding still while the phone moves
// over it. The sun comes into the window and goes out of it again, and that
// is the feature at a size that fits above a paragraph. See the block in
// globals.css for why it is drawn from the world's frame, where the tilt's
// old picture had to be drawn from the phone's.
//
// It stays up through the browser's dialog and says how it went, because it is
// the only thing on screen that can. A refusal especially: the sky simply stays
// a wallpaper, and without a word here there is no explanation anywhere. So it
// says it once, with where to undo it, and then gets out of the way on its
// own. A grant gets a word too, shorter: the window is already opening behind
// the sheet. A hold after an earlier refusal opens straight onto that refusal,
// because it is the only thing still true.
// ---------------------------------------------------------------------------

/**
 * How the picture is standing.
 *
 *   panning — the phone sweeps across the sky and the sky inside it holds
 *             still. The promise, and the argument.
 *   still   — the phone parked between the sun and the moon, showing neither:
 *             a window that does not turn is a window onto one patch of sky,
 *             which is exactly what a refused browser gives you.
 *
 * Under `prefers-reduced-motion` the panning animations are paused at 0%, which
 * is the phone framing the sun — the still frame says it in one picture.
 */
type Pose = "panning" | "still";

/**
 * The sky the phone looks into, in the world's frame: a horizon, a sun low on
 * the left and a crescent higher on the right. Drawn twice — faint for the
 * world outside the phone, full inside it.
 */
function Panorama() {
  return (
    <>
      <line
        x1="-40"
        x2="240"
        y1="118"
        y2="118"
        className="stroke-foreground"
        strokeWidth="1.2"
        opacity={0.35}
      />
      <circle cx="46" cy="80" r="20" className="fill-foreground" opacity={0.07} />
      <circle cx="46" cy="80" r="8" className="fill-foreground" opacity={0.7} />
      <path
        d="M156 40 A8 8 0 1 0 156 56 A5.5 8 0 1 1 156 40 Z"
        className="fill-foreground"
        opacity={0.6}
      />
    </>
  );
}

function WindowIllustration({ pose }: { pose: Pose }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-52 items-center justify-center",
        pose === "still" && "sky-primer-still"
      )}
    >
      <svg viewBox="0 0 200 172" width="236" height="203" fill="none">
        <defs>
          <clipPath id="sky-primer-screen">
            <rect x="69" y="23" width="62" height="126" rx="9" />
          </clipPath>
        </defs>

        {/* The world, faint: what the phone is not pointed at. */}
        <g opacity={0.35}>
          <Panorama />
        </g>

        <g className="sky-primer-phone">
          <rect
            x="64"
            y="18"
            width="72"
            height="136"
            rx="14"
            className="fill-background stroke-foreground/25"
            strokeWidth="1.5"
          />
          <rect
            x="69"
            y="23"
            width="62"
            height="126"
            rx="9"
            className="fill-foreground/[0.06]"
          />
          {/* The same world, in full, held still while the phone moves: the
              inner group undoes the phone's travel, the same nesting the old
              rain picture used for its counter-rotation. */}
          <g clipPath="url(#sky-primer-screen)">
            <g className="sky-primer-world">
              <Panorama />
            </g>
          </g>
          {/* The notch, so it reads as a phone and not as a card. */}
          <rect x="91" y="27" width="18" height="4" rx="2" className="fill-foreground/20" />
        </g>
      </svg>
    </div>
  );
}

/**
 * How the place went, when the sheet asked for it too: shared, not (refused,
 * or no fix to be had), or never asked.
 */
type Place = "shared" | "guessed" | null;

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
/** A grant that also has to say how the place went reads a line longer. */
const DWELL_WITH_PLACE = 2200;

const BUTTON =
  "w-full rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors " +
  "active:scale-[0.99] motion-reduce:active:scale-100";

export function TiltPrimerSheet() {
  const { locale } = useLocale();
  const {
    isTiltPrimerOpen,
    closeTiltPrimer,
    takeTilt,
    gyro,
    skyWantsLocation,
    setSkyWindow,
  } = useWallpaper();
  const { requestAccurateLocation } = useLocation();
  const [phase, setPhase] = useState<Phase>("offer");
  const [place, setPlace] = useState<Place>(null);
  // Whether this opening asks for the place too — decided as it opens and held
  // for the life of the sheet, so a fix landing halfway through does not
  // rewrite the offer under the visitor's thumb.
  const [askPlace, setAskPlace] = useState(false);
  // Motion already flows (Chrome, Android, a past grant): the sheet is only
  // here for the place, so it says that, and lets the window open without it.
  const [motionOpen, setMotionOpen] = useState(false);

  // The outcome shows, and then the sheet lets itself out.
  useEffect(() => {
    if (phase !== "granted" && phase !== "denied") return;
    const dwell = phase === "granted" && place ? DWELL_WITH_PLACE : DWELL[phase];
    const timer = window.setTimeout(closeTiltPrimer, dwell);
    return () => window.clearTimeout(timer);
  }, [phase, place, closeTiltPrimer]);

  // Back to the offer for the next time there is one — or straight to the
  // refusal, when that is what stands: the component outlives the sheet, and a
  // sheet that reopened on its last answer would be a puzzle.
  //
  // On the way IN rather than on the way out, and during the render that opens
  // it rather than after: swapping the content back while the sheet is still
  // animating away would show the offer flashing behind the outcome.
  const [wasOpen, setWasOpen] = useState(isTiltPrimerOpen);
  if (wasOpen !== isTiltPrimerOpen) {
    setWasOpen(isTiltPrimerOpen);
    if (isTiltPrimerOpen) {
      setPhase(gyro.denied ? "denied" : "offer");
      setPlace(null);
      setAskPlace(skyWantsLocation);
      setMotionOpen(gyro.reachable);
    }
  }

  const take = async () => {
    setPhase("asking");
    // Motion FIRST: WebKit's gate only opens from inside the tap's own task,
    // and the location prompt needs no such thing — so the place is asked for
    // once motion has had its answer, which also keeps the two dialogs from
    // arriving on top of each other.
    const access = await takeTilt();
    // "prompt" is the gate refusing to even consider it — no dialog was shown
    // and nothing was answered, so the offer is simply still standing.
    if (access === "prompt") {
      setPhase("offer");
      return;
    }
    // The place is worth having whatever motion said: without the window the
    // stage's sun and moon are still placed by it.
    if (askPlace) {
      const outcome = await requestAccurateLocation();
      setPlace(outcome === "granted" ? "shared" : "guessed");
    }
    setPhase(isGyroReachable(access) ? "granted" : "denied");
  };

  // Motion was never the question: open the window on the network's guess.
  const skipPlace = () => {
    setSkyWindow(true);
    closeTiltPrimer();
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
        <WindowIllustration pose={phase === "denied" ? "still" : "panning"} />
        {/* The offer, then how it went, in the same sheet: the words
            cross-fade and the sheet eases to its new height rather than
            cutting to it (SurfaceMorph). The picture stays; its pose is its
            own. */}
        <SurfaceMorph
          step={settled ? phase : "offer"}
          render={(view) =>
            view === "granted" || view === "denied" ? (
              <p
                role="status"
                className={cn(
                  "px-0.5 py-2 text-center text-[15px] leading-relaxed",
                  view === "granted" ? "text-foreground" : "text-secondary-foreground"
                )}
              >
                {view === "denied"
                  ? t(locale, "tiltPrimerDenied")
                  : place === "shared"
                    ? t(locale, "tiltPrimerGrantedPlace")
                    : place === "guessed"
                      ? t(locale, "tiltPrimerGrantedGuess")
                      : t(locale, "tiltPrimerGranted")}
              </p>
            ) : (
              <div className="space-y-4">
                <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground">
                  {t(locale, motionOpen && askPlace ? "tiltPrimerBodyPlace" : "tiltPrimerBody")}
                  {askPlace && !motionOpen && <> {t(locale, "tiltPrimerAlsoPlace")}</>}
                </p>
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
                    onClick={motionOpen && askPlace ? skipPlace : closeTiltPrimer}
                    disabled={phase === "asking"}
                    className={cn(
                      BUTTON,
                      "bg-foreground/[0.06] hover:bg-foreground/10",
                      "disabled:opacity-50"
                    )}
                  >
                    {t(
                      locale,
                      motionOpen && askPlace ? "tiltPrimerSkipPlace" : "tiltPrimerDismiss"
                    )}
                  </button>
                </div>
                <p className="px-0.5 text-center text-[11px] leading-snug text-tertiary-foreground">
                  {t(
                    locale,
                    !askPlace
                      ? "tiltPrimerAsk"
                      : motionOpen
                        ? "tiltPrimerAskPlace"
                        : "tiltPrimerAskBoth"
                  )}
                  <br />
                  {t(locale, "tiltPrimerAgain")}
                </p>
              </div>
            )
          }
        />
      </div>
    </AdaptiveSurface>
  );
}
