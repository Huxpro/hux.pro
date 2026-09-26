"use client";

import { cn } from "@/lib/utils";
import { t, useLocale } from "@/services";
import { AdaptiveSurface, SurfaceMorph } from "@/systems/surface";
import { LocateFixed, MapPinOff } from "lucide-react";
import { useEffect, useState } from "react";
import { formatLocationLabel } from "../lib/location";
import { useLocation } from "../provider";

// ---------------------------------------------------------------------------
// LocationPrimerSheet — the offer that comes before the location prompt.
//
// The same shape as the tilt primer (tilt-primer-sheet.tsx), for the same
// reason: a browser permission prompt that shows up with no idea what it is for
// gets refused, and a refusal is final everywhere. So the site never raises it
// on its own — not on load, not on focus, not on a refetch (lib/queries.ts
// checks the permission before any fix) — and asks only here, or from the
// command palette's Geolocation row, both a tap on something that says why.
//
// What summons it is a *reason*: the weather widget's city reads "Dallas?"
// when the IP provider put the address in another timezone from this device's
// clock (`timezoneMismatch`, lib/location.ts), and tapping that opens this.
// It names the city the network guessed, because "your network thinks you are
// in Dallas" is the whole argument.
//
// Unlike the tilt primer it is not phone-only — a laptop on a VPN is misplaced
// just the same — so it is a sheet on a phone and a small window from `sm` up.
// ---------------------------------------------------------------------------

type Phase = "offer" | "asking" | "granted" | "denied" | "unavailable";

/** How long an outcome stays up before the sheet closes itself, ms. */
const DWELL: Record<"granted" | "denied" | "unavailable", number> = {
  granted: 1400,
  denied: 3000,
  unavailable: 2400,
};

const OUTCOME_KEY = {
  granted: "locationPrimerGranted",
  denied: "locationPrimerDenied",
  unavailable: "locationPrimerUnavailable",
} as const;

const BUTTON =
  "w-full rounded-2xl px-4 py-3 text-[15px] font-medium transition-colors " +
  "active:scale-[0.99] motion-reduce:active:scale-100";

export function LocationPrimerSheet() {
  const { locale } = useLocale();
  const {
    location,
    permission,
    isLocationPrimerOpen,
    closeLocationPrimer,
    requestAccurateLocation,
  } = useLocation();
  const [phase, setPhase] = useState<Phase>("offer");

  useEffect(() => {
    if (phase === "offer" || phase === "asking") return;
    const timer = window.setTimeout(closeLocationPrimer, DWELL[phase]);
    return () => window.clearTimeout(timer);
  }, [phase, closeLocationPrimer]);

  // Each opening starts from the offer — or, when the browser has already been
  // told no, from the way back: asking again would do nothing at all.
  const [wasOpen, setWasOpen] = useState(isLocationPrimerOpen);
  if (wasOpen !== isLocationPrimerOpen) {
    setWasOpen(isLocationPrimerOpen);
    if (isLocationPrimerOpen) setPhase("offer");
  }
  const blocked = phase === "offer" && permission === "denied";

  const take = async () => {
    setPhase("asking");
    setPhase(await requestAccurateLocation());
  };

  // What the sheet shows: the offer (asking included — the browser's dialog
  // is over it), or how it went.
  const view: "offer" | keyof typeof OUTCOME_KEY = blocked
    ? "denied"
    : phase === "offer" || phase === "asking"
      ? "offer"
      : phase;
  const guessed =
    location?.source === "ip" ? formatLocationLabel(location) : null;
  const body = guessed
    ? t(locale, "locationPrimerBodyCity").replace("{city}", guessed)
    : t(locale, "locationPrimerBody");

  return (
    <AdaptiveSurface
      id="surface-location-primer"
      open={isLocationPrimerOpen}
      onOpenChange={(open) => {
        if (!open) closeLocationPrimer();
      }}
      presentation={{ base: "sheet", sm: "window" }}
      windowWidth="380px"
      title={t(locale, "locationPrimerTitle")}
      closeLabel={t(locale, "locationPrimerDismiss")}
      fitContent
    >
      {/* The offer, then how it went, in the same sheet: the content
          cross-fades and the sheet eases to its new height rather than
          cutting to it (SurfaceMorph). */}
      <SurfaceMorph
        step={view}
        render={(v) => (
          <div className="space-y-4 pb-2">
            <div aria-hidden="true" className="flex justify-center pt-2">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.06]">
                {v === "denied" ? (
                  <MapPinOff className="h-6 w-6 text-secondary-foreground" />
                ) : (
                  <LocateFixed className="h-6 w-6 text-foreground" />
                )}
              </span>
            </div>
            {v === "offer" ? (
              <>
                <p className="px-0.5 text-[15px] leading-relaxed text-secondary-foreground">
                  {body}
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={take}
                    disabled={phase === "asking"}
                    className={cn(
                      BUTTON,
                      "bg-foreground text-background hover:bg-foreground/90",
                      "disabled:opacity-50"
                    )}
                  >
                    {t(locale, "locationPrimerConfirm")}
                  </button>
                  <button
                    type="button"
                    onClick={closeLocationPrimer}
                    disabled={phase === "asking"}
                    className={cn(
                      BUTTON,
                      "bg-foreground/[0.06] hover:bg-foreground/10",
                      "disabled:opacity-50"
                    )}
                  >
                    {t(locale, "locationPrimerDismiss")}
                  </button>
                </div>
                <p className="px-0.5 text-center text-[11px] leading-snug text-tertiary-foreground">
                  {t(locale, "locationPrimerAsk")}
                  <br />
                  {t(locale, "locationPrimerAgain")}
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
                {t(locale, OUTCOME_KEY[v])}
              </p>
            )}
          </div>
        )}
      />
    </AdaptiveSurface>
  );
}
