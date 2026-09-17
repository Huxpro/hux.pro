"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AdaptiveSurface } from "@/systems/surface";
import { motion, useReducedMotion } from "framer-motion";
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
// ---------------------------------------------------------------------------

/** How far the phone rocks, in degrees, and how long one there-and-back takes. */
const ROCK_DEG = 17;
const ROCK_SEC = 3.6;

/**
 * One cycle, shared by the phone and by the rain that has to cancel it exactly.
 * Both read the same keyframes and the same spec, so they cannot drift apart —
 * the rain is level with the world only for as long as the two agree.
 */
const ROCK = {
  duration: ROCK_SEC,
  repeat: Infinity,
  ease: "easeInOut",
} as const;

const DROPS = [
  { x: 18, delay: 0.62 },
  { x: 26, delay: 0.0 },
  { x: 33, delay: 1.12 },
  { x: 41, delay: 0.44 },
  { x: 48, delay: 0.86 },
  { x: 55, delay: 0.16 },
  { x: 63, delay: 1.3 },
  { x: 70, delay: 0.52 },
  { x: 78, delay: 0.98 },
  { x: 30, delay: 0.3 },
  { x: 60, delay: 0.72 },
];

function TiltIllustration({ still }: { still: boolean }) {
  // Held at one end of the rock rather than upright: a still picture of a
  // tilted phone still says what the animation says, where a straight one
  // would just be a phone.
  const angle = still ? -ROCK_DEG : 0;
  return (
    <div
      aria-hidden="true"
      className="flex h-44 items-center justify-center overflow-hidden"
    >
      <motion.svg
        width="108"
        height="176"
        viewBox="0 0 96 160"
        fill="none"
        initial={{ rotate: angle }}
        animate={still ? { rotate: angle } : { rotate: [-ROCK_DEG, ROCK_DEG, -ROCK_DEG] }}
        transition={still ? undefined : ROCK}
        style={{ originX: 0.5, originY: 0.5 }}
      >
        <defs>
          <clipPath id="tilt-primer-screen">
            <rect x="13" y="9" width="70" height="142" rx="10" />
          </clipPath>
        </defs>

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
          <motion.g
            initial={{ rotate: -angle }}
            animate={still ? { rotate: -angle } : { rotate: [ROCK_DEG, -ROCK_DEG, ROCK_DEG] }}
            transition={still ? undefined : ROCK}
            style={{ originX: "48px", originY: "80px" }}
          >
            {DROPS.map((drop) => (
              <motion.line
                key={`${drop.x}-${drop.delay}`}
                x1={drop.x}
                x2={drop.x}
                y1={-46}
                y2={-18}
                strokeWidth="1.5"
                strokeLinecap="round"
                className="stroke-foreground/45"
                initial={{ y: 0 }}
                animate={still ? { y: 90 } : { y: [0, 210] }}
                transition={
                  still
                    ? undefined
                    : {
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear",
                        delay: drop.delay,
                      }
                }
              />
            ))}
          </motion.g>
        </g>
      </motion.svg>
    </div>
  );
}

const BUTTON =
  "w-full rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors " +
  "active:scale-[0.99] motion-reduce:active:scale-100";

export function TiltPrimerSheet() {
  const { locale } = useLocale();
  const { isTiltPrimerOpen, answerTiltPrimer } = useWallpaper();
  const reducedMotion = useReducedMotion() ?? false;

  return (
    <AdaptiveSurface
      id="surface-tilt-primer"
      open={isTiltPrimerOpen}
      // Any other way out is the same as "not now": nothing is granted, and
      // the offer is spent either way.
      onOpenChange={(open) => {
        if (!open) answerTiltPrimer(false);
      }}
      presentation={{ base: "sheet" }}
      title={t(locale, "tiltPrimerTitle")}
      closeLabel={t(locale, "tiltPrimerDismiss")}
      // No detents: a picture, a paragraph and two buttons is a form sheet, not
      // a list, so it stands as tall as it is and no taller.
      fitContent
    >
      <div className="space-y-4 pb-2">
        <TiltIllustration still={reducedMotion} />
        <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground">
          {t(locale, "tiltPrimerBody")}
        </p>
        <div className="space-y-2">
          <button
            type="button"
            // Straight from the press: `answerTiltPrimer(true)` reaches
            // `requestPermission()` in the same task, which is the only thing
            // that makes WebKit's dialog appear at all.
            onClick={() => answerTiltPrimer(true)}
            className={cn(BUTTON, "bg-foreground text-background hover:bg-foreground/90")}
          >
            {t(locale, "tiltPrimerConfirm")}
          </button>
          <button
            type="button"
            onClick={() => answerTiltPrimer(false)}
            className={cn(BUTTON, "bg-foreground/[0.06] hover:bg-foreground/10")}
          >
            {t(locale, "tiltPrimerDismiss")}
          </button>
        </div>
        <p className="px-0.5 text-center text-[11px] leading-snug text-tertiary-foreground">
          {t(locale, "tiltPrimerAsk")}
          <br />
          {t(locale, "tiltPrimerAgain")}
        </p>
      </div>
    </AdaptiveSurface>
  );
}
