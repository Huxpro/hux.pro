"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { useState } from "react";
import { isGyroReachable } from "../lib/gyroscope";
import { useLocation, useWallpaper } from "../provider";
import { OFFER_DWELL, PermissionSheet, usePermissionOffer } from "./permission-sheet";

// ---------------------------------------------------------------------------
// SkyWindowSheet — the offer that comes before the sky window's prompts.
//
// Summoned by pulling the home down while WebKit's motion gate still stands,
// or while the place is only a guess (lib/sky-pull.ts), and mounted in the
// layout beside the wallpaper picker. What it offers is the sky window
// (lib/sky-window.ts): the phone as a window onto the real sky. Two gestures
// reach the browser's dialog, and the first is why the second gets a yes: a
// permission prompt with no idea what it is for gets refused, and a refusal is
// final everywhere.
//
// It is the window's own sheet, beside the tilt's (TiltPrimerSheet) and not a
// mode of it: that one is the rain-and-snow egg's long press, offering the
// tilt for the weather that falls; this one is the pull, offering the window
// in any weather, and the place with it.
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
// globals.css for why it is drawn from the world's frame, where the tilt
// primer's picture is drawn from the phone's.
//
// The sheet's shape is shared with the other offers (permission-sheet.tsx).
//
// It stays up through the browser's dialog and says how it went, because it is
// the only thing on screen that can. A refusal especially: the sky simply stays
// a wallpaper, and without a word here there is no explanation anywhere. So it
// says it once, with where to undo it, and then gets out of the way on its
// own. A grant gets a word too, shorter: the window is already opening behind
// the sheet. A pull after an earlier refusal opens straight onto that refusal,
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

/** A grant that also has to say how the place went reads a line longer. */
const DWELL_WITH_PLACE = 2200;

export function SkyWindowSheet() {
  const { locale } = useLocale();
  const {
    isSkyOfferOpen: isOpen,
    closeSkyOffer: close,
    takeSkyWindow,
    gyro,
    skyWantsLocation,
    setSkyWindow,
  } = useWallpaper();
  const { requestAccurateLocation } = useLocation();
  const [place, setPlace] = useState<Place>(null);
  // Whether this opening asks for the place too — decided as it opens and held
  // for the life of the sheet, so a fix landing halfway through does not
  // rewrite the offer under the visitor's thumb.
  const [askPlace, setAskPlace] = useState(false);
  // Motion already flows (Chrome, Android, a past grant): the sheet is only
  // here for the place, so it says that, and lets the window open without it.
  const [motionOpen, setMotionOpen] = useState(false);

  const { phase, view, ask } = usePermissionOffer<"granted" | "denied">({
    open: isOpen,
    close,
    dwell: (outcome) =>
      outcome === "granted" && place ? DWELL_WITH_PLACE : OFFER_DWELL[outcome],
    // A pull after an earlier refusal opens straight onto that refusal,
    // because it is the only thing still true.
    opening: () => {
      setPlace(null);
      setAskPlace(skyWantsLocation);
      setMotionOpen(gyro.reachable);
      return gyro.denied ? "denied" : "offer";
    },
  });

  const take = () =>
    ask(async () => {
      // Motion FIRST: WebKit's gate only opens from inside the tap's own task,
      // and the location prompt needs no such thing — so the place is asked
      // for once motion has had its answer, which also keeps the two dialogs
      // from arriving on top of each other.
      const access = await takeSkyWindow();
      // "prompt" is the gate refusing to even consider it — no dialog was
      // shown and nothing was answered, so the offer is simply still standing.
      if (access === "prompt") return "offer";
      // The place is worth having whatever motion said: without the window
      // the stage's sun and moon are still placed by it.
      if (askPlace) {
        const outcome = await requestAccurateLocation();
        setPlace(outcome === "granted" ? "shared" : "guessed");
      }
      return isGyroReachable(access) ? "granted" : "denied";
    });

  // Motion was never the question: open the window on the network's guess.
  const skipPlace = () => {
    setSkyWindow(true);
    close();
  };
  const onlyPlace = motionOpen && askPlace;

  return (
    <PermissionSheet
      id="surface-sky-window"
      open={isOpen}
      close={close}
      title={t(locale, "tiltPrimerTitle")}
      // A refusal gets the picture of what a refusal leaves you with.
      picture={<WindowIllustration pose={phase === "denied" ? "still" : "panning"} />}
      view={view}
      busy={phase === "asking"}
      status={(outcome) =>
        outcome === "denied"
          ? t(locale, "tiltPrimerDenied")
          : place === "shared"
            ? t(locale, "skySheetGrantedPlace")
            : place === "guessed"
              ? t(locale, "skySheetGrantedGuess")
              : t(locale, "skySheetGranted")
      }
      body={
        <>
          {t(locale, onlyPlace ? "skySheetBodyPlace" : "skySheetBody")}
          {askPlace && !motionOpen && <> {t(locale, "skySheetAlsoPlace")}</>}
        </>
      }
      // `takeSkyWindow()` reaches `requestPermission()` in the tap's own task.
      confirm={{ label: t(locale, "skySheetConfirm"), onClick: take }}
      dismiss={{
        label: t(locale, onlyPlace ? "skySheetSkipPlace" : "tiltPrimerDismiss"),
        onClick: onlyPlace ? skipPlace : close,
      }}
      note={[
        t(locale, !askPlace ? "tiltPrimerAsk" : motionOpen ? "skySheetAskPlace" : "skySheetAskBoth"),
        t(locale, "skySheetAgain"),
      ]}
    />
  );
}
