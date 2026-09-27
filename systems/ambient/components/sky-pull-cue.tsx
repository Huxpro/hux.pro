"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { Moon, Sun } from "lucide-react";
import { useWeather } from "../provider";

// ---------------------------------------------------------------------------
// SkyPullCue — "there is something up there", while the home is pulled down.
//
// A pull with no answer is a pull that stops halfway; one that feels the top of
// the page give and sees nothing there has no reason to keep going. So as the
// finger pulls (lib/sky-pull.ts) this comes down from the top edge: whichever
// of the sun and the moon is up right now, in a ring that fills with the pull,
// and a line that changes to "let go" at the point where letting go opens the
// window. Under it, the sky is already starting to lift (the renderer's pull
// preview), so the cue and the sky say the same thing.
//
// No React per frame: it is positioned, faded and filled by the pull's own CSS
// variables (`--sky-pull`, `--sky-pull-progress`), and its two lines swap on
// `html[data-sky-armed]` — see "The sky pull" in globals.css. Rendered always
// and invisible at rest; it never takes a pointer, and it is decoration, so the
// screen reader hears the toast that follows instead.
// ---------------------------------------------------------------------------

/** Circumference of the ring, for the fill. */
const RING = 2 * Math.PI * 15;

export function SkyPullCue() {
  const { locale } = useLocale();
  const { scene } = useWeather();
  // What is up there to be looked at: the sun by day and through twilight, the
  // moon otherwise — the thing the window will be about.
  const Body = scene.sun.elevation > -4 ? Sun : Moon;

  return (
    <div aria-hidden="true" className="sky-pull-cue ink-bare pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col items-center">
      <div className="relative h-9 w-9">
        <svg viewBox="0 0 36 36" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-quaternary-foreground" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeDasharray={RING}
            className="sky-pull-cue-fill text-foreground"
            style={{ ["--sky-pull-ring" as string]: RING }}
          />
        </svg>
        <Body className="sky-pull-cue-body absolute inset-0 m-auto h-4 w-4 text-foreground" />
      </div>
      <div className={cn("relative mt-1.5 h-4 text-[12px] font-medium")}>
        <span className="sky-pull-cue-more absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-secondary-foreground">
          {t(locale, "skyPullMore")}
        </span>
        <span className="sky-pull-cue-go absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-foreground">
          {t(locale, "skyPullGo")}
        </span>
      </div>
    </div>
  );
}
