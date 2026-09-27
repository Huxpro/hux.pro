"use client";

import { t, useLocale } from "@/services";
import { LocateFixed, MapPinOff } from "lucide-react";
import { formatLocationLabel } from "../lib/location";
import { useLocation } from "../provider";
import { OFFER_DWELL, PermissionSheet, usePermissionOffer } from "./permission-sheet";

// ---------------------------------------------------------------------------
// LocationPrimerSheet — the offer that comes before the location prompt.
//
// The same shape as the tilt primer (tilt-primer-sheet.tsx) — the one in
// permission-sheet.tsx — for the same reason: a browser permission prompt that shows up with no idea what it is for
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

type Outcome = "granted" | "denied" | "unavailable";

/** How long an outcome stays up before the sheet closes itself, ms. */
const DWELL: Record<Outcome, number> = { ...OFFER_DWELL, unavailable: 2400 };

const OUTCOME_KEY = {
  granted: "locationPrimerGranted",
  denied: "locationPrimerDenied",
  unavailable: "locationPrimerUnavailable",
} as const;

export function LocationPrimerSheet() {
  const { locale } = useLocale();
  const {
    location,
    permission,
    isLocationPrimerOpen,
    closeLocationPrimer,
    requestAccurateLocation,
  } = useLocation();
  const offer = usePermissionOffer<Outcome>({
    open: isLocationPrimerOpen,
    close: closeLocationPrimer,
    dwell: (outcome) => DWELL[outcome],
  });

  // Each opening starts from the offer — or, when the browser has already been
  // told no, from the way back: asking again would do nothing at all.
  const view = offer.phase === "offer" && permission === "denied" ? "denied" : offer.view;

  const guessed =
    location?.source === "ip" ? formatLocationLabel(location) : null;
  const body = guessed
    ? t(locale, "locationPrimerBodyCity").replace("{city}", guessed)
    : t(locale, "locationPrimerBody");

  return (
    <PermissionSheet
      id="surface-location-primer"
      open={isLocationPrimerOpen}
      close={closeLocationPrimer}
      title={t(locale, "locationPrimerTitle")}
      presentation={{ base: "sheet", sm: "window" }}
      windowWidth="380px"
      glyph={(v) => (
        <div aria-hidden="true" className="flex justify-center pt-2">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/[0.06]">
            {v === "denied" ? (
              <MapPinOff className="h-6 w-6 text-secondary-foreground" />
            ) : (
              <LocateFixed className="h-6 w-6 text-foreground" />
            )}
          </span>
        </div>
      )}
      view={view}
      busy={offer.phase === "asking"}
      status={(outcome) => t(locale, OUTCOME_KEY[outcome])}
      body={body}
      confirm={{
        label: t(locale, "locationPrimerConfirm"),
        onClick: () => offer.ask(requestAccurateLocation),
      }}
      dismiss={{ label: t(locale, "locationPrimerDismiss"), onClick: closeLocationPrimer }}
      note={[t(locale, "locationPrimerAsk"), t(locale, "locationPrimerAgain")]}
    />
  );
}
