"use client";

import { t, useLocale } from "@/services";
import { sunEventOf } from "../lib/phase";
import { useAmbientTime, useWeather } from "../provider";
import { MoonGlyph, SunEventGlyph, SunGlyph } from "./body-glyph";

// ---------------------------------------------------------------------------
// SkyPullCue — "there is something up there", while the home is pulled down.
//
// A pull with no answer is a pull that stops halfway; one that feels the top of
// the page give and sees nothing there has no reason to keep going. So as the
// finger pulls (lib/sky-pull.ts) something comes down from above the top edge:
// whichever of the sun and the moon is up right now — the moon at its real
// phase — drawn as light, with a soft bloom round it. The further the pull, the
// lower it comes, the larger it grows and the brighter it gets, as if it were
// rising into view. At the point where letting go opens the window only the
// words change, to "let go": the light has no state of its own there, so it
// never jumps — not crossing the line, and not letting go on either side of
// it. Under it, the sky's gradient is
// already lifting (the renderer's pull preview), so the cue and the sky say the
// same thing.
//
// Light, not lines: the first version drew the progress as a stroked ring
// round an outline icon, which read as a control rather than as the sky; a
// second put an ink glyph in a glass bubble, which read as a button. This is
// the body itself, as light, and progress is brightness.
//
// Through a sunrise or a sunset (lib/phase.ts) it is the event instead — the
// sun is on the horizon or just under it, and the window will be about the
// sunset rather than a disc (the sky window's sun hint says the same).
//
// No React per frame: it is placed, scaled and lit by the pull's own CSS
// variables (`--sky-pull` places it, `--sky-pull-reveal` lights it — nothing for
// the first ~8 mm of the pull), and its two lines swap on
// `html[data-sky-armed]` — see "The sky pull" in globals.css. Rendered always
// and invisible at rest; it never takes a pointer, and it is decoration, so the
// screen reader hears the Dock notice that follows instead.
// ---------------------------------------------------------------------------

export function SkyPullCue() {
  const { locale } = useLocale();
  const { scene } = useWeather();
  const { phase } = useAmbientTime();
  const event = sunEventOf(phase);
  // What is up there to be looked at: the sun while it is above the horizon,
  // otherwise the moon if it is — the thing the window will be about. With
  // neither up (a moonless night), the sun, which is at least somewhere.
  const sunUp = scene.sun.elevation > 0 || scene.moon.elevation <= 0;

  return (
    <div
      aria-hidden="true"
      className="sky-pull-cue ink-bare pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col items-center"
    >
      <div className="sky-pull-cue-bubble relative flex h-10 w-10 items-center justify-center">
        <span className="sky-pull-cue-bloom absolute inset-0 rounded-full" />
        <span className="sky-pull-cue-glyph relative">
          {event ? (
            <SunEventGlyph light event={event} className="h-6 w-6" />
          ) : sunUp ? (
            <SunGlyph light className="h-6 w-6" />
          ) : (
            <MoonGlyph
              light
              phase={scene.moon.phase}
              mirror={scene.hemisphere === -1}
              className="h-6 w-6"
            />
          )}
        </span>
      </div>
      <div className="relative mt-2 h-4 text-[12px] font-medium">
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
